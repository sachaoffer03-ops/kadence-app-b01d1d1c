import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

export type Colleague = {
  userId: string;
  firstName: string;
  avatarUrl: string | null;
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
  businessRole: string;
};

export type ShiftRelay = {
  // Mon shift de référence
  myStart: string;
  myEnd: string;
  businessRole: string;
  // Qui bosse juste avant moi (même studio + même rôle, termine ≤ 60 min avant/après le début de mon shift)
  before: Colleague | null;
  // Qui prend la relève après moi (même studio + même rôle, démarre à ≤ 60 min de ma fin)
  after: Colleague | null;
};

export type TodayColleaguesPayload = {
  colleagues: Colleague[];
  relays: ShiftRelay[];
};

/**
 * Renvoie les collègues de l'utilisateur connecté pour la journée :
 * - même studio que (au moins un de) ses shifts du jour
 * - dont l'horaire chevauche au moins un des shifts du jour
 * - en excluant l'utilisateur lui-même
 * + relais (qui succède / qui précède) au même poste dans le même studio.
 */
export const getTodayColleagues = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TodayColleaguesPayload> => {
    const { supabase, userId } = context;
    const day = todayIso();

    // 1. Mes shifts du jour (visibles via RLS)
    const { data: mine, error: e1 } = await supabase
      .from("shifts")
      .select("studio_id, start_time, end_time, business_role")
      .eq("user_id", userId)
      .eq("shift_date", day);
    if (e1) throw new Error(e1.message);
    if (!mine || mine.length === 0) return { colleagues: [], relays: [] };

    const studioIds = Array.from(
      new Set(mine.map((s) => s.studio_id).filter(Boolean) as string[]),
    );
    if (studioIds.length === 0) return { colleagues: [], relays: [] };

    // 2. Tous les shifts du jour dans ces studios (via admin, profiles RLS bloque)
    const { data: others, error: e2 } = await supabaseAdmin
      .from("shifts")
      .select("user_id, studio_id, start_time, end_time, business_role")
      .eq("shift_date", day)
      .in("studio_id", studioIds)
      .not("user_id", "is", null)
      .neq("user_id", userId);
    if (e2) throw new Error(e2.message);
    const othersList = others ?? [];

    // Profils (admin pour bypass RLS)
    const userIds = Array.from(new Set(othersList.map((s) => s.user_id as string)));
    const { data: profiles, error: e3 } = userIds.length
      ? await supabaseAdmin
          .from("profiles")
          .select("id, first_name, avatar_url")
          .in("id", userIds)
      : { data: [] as { id: string; first_name: string | null; avatar_url: string | null }[], error: null };
    if (e3) throw new Error(e3.message);
    const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

    const toColleague = (s: (typeof othersList)[number]): Colleague => {
      const p = byId.get(s.user_id as string);
      return {
        userId: s.user_id as string,
        firstName: p?.first_name ?? "—",
        avatarUrl: p?.avatar_url ?? null,
        startTime: String(s.start_time).slice(0, 5),
        endTime: String(s.end_time).slice(0, 5),
        businessRole: (s as any).business_role,
      };
    };

    // 3. Collègues qui chevauchent
    const overlaps = (aS: string, aE: string, bS: string, bE: string) =>
      aS.slice(0, 8) < bE.slice(0, 8) && aE.slice(0, 8) > bS.slice(0, 8);

    const matched = othersList.filter((o) =>
      mine.some(
        (m) =>
          m.studio_id === o.studio_id &&
          overlaps(m.start_time, m.end_time, o.start_time, o.end_time),
      ),
    );
    const colleagues = matched.map(toColleague);
    colleagues.sort((a, b) => a.startTime.localeCompare(b.startTime));

    // 4. Relais : pour chaque shift à moi, chercher prédécesseur/successeur au même poste
    const toMin = (t: string) => {
      const [h, m] = t.slice(0, 5).split(":").map(Number);
      return (h || 0) * 60 + (m || 0);
    };
    const RELAY_WINDOW_MIN = 90; // ± 90 min pour considérer qu'un shift enchaîne

    const relays: ShiftRelay[] = mine.map((m) => {
      const myStartMin = toMin(m.start_time);
      const myEndMin = toMin(m.end_time);
      const sameContext = othersList.filter(
        (o) => o.studio_id === m.studio_id && (o as any).business_role === (m as any).business_role,
      );

      // Après moi : shift qui démarre le plus proche de ma fin (dans la fenêtre)
      let after: (typeof othersList)[number] | null = null;
      let afterDiff = Infinity;
      for (const o of sameContext) {
        const oStart = toMin(o.start_time);
        const diff = oStart - myEndMin;
        if (diff >= -15 && diff <= RELAY_WINDOW_MIN && Math.abs(diff) < Math.abs(afterDiff)) {
          after = o;
          afterDiff = diff;
        }
      }

      // Avant moi : shift qui finit le plus proche de mon début (dans la fenêtre)
      let before: (typeof othersList)[number] | null = null;
      let beforeDiff = Infinity;
      for (const o of sameContext) {
        const oEnd = toMin(o.end_time);
        const diff = myStartMin - oEnd;
        if (diff >= -15 && diff <= RELAY_WINDOW_MIN && Math.abs(diff) < Math.abs(beforeDiff)) {
          before = o;
          beforeDiff = diff;
        }
      }

      return {
        myStart: String(m.start_time).slice(0, 5),
        myEnd: String(m.end_time).slice(0, 5),
        businessRole: (m as any).business_role,
        before: before ? toColleague(before) : null,
        after: after ? toColleague(after) : null,
      };
    });

    return { colleagues, relays };
  });
