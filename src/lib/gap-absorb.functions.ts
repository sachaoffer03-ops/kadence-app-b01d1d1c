import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Rattrapage sur planning déjà enregistré : absorbe les trous très courts
// (<= marge de débordement) en étendant le shift voisin de la personne
// déjà présente. Même logique que la passe "marge de débordement" du
// générateur, appliquée aux shifts existants.

const Input = z.object({
  studioIds: z.array(z.string().uuid()).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dryRun: z.boolean().default(true),
});

const t2m = (t: string) => {
  const [h, m] = String(t).slice(0, 5).split(":").map(Number);
  return h * 60 + (m || 0);
};
const m2t = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}:00`;

interface ShiftRow {
  id: string;
  user_id: string | null;
  studio_id: string | null;
  business_role: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  status: string;
  is_locked: boolean;
}

export const absorbShortGaps = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const allowed = roles?.some(
      (r: any) => r.role === "admin" || r.role === "manager",
    );
    if (!allowed) throw new Error("Réservé aux admins/managers");

    const { data: settings } = await supabaseAdmin
      .from("ai_planning_settings")
      .select("overflow_margin_min, max_shift_hours, max_shift_hours_cdi, max_shift_hours_student, max_shift_hours_flexi")
      .order("updated_at", { ascending: false })
      .limit(1)

      .maybeSingle();
    const margin = Math.max(0, Math.min(60, (settings as any)?.overflow_margin_min ?? 30));
    if (margin === 0) {
      return { ok: true, margin, changes: [], closed: 0, applied: false };
    }

    const from = data.from ?? new Date().toISOString().slice(0, 10);
    const to = data.to ?? "2100-01-01";

    let q = supabaseAdmin
      .from("shifts")
      .select("id, user_id, studio_id, business_role, shift_date, start_time, end_time, status, is_locked")
      .gte("shift_date", from)
      .lte("shift_date", to)
      .neq("status", "cancelled");
    if (data.studioIds && data.studioIds.length > 0) {
      q = q.in("studio_id", data.studioIds);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const shifts = (rows ?? []) as ShiftRow[];

    // Index par employé pour tester les chevauchements
    const byUserDate = new Map<string, ShiftRow[]>();
    for (const sh of shifts) {
      if (!sh.user_id) continue;
      const k = `${sh.user_id}|${sh.shift_date}`;
      const arr = byUserDate.get(k) ?? [];
      arr.push(sh);
      byUserDate.set(k, arr);
    }

    const maxShiftMinFor = (contracts: Set<string>) => {
      const st = settings as any;
      if (contracts.has("CDI")) return (st?.max_shift_hours_cdi ?? 8) * 60;
      if (contracts.has("Étudiant")) return (st?.max_shift_hours_student ?? 6) * 60;
      if (contracts.has("Flexi")) return (st?.max_shift_hours_flexi ?? 6) * 60;
      return (st?.max_shift_hours ?? 6) * 60;
    };

    const holes = shifts.filter(
      (sh) =>
        !sh.user_id &&
        t2m(sh.end_time) - t2m(sh.start_time) <= margin &&
        t2m(sh.end_time) > t2m(sh.start_time),
    );
    if (holes.length === 0) {
      return { ok: true, margin, changes: [], closed: 0, applied: !data.dryRun };
    }

    // Profils + contrats des voisins potentiels
    const neighborIds = Array.from(
      new Set(shifts.filter((s) => s.user_id).map((s) => s.user_id as string)),
    );
    const [{ data: profiles }, { data: contracts }] = await Promise.all([
      neighborIds.length
        ? supabaseAdmin.from("profiles").select("id, first_name, last_name").in("id", neighborIds)
        : Promise.resolve({ data: [] as any[] }),
      neighborIds.length
        ? supabaseAdmin.from("user_contracts").select("user_id, contract").in("user_id", neighborIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const nameOf = new Map(
      (profiles ?? []).map((p: any) => [p.id, `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim()]),
    );
    const contractsOf = new Map<string, Set<string>>();
    for (const c of contracts ?? []) {
      const set = contractsOf.get((c as any).user_id) ?? new Set<string>();
      set.add((c as any).contract);
      contractsOf.set((c as any).user_id, set);
    }

    const changes: Array<{
      holeId: string;
      shiftId: string;
      userId: string;
      userName: string;
      date: string;
      role: string;
      studioId: string | null;
      oldStart: string;
      oldEnd: string;
      newStart: string;
      newEnd: string;
      minutes: number;
    }> = [];
    const consumedShiftIds = new Set<string>();

    for (const hole of holes) {
      const hs = t2m(hole.start_time);
      const he = t2m(hole.end_time);
      const sameCtx = shifts.filter(
        (sh) =>
          sh.user_id &&
          !consumedShiftIds.has(sh.id) &&
          sh.shift_date === hole.shift_date &&
          sh.studio_id === hole.studio_id &&
          sh.business_role === hole.business_role,
      );
      const prev = sameCtx.find((sh) => t2m(sh.end_time) === hs);
      const next = sameCtx.find((sh) => t2m(sh.start_time) === he);

      const tryTake = (cand: ShiftRow | undefined) => {
        if (!cand || !cand.user_id) return null;
        const newStart = Math.min(t2m(cand.start_time), hs);
        const newEnd = Math.max(t2m(cand.end_time), he);
        if (newEnd - newStart > maxShiftMinFor(contractsOf.get(cand.user_id) ?? new Set())) return null;
        // Pas de chevauchement avec un autre shift du même employé ce jour-là
        const others = (byUserDate.get(`${cand.user_id}|${cand.shift_date}`) ?? []).filter(
          (o) => o.id !== cand.id,
        );
        for (const o of others) {
          if (t2m(o.start_time) < newEnd && t2m(o.end_time) > newStart) return null;
        }
        return { cand, newStart, newEnd };
      };

      // Priorité à la personne déjà présente avant le trou
      const pick = tryTake(prev) ?? tryTake(next);
      if (!pick) continue;

      changes.push({
        holeId: hole.id,
        shiftId: pick.cand.id,
        userId: pick.cand.user_id!,
        userName: nameOf.get(pick.cand.user_id!) ?? "Employé",
        date: hole.shift_date,
        role: hole.business_role,
        studioId: hole.studio_id,
        oldStart: String(pick.cand.start_time).slice(0, 5),
        oldEnd: String(pick.cand.end_time).slice(0, 5),
        newStart: m2t(pick.newStart).slice(0, 5),
        newEnd: m2t(pick.newEnd).slice(0, 5),
        minutes: he - hs,
      });

      // Reflète le changement en mémoire pour les trous suivants
      pick.cand.start_time = m2t(pick.newStart);
      pick.cand.end_time = m2t(pick.newEnd);
      consumedShiftIds.add(hole.id);
    }

    if (data.dryRun || changes.length === 0) {
      return { ok: true, margin, changes, closed: changes.length, applied: false };
    }

    // Application
    for (const ch of changes) {
      const { error: upErr } = await supabaseAdmin
        .from("shifts")
        .update({
          start_time: `${ch.newStart}:00`,
          end_time: `${ch.newEnd}:00`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", ch.shiftId);
      if (upErr) throw new Error(upErr.message);
    }
    await supabaseAdmin
      .from("shifts")
      .delete()
      .in("id", Array.from(consumedShiftIds));

    // Notifie les employés dont l'horaire a bougé
    const notifs = changes.map((ch) => ({
      user_id: ch.userId,
      type: "shift_time_adjusted",
      title: "Horaire de shift ajusté",
      body: `${new Date(ch.date + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })} · ${ch.role} : ${ch.oldStart}–${ch.oldEnd} devient ${ch.newStart}–${ch.newEnd} (+${ch.minutes} min)`,
      link: "/staff-app?tab=planning",
      priority: "normal",
      category: "shift",
    }));
    if (notifs.length > 0) await supabaseAdmin.from("notifications").insert(notifs);

    return { ok: true, margin, changes, closed: changes.length, applied: true };
  });
