// Helpers partagés pour les pages connectées à Supabase
import type { Database } from "@/integrations/supabase/types";

export type BusinessRole = Database["public"]["Enums"]["business_role"];

export const roleStyle: Record<string, { bg: string; text: string; dot: string }> = {
  Barista: { bg: "var(--coral-light)", text: "var(--coral-text)", dot: "var(--coral)" },
  Accueil: { bg: "#DDF2EF", text: "#0F4F47", dot: "#2BA89A" },
  Host: { bg: "#EDE7F6", text: "#3D2B79", dot: "#7E57C2" },
  Cuisine: { bg: "#FCE4EC", text: "#7A1F44", dot: "#E91E63" },
  manager: { bg: "var(--muted)", text: "var(--foreground)", dot: "var(--foreground)" },
};

export function getRoleStyle(role: string | null | undefined) {
  return roleStyle[role || ""] || roleStyle.Barista;
}

export const initials = (first?: string | null, last?: string | null) =>
  `${(first?.[0] || "").toUpperCase()}${(last?.[0] || "").toUpperCase()}` || "?";

export const fullName = (p: { first_name?: string | null; last_name?: string | null } | null | undefined) =>
  p ? `${p.first_name || ""} ${p.last_name || ""}`.trim() || "—" : "—";

export const hhmm = (t?: string | null) => (t ? t.slice(0, 5).replace(":", "h") : "—");

export const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
