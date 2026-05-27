// Server-only helper: compute score breakdown for a user.
// Reads scoring_settings (cached 60s) to drive the per-shift punctuality scale
// and the per-dimension weights for the final score.

import { loadScoringSettings } from "./scoring-rules.server";
import { scorePunctuality } from "./scoring-shared";

type AnySupabase = any;

export interface ScoreBreakdown {
  manager: number;
  punctuality: number;
  checklist: number;
  final: number;
  counts: { manager: number; punctuality: number; checklist: number };
  evolution: { date: string; score: number }[];
  recent: { shift_date: string; minutes_late: number | null; pscore: number | null }[];
}

function weightedFinal(rules: { weight_punctuality: number; weight_checklist: number; weight_photos: number }, manager: number, punct: number, checklist: number) {
  // "manager" remplace l'axe "photos" pour le score consolidé profile-level :
  // on garde la même pondération que photos (UX historique 3 axes équivalents).
  const wp = rules.weight_punctuality;
  const wc = rules.weight_checklist;
  const wm = rules.weight_photos;
  const total = wp + wc + wm || 100;
  return (punct * wp + checklist * wc + manager * wm) / total;
}

export async function computeScoreBreakdown(
  supabase: AnySupabase,
  userId: string,
): Promise<ScoreBreakdown> {
  const lambda = 0.01;
  const now = Date.now();
  const dayMs = 86_400_000;

  const rules = await loadScoringSettings(supabase);

  const { data: settings } = await supabase
    .from("ai_planning_settings")
    .select("default_score_when_null")
    .limit(1).maybeSingle();
  const defaultScore = Number(settings?.default_score_when_null ?? 7);

  const { data: shiftIds } = await supabase
    .from("shifts").select("id").eq("user_id", userId);
  const ids = (shiftIds ?? []).map((s: any) => s.id);

  let manager = defaultScore;
  let managerCount = 0;
  if (ids.length > 0) {
    const { data: fbs } = await supabase
      .from("feedbacks")
      .select("rating, created_at, author_id")
      .in("shift_id", ids);
    const list = (fbs ?? []).filter((f: any) => f.author_id !== userId);
    managerCount = list.length;
    if (list.length > 0) {
      let num = 0, den = 0;
      for (const f of list) {
        const days = Math.max(0, (now - new Date(f.created_at).getTime()) / dayMs);
        const w = Math.exp(-lambda * days);
        // f.rating est désormais natif sur 0..10 (migration 2026-05-27),
        // on borne par sécurité au cas où d'anciennes valeurs 0..5 traînent.
        num += Math.min(Math.max(f.rating, 0), 10) * w;
        den += w;
      }
      manager = num / den;
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data: shifts } = await supabase
    .from("shifts")
    .select("id, shift_date, end_time, minutes_late, clocked_in_at, published_at")
    .eq("user_id", userId)
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
      if (ml === null && sh.published_at && past) pscore = scorePunctuality(rules, null, true);
      else if (ml === null) pscore = null;
      else pscore = scorePunctuality(rules, ml);
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

  let checklist = defaultScore;
  let checklistCount = 0;
  if (ids.length > 0) {
    const { data: subs } = await supabase
      .from("checklist_submissions")
      .select("id, shift_id")
      .in("shift_id", ids);
    const subIds = (subs ?? []).map((s: any) => s.id);
    const subToShift = new Map<string, string>((subs ?? []).map((s: any) => [s.id, s.shift_id]));

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
        const pct = g.total > 0 ? g.done / g.total : 1;
        const missed = Math.max(0, g.total - g.done);
        const base = pct * rules.checklist_complete;
        const penalty = missed * rules.checklist_penalty_per_missed;
        num += Math.max(0, base - penalty) * w;
        den += w;
        checklistCount++;
      }
      if (den > 0) checklist = num / den;
    }
  }

  const final = weightedFinal(rules, manager, punct, checklist);

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
    evolution.push({ date: d, score: Math.round(weightedFinal(rules, manager, punctOnDay, checklist) * 10) / 10 });
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
}
