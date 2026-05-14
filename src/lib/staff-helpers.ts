// Helpers partagés pour les pages connectées à Supabase.
// Les rôles métier sont éditables côté admin (table business_roles).
// On dérive le style à partir de la couleur stockée en DB via le cache du hook.
import { getRoleColor } from "@/hooks/use-business-roles";

export type BusinessRole = string;

// Mélange une couleur hex avec du blanc pour produire un fond clair.
function tint(hex: string, alpha = 0.18): string {
  return `color-mix(in oklab, ${hex} ${Math.round(alpha * 100)}%, white)`;
}
function darken(hex: string, ratio = 0.55): string {
  return `color-mix(in oklab, ${hex} ${Math.round(ratio * 100)}%, black)`;
}

export function getRoleStyle(role: string | null | undefined) {
  if (role === "manager") {
    return { bg: "var(--muted)", text: "var(--foreground)", dot: "var(--foreground)" };
  }
  const c = getRoleColor(role, "#888");
  return { bg: tint(c, 0.18), text: darken(c, 0.55), dot: c };
}

export const initials = (first?: string | null, last?: string | null) =>
  `${(first?.[0] || "").toUpperCase()}${(last?.[0] || "").toUpperCase()}` || "?";

export const fullName = (p: { first_name?: string | null; last_name?: string | null } | null | undefined) =>
  p ? `${p.first_name || ""} ${p.last_name || ""}`.trim() || "—" : "—";

export const hhmm = (t?: string | null) => (t ? t.slice(0, 5).replace(":", "h") : "—");

export const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });

// ----- Ponctualité -----
// Calcule un % à partir des heures prévues vs pointées.
// Toute déviation (avance ou retard) à l'IN ou à l'OUT compte comme "minutes perdues".
// Si l'employé pointe pile aux deux bornes -> 100%.
function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}
function dateTimeToMinutes(date: string, time: string): number {
  // minutes depuis l'epoch local
  const d = new Date(`${date}T${time.length === 5 ? time + ":00" : time}`);
  return Math.round(d.getTime() / 60000);
}
function isoToMinutes(iso: string): number {
  return Math.round(new Date(iso).getTime() / 60000);
}

export function computePunctuality(shift: {
  shift_date: string; start_time: string; end_time: string;
  clocked_in_at: string | null; clocked_out_at: string | null;
}): number | null {
  if (!shift.clocked_in_at || !shift.clocked_out_at) return null;
  const startMin = dateTimeToMinutes(shift.shift_date, shift.start_time);
  const endMin = dateTimeToMinutes(shift.shift_date, shift.end_time);
  const total = endMin - startMin;
  if (total <= 0) return null;
  const inDev = Math.abs(isoToMinutes(shift.clocked_in_at) - startMin);
  const outDev = Math.abs(isoToMinutes(shift.clocked_out_at) - endMin);
  const lost = inDev + outDev;
  const pct = 100 - (lost / total) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

// Pour l'affichage en cours (clocked_in mais pas encore clocked_out)
export function computePartialPunctuality(shift: {
  shift_date: string; start_time: string;
  clocked_in_at: string | null;
}): number | null {
  if (!shift.clocked_in_at) return null;
  const startMin = dateTimeToMinutes(shift.shift_date, shift.start_time);
  const inDev = Math.abs(isoToMinutes(shift.clocked_in_at) - startMin);
  // arbitraire : 60 min de déviation = 0%
  const pct = 100 - (inDev / 60) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

export function punctualityColor(pct: number): string {
  if (pct >= 95) return "var(--success-text)";
  if (pct >= 85) return "var(--foreground)";
  if (pct >= 70) return "var(--warning-text)";
  return "var(--danger-text)";
}
// Suffix utilisé pour les minutes rapportées
export { timeToMinutes };
