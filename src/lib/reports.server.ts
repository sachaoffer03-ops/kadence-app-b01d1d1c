import { supabaseAdmin } from "@/integrations/supabase/client.server";

// --- shared DTO types ---
export type Period = { from: string; to: string };
export type Filters = Period & { studioIds?: string[]; roleIds?: string[] };

// --- auth helper ---
export async function assertAdminOrManager(userId: string): Promise<"admin" | "manager"> {
  const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r: any) => r.role);
  if (roles.includes("admin")) return "admin";
  if (roles.includes("manager")) return "manager";
  throw new Error("Accès réservé aux administrateurs et managers");
}

// --- date helpers ---
function isoDate(d: Date) { return d.toISOString().slice(0, 10); }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function periodLengthDays(from: string, to: string) {
  return Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1);
}
function previousPeriod(from: string, to: string): Period {
  const len = periodLengthDays(from, to);
  const prevTo = addDays(new Date(from), -1);
  const prevFrom = addDays(prevTo, -(len - 1));
  return { from: isoDate(prevFrom), to: isoDate(prevTo) };
}

// --- shifts query w/ filters ---
async function fetchShiftsInRange(f: Filters, opts?: { onlyCompleted?: boolean }) {
  let q = supabaseAdmin
    .from("shifts")
    .select("id,user_id,studio_id,business_role,shift_date,start_time,end_time,clocked_in_at,clocked_out_at,status,minutes_late,dimona_status")
    .gte("shift_date", f.from)
    .lte("shift_date", f.to);
  if (opts?.onlyCompleted) q = q.eq("status", "completed");
  if (f.studioIds && f.studioIds.length) q = q.in("studio_id", f.studioIds);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  let rows = data ?? [];
  if (f.roleIds && f.roleIds.length) {
    // roleIds are business_roles.id; we map them to name
    const { data: br } = await supabaseAdmin.from("business_roles").select("id,name").in("id", f.roleIds);
    const names = new Set((br ?? []).map((r: any) => r.name));
    rows = rows.filter((s: any) => names.has(s.business_role));
  }
  return rows;
}

function workedHours(s: any): number {
  if (!s.clocked_in_at || !s.clocked_out_at) return 0;
  const ms = new Date(s.clocked_out_at).getTime() - new Date(s.clocked_in_at).getTime();
  return Math.max(0, ms / 3600000);
}

