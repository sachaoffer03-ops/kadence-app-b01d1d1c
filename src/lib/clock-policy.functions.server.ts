import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  loadClockPolicy,
  computeMinutesLate,
  computeOutDeviation,
  clockInNeedsReason,
  clockOutNeedsReason,
  REASON_MIN_LENGTH,
} from "./clock-policy.server";

export async function getShiftClockPolicy(shiftId: string) {
  const { data: shift, error } = await supabaseAdmin
    .from("shifts")
    .select("id,studio_id,shift_date,start_time,end_time")
    .eq("id", shiftId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!shift) throw new Error("Shift introuvable");

  const policy = await loadClockPolicy(shift as any);
  const now = new Date();
  return {
    ...policy,
    reasonMinLength: REASON_MIN_LENGTH,
    minutesLate: computeMinutesLate(policy, now),
    outDeviationMin: computeOutDeviation(policy, now),
    clockInNeedsReason: clockInNeedsReason(policy, now),
    clockOutNeedsReason: clockOutNeedsReason(policy, now),
  };
}
