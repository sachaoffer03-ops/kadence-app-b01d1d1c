import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { CheckCircle2, ChevronRight } from "lucide-react";
import { getRecentImportantNotifications, markNotificationRead } from "@/lib/notifications.functions";
import { supabase } from "@/integrations/supabase/client";
import { getCategoryMeta, getPriorityMeta, getCategoryCta, formatRelativeFr } from "@/lib/notifications-meta";
import { fallbackLinkByCategory } from "@/lib/notif-links";

interface NotifRow {
  id: string; title: string; body: string | null; link: string | null;
  created_at: string; priority: string | null; category: string | null;
}

export function EmployeeNotifsWidget({ userId }: { userId: string }) {
  const fetchFn = useServerFn(getRecentImportantNotifications);
  const markRead = useServerFn(markNotificationRead);
  const navigate = useNavigate();
  const [items, setItems] = useState<NotifRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = () => {
    fetchFn({ data: { limit: 3 } })
      .then((r: any) => setItems((r.items ?? []) as NotifRow[]))
      .catch(() => {})
      .finally(() => setLoaded(true));
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`emp-notifs-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const goTo = async (n: NotifRow) => {
    try { await markRead({ data: { notificationId: n.id } }); } catch {}
    setItems((prev) => prev.filter((x) => x.id !== n.id));
    const target = n.link || fallbackLinkByCategory(n.category, true);
    if (target.startsWith("/staff-app") || target.startsWith("http")) {
      window.location.assign(target);
    } else {
      navigate({ to: target as any });
    }
  };

  if (!loaded) return null;

  if (items.length === 0) {
    return (
      <div
        className="rounded-xl px-4 py-3 mb-4 flex items-center gap-2"
        style={{ backgroundColor: "#fff", border: "0.5px solid rgba(0,0,0,0.06)" }}
      >
        <CheckCircle2 size={14} style={{ color: "var(--muted-foreground)" }} />
        <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Tu es à jour</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 mb-4">
      {items.map((n) => {
        const cat = getCategoryMeta(n.category);
        const prio = getPriorityMeta(n.priority);
        const Icon = cat.icon;
        return (
          <button
            key={n.id}
            type="button"
            onClick={() => goTo(n)}
            className="relative rounded-xl flex items-stretch overflow-hidden text-left transition-colors"
            style={{ backgroundColor: "#fff", border: "0.5px solid rgba(0,0,0,0.08)" }}
          >
            <div style={{ width: 4, backgroundColor: prio.color, flexShrink: 0 }} />
            <div className="flex-1 flex items-center gap-3 px-3 py-3">
              <div
                className="rounded-full flex items-center justify-center shrink-0"
                style={{ width: 32, height: 32, backgroundColor: cat.color + "22", color: cat.color }}
              >
                <Icon size={15} strokeWidth={1.8} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="truncate" style={{ fontSize: 13, fontWeight: 500 }}>{n.title}</div>
                {n.body && <div className="truncate" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{n.body}</div>}
                <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 2 }}>{formatRelativeFr(n.created_at)}</div>
              </div>
              <div className="flex items-center gap-1 shrink-0" style={{ fontSize: 11, fontWeight: 500, color: prio.color }}>
                {getCategoryCta(n.category)} <ChevronRight size={12} />
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
