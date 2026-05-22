import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, Bell } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getRecentImportantNotifications, markNotificationRead } from "@/lib/notifications.functions";
import { NotificationItem, type NotifRow } from "./NotificationItem";
import { fallbackLinkByCategory } from "@/lib/notif-links";

export function AdminAlertsWidget() {
  const navigate = useNavigate();
  const fetchImportant = useServerFn(getRecentImportantNotifications);
  const markRead = useServerFn(markNotificationRead);
  const [items, setItems] = useState<NotifRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r: any = await fetchImportant({ data: { limit: 5 } });
        if (!cancelled) setItems((r?.items ?? []) as NotifRow[]);
      } catch {
        if (!cancelled) setItems([]);
      }
    })();
    return () => { cancelled = true; };
  }, [fetchImportant]);

  if (!items || items.length === 0) return null;

  const handleClick = async (n: NotifRow) => {
    try { await markRead({ data: { notificationId: n.id } }); } catch {}
    const href = n.link || fallbackLinkByCategory(n.category, false);
    if (href.startsWith("/")) navigate({ to: href as any }).catch(() => { window.location.href = href; });
    else window.location.href = href;
  };

  return (
    <div
      className="rounded-xl border p-5"
      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell size={15} style={{ color: "var(--coral-dark)" }} />
          <h2 style={{ fontSize: 14, fontWeight: 500 }}>Alertes importantes</h2>
          <span
            className="rounded-full inline-flex items-center justify-center"
            style={{ width: 20, height: 20, fontSize: 10, fontWeight: 500, backgroundColor: "var(--coral-light)", color: "var(--coral-dark)" }}
          >
            {items.length}
          </span>
        </div>
        <button
          onClick={() => navigate({ to: "/notifications" })}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1"
          style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)" }}
        >
          Voir toutes <ArrowRight size={12} />
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {items.map((n) => (
          <NotificationItem key={n.id} notif={n} onClick={() => handleClick(n)} compact />
        ))}
      </div>
    </div>
  );
}
