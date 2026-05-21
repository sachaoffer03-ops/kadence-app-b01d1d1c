import { Check, ChevronRight } from "lucide-react";
import { getCategoryMeta, getPriorityMeta, formatRelativeFr, formatAbsoluteFr } from "@/lib/notifications-meta";

export interface NotifRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
  priority: string | null;
  category: string | null;
}

interface Props {
  notif: NotifRow;
  onClick?: () => void;
  onToggleRead?: () => void;
  compact?: boolean;
  showActions?: boolean;
}

export function NotificationItem({ notif, onClick, onToggleRead, compact = false, showActions = false }: Props) {
  const cat = getCategoryMeta(notif.category);
  const prio = getPriorityMeta(notif.priority);
  const Icon = cat.icon;
  const isUnread = !notif.read_at;

  return (
    <div
      className="relative rounded-xl flex items-stretch overflow-hidden transition-colors"
      style={{
        backgroundColor: isUnread ? "var(--card)" : "transparent",
        border: "0.5px solid rgba(0,0,0,0.08)",
      }}
    >
      {/* Pastille priorité gauche */}
      <div style={{ width: 4, backgroundColor: prio.color, flexShrink: 0 }} />

      <button
        type="button"
        onClick={onClick}
        className="flex-1 flex items-start gap-3 text-left px-3 py-3 transition-colors hover:bg-black/[0.02]"
        style={{ cursor: onClick ? "pointer" : "default" }}
      >
        {/* Icône catégorie */}
        <div
          className="rounded-full flex items-center justify-center shrink-0 mt-0.5"
          style={{
            width: 28,
            height: 28,
            backgroundColor: cat.color + "22",
            color: cat.color,
          }}
        >
          <Icon size={14} strokeWidth={1.8} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div
              className="truncate"
              style={{ fontSize: compact ? 12 : 13, fontWeight: isUnread ? 500 : 400, color: "var(--foreground)" }}
            >
              {notif.title}
            </div>
            {isUnread && (
              <span
                className="rounded-full shrink-0"
                style={{ width: 6, height: 6, backgroundColor: "var(--coral)" }}
              />
            )}
          </div>
          {notif.body && (
            <div
              className={compact ? "truncate" : ""}
              style={{
                fontSize: 11,
                color: "var(--muted-foreground)",
                marginTop: 2,
                lineHeight: 1.4,
              }}
            >
              {notif.body}
            </div>
          )}
          <div
            className="mt-1"
            style={{ fontSize: 10, color: "var(--muted-foreground)" }}
            title={formatAbsoluteFr(notif.created_at)}
          >
            {formatRelativeFr(notif.created_at)}
          </div>
        </div>

        {onClick && !showActions && <ChevronRight size={14} className="shrink-0 mt-1.5" style={{ color: "var(--muted-foreground)" }} />}
      </button>

      {showActions && onToggleRead && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleRead();
          }}
          className="px-3 flex items-center transition-colors hover:bg-black/[0.04]"
          style={{ fontSize: 10, color: "var(--muted-foreground)", borderLeft: "0.5px solid rgba(0,0,0,0.06)" }}
          title={isUnread ? "Marquer comme lu" : "Marquer comme non lu"}
        >
          {isUnread ? <Check size={14} /> : <span style={{ width: 14, height: 14, borderRadius: 7, border: "1.5px solid currentColor", display: "inline-block" }} />}
        </button>
      )}
    </div>
  );
}
