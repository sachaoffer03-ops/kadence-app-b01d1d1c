import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getFormationNotifications } from "@/lib/formation.functions";
import { GraduationCap, ChevronRight, CheckCircle2, AlertTriangle, Sparkles } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

type Item = {
  id: string;
  priority: number;
  variant: "primary" | "success" | "success-light" | "warning" | "danger";
  title: string;
  body: string;
  cta: { label: string; courseId: string | null } | null;
};

const VARIANT_STYLES: Record<Item["variant"], { bg: string; border: string; iconBg: string; iconColor: string; titleColor: string }> = {
  primary:        { bg: "var(--coral-light)",        border: "var(--coral)",          iconBg: "var(--coral)",          iconColor: "#fff",            titleColor: "var(--coral-dark)" },
  "success":      { bg: "var(--success-bg)",         border: "var(--success-text)",   iconBg: "var(--success-text)",   iconColor: "#fff",            titleColor: "var(--success-text)" },
  "success-light":{ bg: "var(--success-bg)",         border: "var(--success-text)",   iconBg: "var(--success-text)",   iconColor: "#fff",            titleColor: "var(--success-text)" },
  warning:        { bg: "#FFF7ED",                   border: "#F59E0B",               iconBg: "#F59E0B",               iconColor: "#fff",            titleColor: "#9A3412" },
  danger:         { bg: "#FEF2F2",                   border: "#DC2626",               iconBg: "#DC2626",               iconColor: "#fff",            titleColor: "#991B1B" },
};

function iconFor(variant: Item["variant"]) {
  if (variant === "success") return <CheckCircle2 size={18} />;
  if (variant === "warning") return <AlertTriangle size={18} />;
  if (variant === "danger") return <AlertTriangle size={18} />;
  if (variant === "success-light") return <Sparkles size={18} />;
  return <GraduationCap size={18} />;
}

export function FormationNotifBanner() {
  const fetchNotifs = useServerFn(getFormationNotifications);
  const [items, setItems] = useState<Item[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    fetchNotifs({}).then((r: any) => {
      if (!cancelled) setItems(r.items ?? []);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [fetchNotifs]);

  // Show at most the top 2 highest-priority items
  const top = items.slice(0, 2);
  if (top.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 mb-3">
      {top.map((it) => {
        const s = VARIANT_STYLES[it.variant];
        const clickable = !!it.cta;
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => { if (clickable) navigate({ to: "/staff-app", search: { tab: "formation" } as any }); }}
            className="w-full rounded-xl px-4 py-3.5 flex items-center gap-3 text-left transition-colors"
            style={{ backgroundColor: s.bg, border: `0.5px solid ${s.border}`, cursor: clickable ? "pointer" : "default" }}
          >
            <div className="rounded-lg flex items-center justify-center shrink-0" style={{ width: 36, height: 36, backgroundColor: s.iconBg, color: s.iconColor }}>
              {iconFor(it.variant)}
            </div>
            <div className="flex-1 min-w-0">
              <div style={{ fontSize: 13, fontWeight: 500, color: s.titleColor }} className="truncate">{it.title}</div>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)" }} className="truncate">{it.body}</div>
            </div>
            {clickable && <ChevronRight size={16} style={{ color: s.titleColor }} className="shrink-0" />}
          </button>
        );
      })}
    </div>
  );
}
