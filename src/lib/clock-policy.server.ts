import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { brusselsWallTimeDate } from "./brussels-time";

export const REASON_MIN_LENGTH = 5;

export type ClockPolicy = {
  /** Tolérance de retard à l'arrivée (min après l'heure de début) */
  graceInMin: number;
  /** Sortie autorisée sans motif à partir de X min avant la fin prévue */
  earlyOutWindowMin: number;
  /** Sortie tolérée jusqu'à X min après la fin prévue */
  graceOutMin: number;
  startAtISO: string;
  endAtISO: string;
};

function wallTime(dateISO: string, time: string) {
  const [y, m, d] = dateISO.split("-").map(Number);
  const [hh, mm] = (time ?? "00:00:00").split(":").map(Number);
  return brusselsWallTimeDate(y!, m!, d!, hh ?? 0, mm ?? 0);
}

/** Politique de pointage du studio, lue en direct (les réglages /cloture s'appliquent immédiatement). */
export async function loadClockPolicy(shift: {
  studio_id: string | null;
  shift_date: string;
  start_time: string;
  end_time: string;
}): Promise<ClockPolicy> {
  let graceInMin = 15;
  let earlyOutWindowMin = 15;
  let graceOutMin = 20;

  if (shift.studio_id) {
    const { data: studio } = await supabaseAdmin
      .from("studios")
      .select("clock_in_grace_period_min, clock_out_button_appears_before_min, clock_out_grace_period_min")
      .eq("id", shift.studio_id)
      .maybeSingle();
    if (studio) {
      graceInMin = (studio as any).clock_in_grace_period_min ?? graceInMin;
      earlyOutWindowMin = (studio as any).clock_out_button_appears_before_min ?? earlyOutWindowMin;
      graceOutMin = (studio as any).clock_out_grace_period_min ?? graceOutMin;
    }
  }

  return {
    graceInMin,
    earlyOutWindowMin,
    graceOutMin,
    startAtISO: wallTime(shift.shift_date, shift.start_time).toISOString(),
    endAtISO: wallTime(shift.shift_date, shift.end_time).toISOString(),
  };
}

/** Minutes de retard à l'arrivée (0 si à l'heure ou en avance). */
export function computeMinutesLate(policy: ClockPolicy, at: Date = new Date()) {
  return Math.max(0, Math.floor((at.getTime() - new Date(policy.startAtISO).getTime()) / 60_000));
}

/** Écart de sortie en minutes : négatif = parti plus tôt, positif = parti plus tard. */
export function computeOutDeviation(policy: ClockPolicy, at: Date = new Date()) {
  return Math.round((at.getTime() - new Date(policy.endAtISO).getTime()) / 60_000);
}

export function clockInNeedsReason(policy: ClockPolicy, at: Date = new Date()) {
  return computeMinutesLate(policy, at) > policy.graceInMin;
}

export function clockOutNeedsReason(policy: ClockPolicy, at: Date = new Date()) {
  const dev = computeOutDeviation(policy, at);
  return dev < -policy.earlyOutWindowMin || dev > policy.graceOutMin;
}

export function cleanReason(raw?: string | null) {
  const t = (raw ?? "").trim();
  return t.length >= REASON_MIN_LENGTH ? t.slice(0, 500) : null;
}