// === OVERVIEW KPIs ===========================================================
export async function getOverviewKpis(f: Filters) {
  const all = await fetchShiftsInRange(f);
  const completed = all.filter((s: any) => s.status === "completed");
  const scheduledOrCompleted = all.filter((s: any) => s.status === "completed" || s.status === "scheduled");
  const completionPct = scheduledOrCompleted.length ? Math.round((completed.length / scheduledOrCompleted.length) * 100) : 0;

  // Score moyen équipe (employés actifs avec ≥1 shift sur la période)
  const userIds = Array.from(new Set(completed.map((s: any) => s.user_id).filter(Boolean))) as string[];
  let scoreAvg = 0;
  let employeesWithoutRate = 0;
  let payrollTotal = 0;
  let totalHours = 0;
  let profilesMap = new Map<string, { score: number | null; hourly_rate: number | null; first_name: string; last_name: string }>();
  if (userIds.length) {
    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("id,score,hourly_rate,first_name,last_name,status")
      .in("id", userIds);
    for (const p of profs ?? []) {
      profilesMap.set(p.id, p);
      if (p.score != null) scoreAvg += Number(p.score);
    }
    const withScore = (profs ?? []).filter((p: any) => p.score != null).length;
    scoreAvg = withScore ? +(scoreAvg / withScore).toFixed(2) : 0;
  }

  // Payroll = somme heures × hourly_rate (exclut hourly_rate NULL)
  for (const s of completed as any[]) {
    const wh = workedHours(s);
    totalHours += wh;
    if (!s.user_id) continue;
    const p = profilesMap.get(s.user_id);
    if (p?.hourly_rate != null) payrollTotal += wh * Number(p.hourly_rate);
  }
  payrollTotal = +payrollTotal.toFixed(2);
  totalHours = +totalHours.toFixed(1);
  for (const p of profilesMap.values()) {
    if (p.hourly_rate == null) employeesWithoutRate++;
  }

  // Checklist completion rate
  let checklistPct = 0;
  {
    const shiftIds = completed.map((s: any) => s.id);
    if (shiftIds.length) {
      const { data: subs } = await supabaseAdmin
        .from("checklist_submissions").select("id").in("shift_id", shiftIds).eq("status", "completed");
      const subIds = (subs ?? []).map((s: any) => s.id);
      if (subIds.length) {
        const { data: items } = await supabaseAdmin
          .from("checklist_submission_items").select("submission_id,is_checked").in("submission_id", subIds);
        const bySub = new Map<string, { total: number; done: number }>();
        for (const it of items ?? []) {
          const cur = bySub.get(it.submission_id) ?? { total: 0, done: 0 };
          cur.total++; if (it.is_checked) cur.done++;
          bySub.set(it.submission_id, cur);
        }
        const pcts = Array.from(bySub.values()).map((v) => v.total ? v.done / v.total : 0);
        checklistPct = pcts.length ? Math.round((pcts.reduce((a, b) => a + b, 0) / pcts.length) * 100) : 0;
      }
    }
  }

  // Sparkline 30j — completed shifts par jour (proxy d'activité)
  const sparklineTo = new Date(f.to);
  const sparklineFrom = addDays(sparklineTo, -29);
  const { data: sparkRows } = await supabaseAdmin
    .from("shifts").select("shift_date,status")
    .gte("shift_date", isoDate(sparklineFrom)).lte("shift_date", isoDate(sparklineTo))
    .eq("status", "completed");
  const sparkMap = new Map<string, number>();
  for (let i = 0; i < 30; i++) sparkMap.set(isoDate(addDays(sparklineFrom, i)), 0);
  for (const r of sparkRows ?? []) sparkMap.set(r.shift_date, (sparkMap.get(r.shift_date) ?? 0) + 1);
  const sparkline = Array.from(sparkMap.entries()).map(([date, v]) => ({ date, value: v }));

  return {
    completedCount: completed.length,
    completionPct,
    scoreAvg,
    scoreColor: scoreAvg > 7 ? "good" : scoreAvg >= 5 ? "warn" : "bad",
    payrollTotal,
    totalHours,
    employeesWithoutRate,
    checklistPct,
    sparkline,
  };
}

// === TOP / BOTTOM PERFORMERS =================================================
export async function getTopAndBottomPerformers(f: Filters) {
  const prev = previousPeriod(f.from, f.to);
  const cur = await fetchShiftsInRange(f, { onlyCompleted: true });
  const prevShifts = await fetchShiftsInRange({ ...f, ...prev }, { onlyCompleted: true });

  // Group by user, count + retards
  const countCur = new Map<string, { shifts: number; lateCount: number }>();
  for (const s of cur) {
    if (!s.user_id) continue;
    const cur2 = countCur.get(s.user_id) ?? { shifts: 0, lateCount: 0 };
    cur2.shifts++; if ((s.minutes_late ?? 0) > 5) cur2.lateCount++;
    countCur.set(s.user_id, cur2);
  }
  const userIds = Array.from(countCur.keys());
  if (!userIds.length) return { top: [], bottom: [] };

  const { data: profs } = await supabaseAdmin
    .from("profiles").select("id,first_name,last_name,avatar_url,score").in("id", userIds);

  // approximate "previous score" with current score minus a heuristic: not perfect,
  // since profile.score is current. We instead build a per-period proxy from feedbacks:
  const { data: feedNow } = await supabaseAdmin
    .from("feedbacks").select("rating,shift_id,created_at").gte("created_at", `${f.from}T00:00:00Z`).lte("created_at", `${f.to}T23:59:59Z`);
  const { data: feedPrev } = await supabaseAdmin
    .from("feedbacks").select("rating,shift_id,created_at").gte("created_at", `${prev.from}T00:00:00Z`).lte("created_at", `${prev.to}T23:59:59Z`);

  // map shift -> user
  const curShiftToUser = new Map<string, string>();
  for (const s of cur as any[]) if (s.user_id) curShiftToUser.set(s.id, s.user_id);
  const prevShiftToUser = new Map<string, string>();
  for (const s of prevShifts as any[]) if (s.user_id) prevShiftToUser.set(s.id, s.user_id);

  const scoreOf = (rows: any[], map: Map<string, string>) => {
    const acc = new Map<string, { sum: number; n: number }>();
    for (const r of rows ?? []) {
      const u = map.get(r.shift_id);
      if (!u) continue;
      const e = acc.get(u) ?? { sum: 0, n: 0 };
      e.sum += Number(r.rating) * 2; e.n++;
      acc.set(u, e);
    }
    return acc;
  };
  const curScore = scoreOf(feedNow ?? [], curShiftToUser);
  const prevScore = scoreOf(feedPrev ?? [], prevShiftToUser);

  const rows = (profs ?? []).map((p: any) => {
    const stats = countCur.get(p.id) ?? { shifts: 0, lateCount: 0 };
    const cs = curScore.get(p.id);
    const ps = prevScore.get(p.id);
    const scoreNow = cs && cs.n ? cs.sum / cs.n : Number(p.score ?? 0);
    const scorePrev = ps && ps.n ? ps.sum / ps.n : Number(p.score ?? 0);
    const delta = +(scoreNow - scorePrev).toFixed(2);
    const reason = stats.lateCount >= 3
      ? `${stats.lateCount} retards`
      : delta <= -1 ? `Score en baisse de ${Math.abs(delta).toFixed(1)}`
      : null;
    return {
      userId: p.id,
      firstName: p.first_name, lastName: p.last_name, avatarUrl: p.avatar_url,
      score: +scoreNow.toFixed(2), delta,
      shifts: stats.shifts, reason,
    };
  }).filter((r) => r.shifts >= 3);

  const top = [...rows].sort((a, b) => b.score - a.score).slice(0, 5);
  const bottom = [...rows].sort((a, b) => a.score - b.score || a.delta - b.delta).slice(0, 5);
  return { top, bottom };
}

