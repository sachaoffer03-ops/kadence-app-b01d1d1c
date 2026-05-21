import { Bell, Calendar, Clock, FileText, GraduationCap, MessageSquare, Timer, type LucideIcon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

export type NotifPriority = "urgent" | "normal" | "info";
export type NotifCategory = "planning" | "shift" | "training" | "request" | "document" | "pointage" | "general";

export const NOTIF_CATEGORY_META: Record<NotifCategory, { icon: LucideIcon; color: string; label: string }> = {
  planning: { icon: Calendar, color: "var(--coral)", label: "Planning" },
  shift: { icon: Clock, color: "#4338CA", label: "Shift" },
  training: { icon: GraduationCap, color: "#10B981", label: "Formation" },
  request: { icon: MessageSquare, color: "#F59E0B", label: "Demande" },
  document: { icon: FileText, color: "#6B7280", label: "Document" },
  pointage: { icon: Timer, color: "#EC4899", label: "Pointage" },
  general: { icon: Bell, color: "var(--muted-foreground)", label: "Général" },
};

export const NOTIF_PRIORITY_META: Record<NotifPriority, { color: string; label: string }> = {
  urgent: { color: "#DC2626", label: "Urgent" },
  normal: { color: "var(--coral)", label: "Important" },
  info: { color: "var(--muted-foreground)", label: "Info" },
};

export function getCategoryMeta(category: string | null | undefined) {
  const c = (category || "general") as NotifCategory;
  return NOTIF_CATEGORY_META[c] ?? NOTIF_CATEGORY_META.general;
}

export function getPriorityMeta(priority: string | null | undefined) {
  const p = (priority || "normal") as NotifPriority;
  return NOTIF_PRIORITY_META[p] ?? NOTIF_PRIORITY_META.normal;
}

export function formatRelativeFr(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60_000) return "à l'instant";
    return "il y a " + formatDistanceToNow(new Date(iso), { locale: fr });
  } catch {
    return "";
  }
}

export function formatAbsoluteFr(iso: string): string {
  try {
    return new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

// CTA label by category for employee widget
export function getCategoryCta(category: string | null | undefined): string {
  switch ((category || "general") as NotifCategory) {
    case "training": return "Voir le parcours";
    case "shift": return "Voir le shift";
    case "request": return "Voir la décision";
    case "document": return "Voir le document";
    case "pointage": return "Voir le détail";
    case "planning": return "Voir le planning";
    default: return "Voir";
  }
}
