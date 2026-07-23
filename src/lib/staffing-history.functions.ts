import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type StaffingHistoryRow = {
  month: string; // YYYY-MM
  totalHours: number;
  hoursPerWeek: number;
  weeks: number;
  avgEmpPerDay: number;
  activeDays: number;
};

function getIsoWeek(d: Date): string {
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((dt.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${dt.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export const getStaffingHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ studioId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<StaffingHistoryRow[]> => {
    const { supabase } = context;
    const { data: shifts, error } = await supabase
      .from("shifts")
      .select("shift_date, start_time, end_time, user_id")
      .eq("studio_id", data.studioId)
      .order("shift_date", { ascending: false });
    if (error) throw new Error(error.message);

    const byMonth = new Map<
      string,
      { minutes: number; weeks: Set<string>; dayEmployees: Map<string, Set<string>> }
    >();

    for (const s of shifts ?? []) {
      if (!s.shift_date || !s.start_time || !s.end_time) continue;
      const d = new Date(s.shift_date);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const [sh, sm] = s.start_time.slice(0, 5).split(":").map(Number);
      const [eh, em] = s.end_time.slice(0, 5).split(":").map(Number);
      const mins = Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
      const isoWeek = getIsoWeek(d);
      let m = byMonth.get(monthKey);
      if (!m) {
        m = { minutes: 0, weeks: new Set(), dayEmployees: new Map() };
        byMonth.set(monthKey, m);
      }
      m.minutes += mins;
      m.weeks.add(isoWeek);
      let ds = m.dayEmployees.get(s.shift_date);
      if (!ds) {
        ds = new Set();
        m.dayEmployees.set(s.shift_date, ds);
      }
      if (s.user_id) ds.add(s.user_id);
    }

    return Array.from(byMonth.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([month, v]) => {
        const totalHours = Math.round((v.minutes / 60) * 10) / 10;
        const weeks = Math.max(1, v.weeks.size);
        const hoursPerWeek = Math.round((totalHours / weeks) * 10) / 10;
        const activeDays = v.dayEmployees.size;
        const totalEmpDays = Array.from(v.dayEmployees.values()).reduce((a, set) => a + set.size, 0);
        const avgEmpPerDay = activeDays > 0
          ? Math.round((totalEmpDays / activeDays) * 10) / 10
          : 0;
        return { month, totalHours, hoursPerWeek, weeks, avgEmpPerDay, activeDays };
      });
  });