// === RECENT ACTIVITY =========================================================
export async function getRecentActivity(f: Filters, limit = 20) {
  const shifts = await fetchShiftsInRange(f, { onlyCompleted: true });
  shifts.sort((a: any, b: any) => {
    const da = `${a.shift_date}T${a.end_time}`;
    const db = `${b.shift_date}T${b.end_time}`;
    return db.localeCompare(da);
  });
  const recent = shifts.slice(0, limit);
  const userIds = Array.from(new Set(recent.map((s: any) => s.user_id).filter(Boolean))) as string[];
  const studioIds = Array.from(new Set(recent.map((s: any) => s.studio_id).filter(Boolean))) as string[];
  const [{ data: profs }, { data: studios }] = await Promise.all([
    userIds.length ? supabaseAdmin.from("profiles").select("id,first_name,last_name,avatar_url").in("id", userIds) : Promise.resolve({ data: [] as any[] }),
    studioIds.length ? supabaseAdmin.from("studios").select("id,name,short_name").in("id", studioIds) : Promise.resolve({ data: [] as any[] }),
  ]);
  const pmap = new Map((profs ?? []).map((p: any) => [p.id, p]));
  const smap = new Map((studios ?? []).map((s: any) => [s.id, s]));
  return recent.map((s: any) => {
    const p = pmap.get(s.user_id);
    const st = smap.get(s.studio_id);
    return {
      shiftId: s.id,
      userId: s.user_id,
      firstName: p?.first_name ?? "—", lastName: p?.last_name ?? "",
      avatarUrl: p?.avatar_url ?? null,
      businessRole: s.business_role,
      studioName: st?.short_name ?? st?.name ?? "—",
      shiftDate: s.shift_date,
      endTime: s.end_time,
    };
  });
}

