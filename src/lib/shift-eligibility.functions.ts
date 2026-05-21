import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const ok = data?.some((r: any) => r.role === "admin" || r.role === "manager");
  if (!ok) throw new Error("Action réservée aux admins/managers");
}

function timeToMin(t: string): number {
  const [h, m] = String(t).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

// ISO week (Monday → Sunday) bounding the date.
function isoWeekRange(dateStr: string): { start: string; end: string } {
  const d = new Date(dateStr + "T00:00:00Z");
  const day = d.getUTCDay() || 7; // Sun(0) -> 7
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - (day - 1));
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return { start: monday.toISOString().slice(0, 10), end: sunday.toISOString().slice(0, 10) };
}

export interface EligibleEmployee {
  id: string;
  first_name: string;
  last_name: string;
  score: number | null;
  contract: string | null;
  contracts: string[];
  business_roles: string[];
  has_role: boolean;
  has_studio: boolean;
  has_availability: boolean;
  is_saturated: boolean;
  weekly_hours: number;
  max_weekly_hours: number;
  pending_proposal: boolean;
  not_trained: boolean;
  untrained_courses: { id: string; title: string; icon: string | null }[];
  reasons: string[];
}

export const getEligibleEmployeesForShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ shiftId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { data: shift, error: e1 } = await supabaseAdmin
      .from("shifts")
      .select("id, shift_date, start_time, end_time, business_role, studio_id, user_id")
      .eq("id", data.shiftId)
      .single();
    if (e1) throw new Error(e1.message);

    const shiftStartM = timeToMin(shift.start_time);
    const shiftEndM = timeToMin(shift.end_time);
    const shiftDurH = Math.max(0, (shiftEndM - shiftStartM) / 60);
    const { start: weekStart, end: weekEnd } = isoWeekRange(shift.shift_date);

    const [
      { data: profiles },
      { data: ubr },
      { data: us },
      { data: uc },
      { data: avail },
      { data: weekShifts },
      { data: pendingProps },
      { data: settingsRows },
    ] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, first_name, last_name, score, contract")
        .eq("status", "active"),
      supabaseAdmin.from("user_business_roles").select("user_id, role"),
      supabaseAdmin.from("user_studios").select("user_id, studio_id"),
      supabaseAdmin.from("user_contracts").select("user_id, contract"),
      supabaseAdmin
        .from("availabilities")
        .select("user_id, start_time, end_time")
        .eq("avail_date", shift.shift_date),
      supabaseAdmin
        .from("shifts")
        .select("user_id, start_time, end_time")
        .gte("shift_date", weekStart)
        .lte("shift_date", weekEnd)
        .not("user_id", "is", null),
      supabaseAdmin
        .from("shift_proposals")
        .select("user_id")
        .eq("shift_id", data.shiftId)
        .eq("status", "pending"),
      supabaseAdmin
        .from("ai_planning_settings")
        .select("max_weekly_cdi_hours, max_weekly_student_hours, max_weekly_flexi_hours")
        .limit(1),
    ]);

    const settings = settingsRows?.[0] || {
      max_weekly_cdi_hours: 48,
      max_weekly_student_hours: 15,
      max_weekly_flexi_hours: 20,
    };

    const rolesByUser = new Map<string, string[]>();
    (ubr || []).forEach((r: any) => {
      const a = rolesByUser.get(r.user_id) || [];
      a.push(r.role);
      rolesByUser.set(r.user_id, a);
    });
    const studiosByUser = new Map<string, string[]>();
    (us || []).forEach((r: any) => {
      const a = studiosByUser.get(r.user_id) || [];
      a.push(r.studio_id);
      studiosByUser.set(r.user_id, a);
    });
    const contractsByUser = new Map<string, string[]>();
    (uc || []).forEach((r: any) => {
      const a = contractsByUser.get(r.user_id) || [];
      a.push(r.contract);
      contractsByUser.set(r.user_id, a);
    });
    const availByUser = new Map<string, Array<{ start: number; end: number }>>();
    (avail || []).forEach((r: any) => {
      const a = availByUser.get(r.user_id) || [];
      a.push({ start: timeToMin(r.start_time), end: timeToMin(r.end_time) });
      availByUser.set(r.user_id, a);
    });
    const hoursByUser = new Map<string, number>();
    (weekShifts || []).forEach((s: any) => {
      const h = Math.max(0, (timeToMin(s.end_time) - timeToMin(s.start_time)) / 60);
      hoursByUser.set(s.user_id, (hoursByUser.get(s.user_id) || 0) + h);
    });
    const pendingSet = new Set<string>((pendingProps || []).map((p: any) => p.user_id));

    const maxForContract = (c: string | null): number => {
      if (c === "student") return Number(settings.max_weekly_student_hours);
      if (c === "flexi") return Number(settings.max_weekly_flexi_hours);
      return Number(settings.max_weekly_cdi_hours);
    };

    const eligible: EligibleEmployee[] = [];
    const partial: EligibleEmployee[] = [];

    for (const p of profiles || []) {
      const roles = rolesByUser.get(p.id) || [];
      const has_role = roles.includes(shift.business_role);
      if (!has_role) continue; // ignore les profils sans le rôle demandé

      const studios = studiosByUser.get(p.id) || [];
      const has_studio =
        studios.length === 0 || !shift.studio_id || studios.includes(shift.studio_id);

      const availList = availByUser.get(p.id) || [];
      const has_availability = availList.some(
        (a) => a.start <= shiftStartM && a.end >= shiftEndM,
      );

      const weekly = hoursByUser.get(p.id) || 0;
      const cap = maxForContract(p.contract);
      const is_saturated = weekly + shiftDurH > cap;
      const pending_proposal = pendingSet.has(p.id);

      const reasons: string[] = [];
      if (!has_studio) reasons.push("pas rattaché au studio");
      if (!has_availability) reasons.push("aucune dispo sur le créneau");
      if (is_saturated)
        reasons.push(`saturé ${weekly.toFixed(1)}h/${cap}h cette semaine`);

      const row: EligibleEmployee = {
        id: p.id,
        first_name: p.first_name || "",
        last_name: p.last_name || "",
        score: p.score !== null ? Number(p.score) : null,
        contract: p.contract,
        contracts: contractsByUser.get(p.id) || (p.contract ? [p.contract] : []),
        business_roles: roles,
        has_role,
        has_studio,
        has_availability,
        is_saturated,
        weekly_hours: Number(weekly.toFixed(2)),
        max_weekly_hours: cap,
        pending_proposal,
        reasons,
      };

      if (has_studio && has_availability && !is_saturated) eligible.push(row);
      else partial.push(row);
    }

    const byScore = (a: EligibleEmployee, b: EligibleEmployee) =>
      (b.score ?? -1) - (a.score ?? -1);
    eligible.sort(byScore);
    partial.sort(byScore);

    return {
      shift: {
        id: shift.id,
        shift_date: shift.shift_date,
        start_time: shift.start_time,
        end_time: shift.end_time,
        business_role: shift.business_role,
        studio_id: shift.studio_id,
      },
      eligible,
      partial,
    };
  });
