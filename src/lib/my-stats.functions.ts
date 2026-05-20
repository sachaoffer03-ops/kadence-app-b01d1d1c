import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Helpers dates
function isoDate(d: Date): string { return d.toISOString().slice(0, 10); }
function startOfMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function startOfPrevMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth() - 1, 1); }
function endOfPrevMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), 0); }
// Lundi de la semaine ISO contenant d
function startOfIsoWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = x.getDay() || 7; // Sun = 0 -> 7
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
  // "HH:MM:SS" -> heures décimales
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(0, ((eh * 60 + em) - (sh * 60 + sm)) / 60);
}

export const getMyStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // 1. Profil : hourly_rate, contract, score, hire_date
    const { data: profile } = await supabase
      .from("profiles")
      .select("hourly_rate, contract, score, hire_date")
      .eq("id", userId)
      .maybeSingle();

    const hourlyRate = profile?.hourly_rate !== null && profile?.hourly_rate !== undefined
      ? Number(profile.hourly_rate)
      : null;
    const isStudent = profile?.contract === "Étudiant";
    const currentScore = profile?.score !== null && profile?.score !== undefined
      ? Number(profile.score)
      : 7;

    const today = new Date();
    const monthStart = isoDate(startOfMonth(today));
    const monthEnd = isoDate(endOfMonth(today));
    const prevMonthStart = isoDate(startOfPrevMonth(today));
    const prevMonthEnd = isoDate(endOfPrevMonth(today));
    const weekStart = isoDate(startOfIsoWeek(today));
    const weekEnd = isoDate(endOfIsoWeek(today));

    // 2. Shifts du mois courant (completed avec pointage)
    const { data: monthShifts } = await supabase
      .from("shifts")
      .select("clocked_in_at, clocked_out_at")
      .eq("user_id", userId)
      .eq("status", "completed")
      .not("clocked_in_at", "is", null)
      .not("clocked_out_at", "is", null)
      .gte("shift_date", monthStart)
      .lte("shift_date", monthEnd);

    const monthMinutes = (monthShifts ?? []).reduce(
      (sum, s) => sum + minutesBetween(s.clocked_in_at, s.clocked_out_at), 0,
    );
    const currentMonthEarnings = hourlyRate !== null
      ? Math.round((monthMinutes / 60) * hourlyRate * 100) / 100
      : 0;

    // 3. Mois précédent
    const { data: prevMonthShifts } = await supabase
      .from("shifts")
      .select("clocked_in_at, clocked_out_at")
      .eq("user_id", userId)
      .eq("status", "completed")
      .not("clocked_in_at", "is", null)
      .not("clocked_out_at", "is", null)
      .gte("shift_date", prevMonthStart)
      .lte("shift_date", prevMonthEnd);

    const prevMonthMinutes = (prevMonthShifts ?? []).reduce(
      (sum, s) => sum + minutesBetween(s.clocked_in_at, s.clocked_out_at), 0,
    );
    const previousMonthEarnings = hourlyRate !== null
      ? Math.round((prevMonthMinutes / 60) * hourlyRate * 100) / 100
      : 0;

    // 4. Semaine en cours : worked (clocké) + scheduled (planifié restant)
    const { data: weekShifts } = await supabase
      .from("shifts")
      .select("shift_date, start_time, end_time, status, clocked_in_at, clocked_out_at")
      .eq("user_id", userId)
      .gte("shift_date", weekStart)
      .lte("shift_date", weekEnd);

    let workedMin = 0;
    let scheduledMin = 0;
    for (const s of weekShifts ?? []) {
      if (s.clocked_in_at && s.clocked_out_at) {
        workedMin += minutesBetween(s.clocked_in_at, s.clocked_out_at);
      } else if (s.status !== "cancelled") {
        scheduledMin += Math.round(hoursBetweenTime(s.start_time, s.end_time) * 60);
      }
    }
    const workedHours = Math.round((workedMin / 60) * 10) / 10;
    const scheduledHours = Math.round((scheduledMin / 60) * 10) / 10;
    const totalWeek = Math.round((workedHours + scheduledHours) * 10) / 10;
    const studentLimit = 15;
    const percentUsed = isStudent
      ? Math.min(100, Math.round((totalWeek / studentLimit) * 100))
      : 0;

    // 5. Dimona du dernier shift complété
    const { data: lastCompleted } = await supabase
      .from("shifts")
      .select("shift_date, dimona_status")
      .eq("user_id", userId)
      .eq("status", "completed")
      .order("shift_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 6. Carrière (tous les shifts pointés)
    const { data: careerShifts } = await supabase
      .from("shifts")
      .select("clocked_in_at, clocked_out_at")
      .eq("user_id", userId)
      .eq("status", "completed")
      .not("clocked_in_at", "is", null)
      .not("clocked_out_at", "is", null);

    let careerMin = 0;
    for (const s of careerShifts ?? []) {
      careerMin += minutesBetween(s.clocked_in_at, s.clocked_out_at);
    }
    const totalHoursWorked = Math.round((careerMin / 60) * 10) / 10;
    const totalEarnings = hourlyRate !== null
      ? Math.round((careerMin / 60) * hourlyRate * 100) / 100
      : 0;

    // 7. Sparkline 30j : on calcule la ponctualité quotidienne sur 30 jours
    // Approche simplifiée : pour chaque jour, moyenne des pscores des shifts <= ce jour (60 derniers)
    const dayMs = 86_400_000;
    const lambda = 0.01;
    const { data: punctShifts } = await supabase
      .from("shifts")
      .select("shift_date, end_time, minutes_late, published_at")
      .eq("user_id", userId)
      .lte("shift_date", isoDate(today))
      .order("shift_date", { ascending: false })
      .limit(60);

    const recent: { shift_date: string; pscore: number | null }[] = [];
    const now = Date.now();
    for (const sh of punctShifts ?? []) {
      const ml = sh.minutes_late;
      const past = new Date(`${sh.shift_date}T${sh.end_time}`).getTime() < now;
      let pscore: number | null = null;
      if (ml === null && sh.published_at && past) pscore = 0;
      else if (ml === null) pscore = null;
      else if (ml === 0) pscore = 10;
      else if (ml <= 5) pscore = 9;
      else if (ml <= 15) pscore = 7;
      else if (ml <= 30) pscore = 4;
      else pscore = 1;
      recent.push({ shift_date: sh.shift_date, pscore });
    }
    const sparkline30d: number[] = [];
    const todayIso = isoDate(today);
    for (let i = 29; i >= 0; i--) {
      const d = isoDate(new Date(now - i * dayMs));
      const before = recent.filter((r) => r.shift_date <= d && r.pscore !== null);
      if (before.length === 0) { sparkline30d.push(currentScore); continue; }
      let num = 0, den = 0;
      for (const r of before) {
        const days = Math.max(0, (Date.parse(d) - Date.parse(r.shift_date)) / dayMs);
        const w = Math.exp(-lambda * days);
        num += (r.pscore as number) * w;
        den += w;
      }
      sparkline30d.push(Math.round((den > 0 ? num / den : currentScore) * 10) / 10);
    }
    // garde une variation autour du score réel
    void todayIso;

    return {
      earnings: {
        currentMonth: currentMonthEarnings,
        previousMonth: previousMonthEarnings,
        delta: Math.round((currentMonthEarnings - previousMonthEarnings) * 100) / 100,
        hasRate: hourlyRate !== null,
      },
      weekHours: {
        worked: workedHours,
        scheduled: scheduledHours,
        total: totalWeek,
        isStudent,
        studentLimit,
        percentUsed,
      },
      lastShiftDimona: {
        status: (lastCompleted?.dimona_status ?? null) as
          "pending" | "sent" | "failed" | "not_applicable" | null,
        shiftDate: lastCompleted?.shift_date ?? null,
      },
      career: {
        totalShiftsCompleted: careerShifts?.length ?? 0,
        totalHoursWorked,
        totalEarnings,
        hasRate: hourlyRate !== null,
      },
      score: {
        current: Math.round(currentScore * 10) / 10,
        sparkline30d,
      },
    };
  });