// === EMPLOYEES REPORT ========================================================
export async function getEmployeesReport(f: Filters) {
  const cur = await fetchShiftsInRange(f, { onlyCompleted: true });
  const prev = previousPeriod(f.from, f.to);
  const prevShifts = await fetchShiftsInRange({ ...f, ...prev }, { onlyCompleted: true });

  const byUser = new Map<string, any[]>();
  for (const s of cur) { if (!s.user_id) continue; const a = byUser.get(s.user_id) ?? []; a.push(s); byUser.set(s.user_id, a); }
  const userIds = Array.from(byUser.keys());
  if (!userIds.length) return [];

  const { data: profs } = await supabaseAdmin
    .from("profiles").select("id,first_name,last_name,avatar_url,score,hourly_rate,studio_id,contract").in("id", userIds);
  const { data: studios } = await supabaseAdmin.from("studios").select("id,name,short_name");
  const smap = new Map((studios ?? []).map((s: any) => [s.id, s]));

  const { data: roleRowsRaw } = await supabaseAdmin.from("user_business_roles" as any).select("user_id,role").in("user_id", userIds);
  const roleRows = (roleRowsRaw ?? []) as Array<{ user_id: string; role: string }>;
  const rolesMap = new Map<string, string[]>();
  for (const r of roleRows) {
    const a = rolesMap.get(r.user_id) ?? []; a.push(r.role); rolesMap.set(r.user_id, a);
  }

  const prevByUser = new Map<string, number>();
  for (const s of prevShifts) {
    if (!s.user_id) continue;
    prevByUser.set(s.user_id, (prevByUser.get(s.user_id) ?? 0) + 1);
  }

  return (profs ?? []).map((p: any) => {
    const shifts = byUser.get(p.id) ?? [];
    const hours = shifts.reduce((acc, s) => acc + workedHours(s), 0);
    const cost = p.hourly_rate != null ? hours * Number(p.hourly_rate) : null;
    const lastClosure = shifts
      .map((s: any) => `${s.shift_date}T${s.end_time}`)
      .sort()
      .pop() ?? null;
    const prevCount = prevByUser.get(p.id) ?? 0;
    // simple proxy delta from score (not exact but useful)
    const score = Number(p.score ?? 0);
    return {
      userId: p.id,
      firstName: p.first_name, lastName: p.last_name, avatarUrl: p.avatar_url,
      roles: rolesMap.get(p.id) ?? [],
      studioName: smap.get(p.studio_id)?.short_name ?? smap.get(p.studio_id)?.name ?? "—",
      shifts: shifts.length,
      hours: +hours.toFixed(2),
      cost: cost == null ? null : +cost.toFixed(2),
      score: +score.toFixed(2),
      delta: shifts.length - prevCount,
      lastClosure,
      contract: p.contract,
      hourlyRate: p.hourly_rate,
    };
  }).sort((a, b) => b.score - a.score);
}

