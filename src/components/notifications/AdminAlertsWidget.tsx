import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, AlertTriangle } from "lucide-react";
import { getRecentImportantNotifications, markNotificationRead } from "@/lib/notifications.functions";
import { supabase } from "@/integrations/supabase/client";
import { NotificationItem, type NotifRow } from "./NotificationItem";

export function AdminAlertsWidget() {
  const fetchFn = useServerFn(getRecentImportantNotifications);
  const markRead = useServerFn(markNotificationRead);
  const navigate = useNavigate();
  const [items, setItems] = useState<NotifRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = () => {
    fetchFn({ data: { limit: 5 } })
      .then((r: any) => setItems((r.items ?? []) as NotifRow[]))
      .catch(() => {})
      .finally(() => setLoaded(true));
  };

  useEffect(() => {
    load();
    let userId: string | null = null;
    let channel: any = null;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      userId = user.id;
      channel = supabase
        .channel(`admin-alerts-${userId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () => load())
        .subscribe();
    })();
    return () => { if (channel) supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!loaded || items.length === 0) return null;

  const handleClick = async (n: NotifRow) => {
    try {
      await markRead({ data: { notificationId: n.id } });
    } catch {}
    setItems((prev) => prev.filter((x) => x.id !== n.id));
    if (n.link) navigate({ to: n.link as any });
  };

  return (
    <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle size={15} style={{ color: "var(--coral-dark)" }} />
          <span style={{ fontSize: 14, fontWeight: 500 }}>Notifications importantes</span>
          <span
            className="rounded-full inline-flex items-center justify-center"
            style={{ minWidth: 20, height: 18, padding: "0 6px", fontSize: 10, fontWeight: 500, backgroundColor: "var(--danger-bg)", color: "var(--danger-text)" }}
          >
            {items.length}
          </span>
        </div>
        <button
          onClick={() => navigate({ to: "/notifications" })}
          className="flex items-center gap-1"
          style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)" }}
        >
          Voir toutes <ArrowRight size={11} />
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
