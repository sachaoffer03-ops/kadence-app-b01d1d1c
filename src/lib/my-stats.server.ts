// Server-only helper: compute employee stats (earnings/hours/dimona/career/score).
// Shared between getMyStats (self) and getEmployeeStats (admin/manager).
import { computeScoreBreakdown } from "./scoring.server";

type AnySupabase = any;

function isoDate(d: Date): string { return d.toISOString().slice(0, 10); }
function startOfMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function startOfPrevMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth() - 1, 1); }
function endOfPrevMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), 0); }
function startOfIsoWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = x.getDay() || 7;
  if (day !== 1) x.setDate(x.getDate() - (day - 1));
  return x;
}
function endOfIsoWeek(d: Date): Date {
  const s = startOfIsoWeek(d);
  const e = new Date(s); e.setDate(s.getDate() + 6);
  return e;
}
function minutesBetween(a: string | null, b: string | null): number {
  if (!a || !b) return 0;
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000));
}
function hoursBetweenTime(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(0, ((eh * 60 + em) - (sh * 60 + sm)) / 60);
}

export async function computeStatsForUser(supabase: AnySupabase, userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("hourly_rate, contract, score, hire_date")
    .eq("id", userId)
    .maybeSingle();

  const hourlyRate = profile?.hourly_rate !== null && profile?.hourly_rate !== undefined
    ? Number(profile.hourly_rate) : null;
  const isStudent = profile?.contract === "Étudiant";
  const currentScore = profile?.score !== null && profile?.score !== undefined
    ? Number(profile.score) : 7;

  const today = new Date();
  const monthStart = isoDate(startOfMonth(today));
  const monthEnd = isoDate(endOfMonth(today));
  const prevMonthStart = isoDate(startOfPrevMonth(today));
  const prevMonthEnd = isoDate(endOfPrevMonth(today));
  const weekStart = isoDate(startOfIsoWeek(today));
  const weekEnd = isoDate(endOfIsoWeek(today));

  const { data: monthShifts } = await supabase
    .from("shifts")
    .select("clocked_in_at, clocked_out_at")
    .eq("user_id", userId).eq("status", "completed")
    .not("clocked_in_at", "is", null).not("clocked_out_at", "is", null)
    .gte("shift_date", monthStart).lte("shift_date", monthEnd);
  const monthMinutes = (monthShifts ?? []).reduce(
    (sum: number, s: any) => sum + minutesBetween(s.clocked_in_at, s.clocked_out_at), 0);
  const currentMonthEarnings = hourlyRate !== null
    ? Math.round((monthMinutes / 60) * hourlyRate * 100) / 100 : 0;

  const { data: prevMonthShifts } = await supabase
    .from("shifts")
    .select("clocked_in_at, clocked_out_at")
    .eq("user_id", userId).eq("status", "completed")
    .not("clocked_in_at", "is", null).not("clocked_out_at", "is", null)
    .gte("shift_date", prevMonthStart).lte("shift_date", prevMonthEnd);
  const prevMonthMinutes = (prevMonthShifts ?? []).reduce(
    (sum: number, s: any) => sum + minutesBetween(s.clocked_in_at, s.clocked_out_at), 0);
  const previousMonthEarnings = hourlyRate !== null
    ? Math.round((prevMonthMinutes / 60) * hourlyRate * 100) / 100 : 0;

  const { data: weekShifts } = await supabase
    .from("shifts")
    .select("shift_date, start_time, end_time, status, clocked_in_at, clocked_out_at")
    .eq("user_id", userId)
    .gte("shift_date", weekStart).lte("shift_date", weekEnd);

  let workedMin = 0, scheduledMin = 0;
  for (const s of weekShifts ?? []) {
    if (s.clocked_in_at && s.clocked_out_at) {
      workedMin += minutesBetween(s.clocked_in_at, s.clocked_out_at);
    } else if (s.status === "scheduled" || s.status === "open") {
      scheduledMin += Math.round(hoursBetweenTime(s.start_time, s.end_time) * 60);
    }
  }
  const workedHours = Math.round((workedMin / 60) * 10) / 10;
  const scheduledHours = Math.round((scheduledMin / 60) * 10) / 10;
  const totalWeek = Math.round((workedHours + scheduledHours) * 10) / 10;
  const studentLimit = 15;
  const percentUsed = isStudent ? Math.min(100, Math.round((totalWeek / studentLimit) * 100)) : 0;

  const { data: lastCompleted } = await supabase
    .from("shifts")
    .select("shift_date, dimona_status")
    .eq("user_id", userId).eq("status", "completed")
    .order("shift_date", { ascending: false }).limit(1).maybeSingle();

  const { data: careerShifts } = await supabase
    .from("shifts")
    .select("clocked_in_at, clocked_out_at")
    .eq("user_id", userId).eq("status", "completed")
    .not("clocked_in_at", "is", null).not("clocked_out_at", "is", null);

  let careerMin = 0;
  for (const s of careerShifts ?? []) {
    careerMin += minutesBetween(s.clocked_in_at, s.clocked_out_at);
  }
  const totalHoursWorked = Math.round((careerMin / 60) * 10) / 10;
  const totalEarnings = hourlyRate !== null
    ? Math.round((careerMin / 60) * hourlyRate * 100) / 100 : 0;

  // Sparkline 30j : réutilise l'évolution complète de getScoreBreakdown
  const breakdown = await computeScoreBreakdown(supabase, userId);
  const sparkline30d = breakdown.evolution.slice(-30).map((p) => p.score);

  return {
    earnings: {
      currentMonth: currentMonthEarnings,
      previousMonth: previousMonthEarnings,
      delta: Math.round((currentMonthEarnings - previousMonthEarnings) * 100) / 100,
      hasRate: hourlyRate !== null,
    },
    weekHours: {
      worked: workedHours, scheduled: scheduledHours, total: totalWeek,
      isStudent, studentLimit, percentUsed,
    },
    lastShiftDimona: {
      status: (lastCompleted?.dimona_status ?? null) as
        "pending" | "sent" | "failed" | "not_applicable" | null,
      shiftDate: lastCompleted?.shift_date ?? null,
    },
    career: {
      totalShiftsCompleted: careerShifts?.length ?? 0,
      totalHoursWorked, totalEarnings, hasRate: hourlyRate !== null,
    },
    score: {
      current: Math.round(currentScore * 10) / 10,
      sparkline30d,
    },
  };
}