// === EMPLOYEE DETAIL =========================================================
export async function getEmployeeDetail(args: { userId: string; from: string; to: string }) {
  const { userId, from, to } = args;
  const { data: prof } = await supabaseAdmin
    .from("profiles").select("id,first_name,last_name,avatar_url,score,hourly_rate,contract,studio_id").eq("id", userId).maybeSingle();
  if (!prof) throw new Error("Employé introuvable");

  const { data: roleRows } = await supabaseAdmin.from("user_business_roles" as any).select("role").eq("user_id", userId);
  const roles = (roleRows ?? []).map((r: any) => r.role);

  // 90 days sparkline of completed shifts
  const sparkFrom = isoDate(addDays(new Date(to), -89));
  const { data: sparkShifts } = await supabaseAdmin
    .from("shifts").select("shift_date,status,minutes_late").eq("user_id", userId)
    .gte("shift_date", sparkFrom).lte("shift_date", to).eq("status", "completed");
  const sparkByDate = new Map<string, number>();
  for (let i = 0; i < 90; i++) sparkByDate.set(isoDate(addDays(new Date(sparkFrom), i)), 0);
  for (const s of sparkShifts ?? []) sparkByDate.set(s.shift_date, (sparkByDate.get(s.shift_date) ?? 0) + 1);
  const sparkline = Array.from(sparkByDate.entries()).map(([date, value]) => ({ date, value }));

  // Sub-scores: punctuality / manager rating / checklist
  const lateShifts = (sparkShifts ?? []);
  const lateScore = lateShifts.length
    ? +(lateShifts.reduce((acc: number, s: any) => {
        const m = s.minutes_late ?? 0;
        return acc + (m === 0 ? 10 : m <= 5 ? 9 : m <= 15 ? 7 : m <= 30 ? 4 : 1);
      }, 0) / lateShifts.length).toFixed(2)
    : 7;

  const { data: feedRows } = await supabaseAdmin
    .from("feedbacks").select("rating,shift_id").in("shift_id", (lateShifts ?? []).map((s: any) => s.id ?? "").filter(Boolean));
  const mgrScore = (feedRows ?? []).length
    ? +((feedRows ?? []).reduce((a: number, f: any) => a + Number(f.rating) * 2, 0) / (feedRows ?? []).length).toFixed(2)
    : 7;

  const { data: subs } = await supabaseAdmin
    .from("checklist_submissions").select("id").eq("user_id", userId).eq("status", "completed");
  const subIds = (subs ?? []).map((s: any) => s.id);
  let checklistScore = 7;
  if (subIds.length) {
    const { data: items } = await supabaseAdmin
      .from("checklist_submission_items").select("submission_id,is_checked").in("submission_id", subIds);
    const bySub = new Map<string, { total: number; done: number }>();
    for (const it of items ?? []) {
      const cur = bySub.get(it.submission_id) ?? { total: 0, done: 0 };
      cur.total++; if (it.is_checked) cur.done++;
      bySub.set(it.submission_id, cur);
    }
    const pcts = Array.from(bySub.values()).map((v) => v.total ? v.done / v.total : 0);
    checklistScore = pcts.length ? +(((pcts.reduce((a, b) => a + b, 0) / pcts.length) * 10).toFixed(2)) : 7;
  }

  // Last 10 shifts in period
  const { data: last } = await supabaseAdmin
    .from("shifts")
    .select("id,shift_date,start_time,end_time,studio_id,business_role,clocked_in_at,clocked_out_at,minutes_late,status")
    .eq("user_id", userId).gte("shift_date", from).lte("shift_date", to).eq("status", "completed")
    .order("shift_date", { ascending: false }).order("start_time", { ascending: false }).limit(10);
  const { data: studios } = await supabaseAdmin.from("studios").select("id,name,short_name");
  const smap = new Map((studios ?? []).map((s: any) => [s.id, s]));
  const lastShifts = (last ?? []).map((s: any) => ({
    id: s.id,
    date: s.shift_date,
    studio: smap.get(s.studio_id)?.short_name ?? smap.get(s.studio_id)?.name ?? "—",
    role: s.business_role,
    clockedIn: s.clocked_in_at, clockedOut: s.clocked_out_at,
    minutesLate: s.minutes_late ?? 0,
  }));

  // Earnings on period
  const periodShifts = await fetchShiftsInRange({ from, to, studioIds: [], roleIds: [] }, { onlyCompleted: true });
  const mine = periodShifts.filter((s: any) => s.user_id === userId);
  const totalHours = +mine.reduce((acc, s) => acc + workedHours(s), 0).toFixed(2);
  const earnings = prof.hourly_rate != null ? +(totalHours * Number(prof.hourly_rate)).toFixed(2) : null;

  // Student quota (week)
  let studentQuota: { used: number; max: number } | null = null;
  if (prof.contract === "student") {
    const today = new Date();
    const day = today.getDay(); // 0=sun
    const monday = addDays(today, day === 0 ? -6 : 1 - day);
    const sunday = addDays(monday, 6);
    const { data: weekShifts } = await supabaseAdmin
      .from("shifts").select("clocked_in_at,clocked_out_at").eq("user_id", userId)
      .gte("shift_date", isoDate(monday)).lte("shift_date", isoDate(sunday));
    const used = +(weekShifts ?? []).reduce((acc: number, s: any) => acc + workedHours(s), 0).toFixed(1);
    studentQuota = { used, max: 15 };
  }

  return {
    profile: {
      id: prof.id,
      firstName: prof.first_name, lastName: prof.last_name, avatarUrl: prof.avatar_url,
      score: Number(prof.score ?? 0), contract: prof.contract,
      hourlyRate: prof.hourly_rate, roles,
    },
    sparkline,
    breakdown: { punctuality: lateScore, manager: mgrScore, checklist: checklistScore },
    lastShifts,
    earnings, totalHours,
    studentQuota,
  };
}

