import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdminOrManager(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const ok = data?.some((r: any) => r.role === "admin" || r.role === "manager");
  if (!ok) throw new Error("Réservé aux admins/managers");
}

// Recalcul global
export const recalculateAllScores = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdminOrManager(supabase, userId);
    const { data, error } = await supabase.rpc("recalculate_all_scores");
    if (error) throw new Error(error.message);
    return { ok: true, count: data ?? 0 };
  });

// Détail du score d'un employé (pour breakdown UI)
export const getScoreBreakdown = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ userId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdminOrManager(supabase, userId);
    const lambda = 0.01;
    const now = Date.now();
    const dayMs = 86_400_000;

    // 1. default
    const { data: settings } = await supabase
      .from("ai_planning_settings")
      .select("default_score_when_null")
      .limit(1).maybeSingle();
    const defaultScore = Number(settings?.default_score_when_null ?? 7);

    // 2. Manager (feedbacks sur ses shifts)
    const { data: shiftIds } = await supabase
      .from("shifts").select("id").eq("user_id", data.userId);
    const ids = (shiftIds ?? []).map((s: any) => s.id);
    let manager = defaultScore;
    let managerCount = 0;
    if (ids.length > 0) {
      const { data: fbs } = await supabase
        .from("feedbacks")
        .select("rating, created_at, author_id")
        .in("shift_id", ids);
      const list = (fbs ?? []).filter((f: any) => f.author_id !== data.userId);
      managerCount = list.length;
      if (list.length > 0) {
        let num = 0, den = 0;
        for (const f of list) {
          const days = Math.max(0, (now - new Date(f.created_at).getTime()) / dayMs);
          const w = Math.exp(-lambda * days);
          num += Math.min(f.rating, 5) * 2 * w;
          den += w;
        }
        manager = num / den;
      }
    }

    // 3. Ponctualité
    const today = new Date().toISOString().slice(0, 10);
    const { data: shifts } = await supabase
      .from("shifts")
      .select("shift_date, end_time, minutes_late, clocked_in_at, published_at")
      .eq("user_id", data.userId)
      .lte("shift_date", today)
      .order("shift_date", { ascending: false })
      .limit(60);
    let punct = defaultScore;
    let punctCount = 0;
    const recent: { shift_date: string; minutes_late: number | null; pscore: number | null }[] = [];
    if (shifts && shifts.length > 0) {
      let num = 0, den = 0;
      for (const sh of shifts) {
        let pscore: number | null = null;
        const ml = sh.minutes_late;
        const past = new Date(`${sh.shift_date}T${sh.end_time}`).getTime() < now;
        if (ml === null && sh.published_at && past) pscore = 0;
        else if (ml === null) pscore = null;
        else if (ml === 0) pscore = 10;
        else if (ml <= 5) pscore = 9;
        else if (ml <= 15) pscore = 7;
        else if (ml <= 30) pscore = 4;
        else pscore = 1;
        recent.push({ shift_date: sh.shift_date, minutes_late: ml, pscore });
        if (pscore === null) continue;
        const days = Math.max(0, (Date.parse(today) - Date.parse(sh.shift_date)) / dayMs);
        const w = Math.exp(-lambda * days);
        num += pscore * w;
        den += w;
        punctCount++;
      }
      if (den > 0) punct = num / den;
    }

    // 4. Checklist (nouvelle structure : checklist_submissions + items)
    let checklist = defaultScore;
    let checklistCount = 0;
    if (ids.length > 0) {
      const { data: subs } = await supabase
        .from("checklist_submissions")
        .select("id, shift_id")
        .in("shift_id", ids);
      const subIds = (subs ?? []).map((s) => s.id);
      const subToShift = new Map<string, string>((subs ?? []).map((s) => [s.id, s.shift_id]));

      if (subIds.length > 0) {
        const { data: items } = await supabase
          .from("checklist_submission_items")
          .select("submission_id, is_checked")
          .in("submission_id", subIds);
        const grouped = new Map<string, { total: number; done: number }>();
        for (const it of items ?? []) {
          const sid = subToShift.get(it.submission_id);
          if (!sid) continue;
          const g = grouped.get(sid) ?? { total: 0, done: 0 };
          g.total++;
          if (it.is_checked) g.done++;
          grouped.set(sid, g);
        }
        const dateById = Object.fromEntries((shifts ?? []).map((s: any) => [s.id, s.shift_date]));
        let num = 0, den = 0;
        for (const [sid, g] of grouped) {
          const d = dateById[sid];
          if (!d) continue;
          const days = Math.max(0, (Date.parse(today) - Date.parse(d)) / dayMs);
          const w = Math.exp(-lambda * days);
          num += (g.done / g.total) * 10 * w;
          den += w;
          checklistCount++;
        }
        if (den > 0) checklist = num / den;
      }
    }

    const final = (manager + punct + checklist) / 3;

    // Évolution sur 90 jours : score quotidien approximé (moyenne mobile sur ponctualité)
    const evolution: { date: string; score: number }[] = [];
    const recentSorted = recent.slice().sort((a, b) => a.shift_date.localeCompare(b.shift_date));
    for (let i = 89; i >= 0; i--) {
      const d = new Date(now - i * dayMs).toISOString().slice(0, 10);
      const before = recentSorted.filter((r) => r.shift_date <= d && r.pscore !== null);
      if (before.length === 0) { evolution.push({ date: d, score: defaultScore }); continue; }
      let num = 0, den = 0;
      for (const r of before) {
        const days = Math.max(0, (Date.parse(d) - Date.parse(r.shift_date)) / dayMs);
        const w = Math.exp(-lambda * days);
        num += (r.pscore as number) * w;
        den += w;
      }
      const punctOnDay = den > 0 ? num / den : defaultScore;
      evolution.push({ date: d, score: Math.round(((manager + punctOnDay + checklist) / 3) * 10) / 10 });
    }

    return {
      manager: Math.round(manager * 100) / 100,
      punctuality: Math.round(punct * 100) / 100,
      checklist: Math.round(checklist * 100) / 100,
      final: Math.round(final * 100) / 100,
      counts: { manager: managerCount, punctuality: punctCount, checklist: checklistCount },
      evolution,
      recent,
    };
  });