export async function computeAdminExtras(supabase: AnySupabase, userId: string) {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);

  const { data: lateShifts } = await supabase
    .from("shifts")
    .select("id")
    .eq("user_id", userId)
    .gte("shift_date", since)
    .gt("minutes_late", 0);
  const retards30d = lateShifts?.length ?? 0;

  // Submissions des 30 derniers jours avec au moins un item non coché
  const { data: recentShifts } = await supabase
    .from("shifts")
    .select("id")
    .eq("user_id", userId)
    .gte("shift_date", since);
  const recentShiftIds = (recentShifts ?? []).map((s: any) => s.id);
  let subs: any[] = [];
  if (recentShiftIds.length > 0) {
    const { data } = await supabase
      .from("checklist_submissions")
      .select("id")
      .eq("user_id", userId)
      .in("shift_id", recentShiftIds);
    subs = data ?? [];
  }
  const subIds = (subs ?? []).map((s: any) => s.id);
  let checklistsIncomplete30d = 0;
  if (subIds.length > 0) {
    const { data: items } = await supabase
      .from("checklist_submission_items")
      .select("submission_id, is_checked")
      .in("submission_id", subIds);
    const incompletes = new Set<string>();
    for (const it of items ?? []) {
      if (!it.is_checked) incompletes.add(it.submission_id);
    }
    checklistsIncomplete30d = incompletes.size;
  }

  return { retards30d, checklistsIncomplete30d };
}