// === SHIFTS REPORT ===========================================================
export async function getShiftsReport(f: Filters) {
  const shifts = await fetchShiftsInRange(f, { onlyCompleted: true });
  const userIds = Array.from(new Set(shifts.map((s: any) => s.user_id).filter(Boolean))) as string[];
  const studioIds = Array.from(new Set(shifts.map((s: any) => s.studio_id).filter(Boolean))) as string[];
  const [{ data: profs }, { data: studios }] = await Promise.all([
    userIds.length ? supabaseAdmin.from("profiles").select("id,first_name,last_name,avatar_url").in("id", userIds) : Promise.resolve({ data: [] as any[] }),
    studioIds.length ? supabaseAdmin.from("studios").select("id,name,short_name").in("id", studioIds) : Promise.resolve({ data: [] as any[] }),
  ]);
  const pmap = new Map((profs ?? []).map((p: any) => [p.id, p]));
  const smap = new Map((studios ?? []).map((s: any) => [s.id, s]));

  const shiftIds = shifts.map((s: any) => s.id);
  let subsBy = new Map<string, { items: number; done: number; photos: number; validated: number }>();
  if (shiftIds.length) {
    const { data: subs } = await supabaseAdmin
      .from("checklist_submissions").select("id,shift_id").in("shift_id", shiftIds);
    const subShift = new Map<string, string>((subs ?? []).map((s: any) => [s.id, s.shift_id]));
    const subIds = (subs ?? []).map((s: any) => s.id);
    if (subIds.length) {
      const { data: items } = await supabaseAdmin.from("checklist_submission_items").select("submission_id,is_checked").in("submission_id", subIds);
      const { data: photos } = await supabaseAdmin.from("checklist_submission_photos").select("submission_id,ai_validation_status").in("submission_id", subIds);
      for (const it of items ?? []) {
        const sId = subShift.get(it.submission_id); if (!sId) continue;
        const cur = subsBy.get(sId) ?? { items: 0, done: 0, photos: 0, validated: 0 };
        cur.items++; if (it.is_checked) cur.done++; subsBy.set(sId, cur);
      }
      for (const ph of photos ?? []) {
        const sId = subShift.get(ph.submission_id); if (!sId) continue;
        const cur = subsBy.get(sId) ?? { items: 0, done: 0, photos: 0, validated: 0 };
        cur.photos++; if (ph.ai_validation_status === "validated" || ph.ai_validation_status == null) cur.validated++;
        subsBy.set(sId, cur);
      }
    }
  }

  return shifts.map((s: any) => {
    const p = pmap.get(s.user_id);
    const st = smap.get(s.studio_id);
    const stats = subsBy.get(s.id) ?? { items: 0, done: 0, photos: 0, validated: 0 };
    return {
      id: s.id,
      date: s.shift_date,
      userId: s.user_id,
      firstName: p?.first_name ?? "—", lastName: p?.last_name ?? "",
      avatarUrl: p?.avatar_url ?? null,
      businessRole: s.business_role,
      studioName: st?.short_name ?? st?.name ?? "—",
      startTime: s.start_time, endTime: s.end_time,
      clockedIn: s.clocked_in_at, clockedOut: s.clocked_out_at,
      minutesLate: s.minutes_late ?? 0,
      checklistPct: stats.items ? Math.round((stats.done / stats.items) * 100) : null,
      photosValidated: stats.photos ? `${stats.validated}/${stats.photos}` : null,
      dimonaStatus: s.dimona_status ?? null,
    };
  }).sort((a, b) => `${b.date}T${b.endTime}`.localeCompare(`${a.date}T${a.endTime}`));
}

