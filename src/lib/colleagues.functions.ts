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

/**
 * Renvoie les collègues de l'utilisateur connecté pour la journée :
 * - même studio que (au moins un de) ses shifts du jour
 * - dont l'horaire chevauche au moins un des shifts du jour
 * - en excluant l'utilisateur lui-même
 */
export const getTodayColleagues = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const day = todayIso();

    // 1. Mes shifts du jour (visibles via RLS)
    const { data: mine, error: e1 } = await supabase
      .from("shifts")
      .select("studio_id, start_time, end_time")
      .eq("user_id", userId)
      .eq("shift_date", day);
    if (e1) throw new Error(e1.message);
    if (!mine || mine.length === 0) return [] as Colleague[];

    const studioIds = Array.from(
      new Set(mine.map((s) => s.studio_id).filter(Boolean) as string[]),
    );
    if (studioIds.length === 0) return [] as Colleague[];

    // 2. Tous les shifts du jour dans ces studios (via admin, profiles RLS bloque)
    const { data: others, error: e2 } = await supabaseAdmin
      .from("shifts")
      .select("user_id, studio_id, start_time, end_time, business_role")
      .eq("shift_date", day)
      .in("studio_id", studioIds)
      .not("user_id", "is", null)
      .neq("user_id", userId);
    if (e2) throw new Error(e2.message);
    if (!others || others.length === 0) return [] as Colleague[];

    // 3. Filtrer : doit chevaucher un de mes shifts dans le même studio
    const overlaps = (aS: string, aE: string, bS: string, bE: string) =>
      aS.slice(0, 8) < bE.slice(0, 8) && aE.slice(0, 8) > bS.slice(0, 8);

    const matched = others.filter((o) =>
      mine.some(
        (m) =>
          m.studio_id === o.studio_id &&
          overlaps(m.start_time, m.end_time, o.start_time, o.end_time),
      ),
    );
    if (matched.length === 0) return [] as Colleague[];

    // 4. Profils (admin pour bypass RLS)
    const userIds = Array.from(new Set(matched.map((s) => s.user_id as string)));
    const { data: profiles, error: e3 } = await supabaseAdmin
      .from("profiles")
      .select("id, first_name, avatar_url")
      .in("id", userIds);
    if (e3) throw new Error(e3.message);

    const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
    const result: Colleague[] = matched.map((s) => {
      const p = byId.get(s.user_id as string);
      return {
        userId: s.user_id as string,
        firstName: p?.first_name ?? "—",
        avatarUrl: p?.avatar_url ?? null,
        startTime: String(s.start_time).slice(0, 5),
        endTime: String(s.end_time).slice(0, 5),
        businessRole: s.business_role,
      };
    });
    // tri par heure d'arrivée
    result.sort((a, b) => a.startTime.localeCompare(b.startTime));
    return result;
  });