// === SHIFT DETAIL ============================================================
export async function getShiftDetail(args: { shiftId: string }) {
  const { shiftId } = args;
  const { data: shift } = await supabaseAdmin
    .from("shifts").select("*").eq("id", shiftId).maybeSingle();
  if (!shift) throw new Error("Shift introuvable");
  const [{ data: prof }, { data: studio }] = await Promise.all([
    shift.user_id ? supabaseAdmin.from("profiles").select("id,first_name,last_name,avatar_url,hourly_rate").eq("id", shift.user_id).maybeSingle() : Promise.resolve({ data: null }),
    shift.studio_id ? supabaseAdmin.from("studios").select("id,name,short_name").eq("id", shift.studio_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  // checklist submission
  const { data: sub } = await supabaseAdmin
    .from("checklist_submissions").select("id,template_id,status,employee_note").eq("shift_id", shiftId).maybeSingle();
  let templateItems: any[] = [];
  let itemRows: any[] = [];
  let templatePhotos: any[] = [];
  let photoRows: any[] = [];
  let responses: any[] = [];
  let questions: any[] = [];
  if (sub) {
    [{ data: templateItems = [] } as any, { data: itemRows = [] } as any, { data: templatePhotos = [] } as any, { data: photoRows = [] } as any, { data: responses = [] } as any] = await Promise.all([
      supabaseAdmin.from("checklist_template_items").select("id,label,order_index,photo_zone_id").eq("template_id", sub.template_id).order("order_index"),
      supabaseAdmin.from("checklist_submission_items").select("template_item_id,is_checked,checked_at").eq("submission_id", sub.id),
      supabaseAdmin.from("checklist_template_photos").select("id,label,order_index,reference_photo_url").eq("template_id", sub.template_id).order("order_index"),
      supabaseAdmin.from("checklist_submission_photos").select("template_photo_id,photo_url,ai_validation_status,ai_validation_message").eq("submission_id", sub.id),
      supabaseAdmin.from("closure_question_responses").select("question_id,stars_value,yesno_value,text_value").eq("submission_id", sub.id),
    ]);
  }
  if (shift.studio_id) {
    const { data: qs } = await supabaseAdmin
      .from("closure_questions").select("id,question_text,response_type,order_index").eq("studio_id", shift.studio_id).order("order_index");
    questions = qs ?? [];
  }

  const itemMap = new Map(itemRows.map((r: any) => [r.template_item_id, r]));
  const photoMap = new Map(photoRows.map((r: any) => [r.template_photo_id, r]));
  const respMap = new Map(responses.map((r: any) => [r.question_id, r]));

  // Worked / earnings
  const workedH = shift.clocked_in_at && shift.clocked_out_at
    ? (new Date(shift.clocked_out_at).getTime() - new Date(shift.clocked_in_at).getTime()) / 3600000 : 0;
  const earnings = prof?.hourly_rate != null ? +(workedH * Number(prof.hourly_rate)).toFixed(2) : null;

  // Sub-scores for this shift (mirror scoring rules in closure-flow.server.ts)
  const late = shift.minutes_late ?? 0;
  const ponctualite = late <= 0 ? 5 : late <= 5 ? 4 : late <= 15 ? 2 : late <= 30 ? 1 : 0;
  const totalItems = templateItems.length;
  const doneItems = itemRows.filter((r: any) => r.is_checked).length;
  const checklistPts = Math.round((totalItems ? doneItems / totalItems : 1) * 5);
  const totalPhotos = templatePhotos.length;
  const validatedPhotos = photoRows.filter((r: any) => r.ai_validation_status === "validated" || r.ai_validation_status == null).length;
  const photosPts = Math.round((totalPhotos ? validatedPhotos / totalPhotos : 1) * 5);

  return {
    shift: {
      id: shift.id, date: shift.shift_date,
      startTime: shift.start_time, endTime: shift.end_time,
      clockedIn: shift.clocked_in_at, clockedOut: shift.clocked_out_at,
      minutesLate: late, businessRole: shift.business_role,
      studioName: studio?.short_name ?? studio?.name ?? "—",
      dimonaStatus: shift.dimona_status ?? null,
      userId: shift.user_id,
    },
    profile: prof ? { id: prof.id, firstName: prof.first_name, lastName: prof.last_name, avatarUrl: prof.avatar_url } : null,
    checklist: templateItems.map((t: any) => {
      const row = itemMap.get(t.id);
      const photo = t.photo_zone_id ? photoMap.get(t.photo_zone_id) : null;
      return {
        id: t.id, label: t.label,
        checked: !!row?.is_checked, checkedAt: row?.checked_at ?? null,
        photoUrl: photo?.photo_url ?? null,
      };
    }),
    photos: templatePhotos.map((p: any) => {
      const row = photoMap.get(p.id);
      return {
        id: p.id, label: p.label,
        url: row?.photo_url ?? null,
        status: row?.ai_validation_status ?? null,
        reason: row?.ai_validation_message ?? null,
        reference: p.reference_photo_url ?? null,
      };
    }),
    closureResponses: questions.map((q: any) => {
      const r = respMap.get(q.id);
      return {
        id: q.id, text: q.question_text, type: q.response_type,
        stars: r?.stars_value ?? null,
        yesno: r?.yesno_value ?? null,
        free: r?.text_value ?? null,
        answered: !!r,
      };
    }),
    score: { ponctualite, checklist: checklistPts, photos: photosPts, total: ponctualite + checklistPts + photosPts },
    earnings,
    workedHours: +workedH.toFixed(2),
  };
}
