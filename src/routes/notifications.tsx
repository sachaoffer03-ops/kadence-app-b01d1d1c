import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCheck, Loader2 } from "lucide-react";
import { listMyNotifications, markAllRead, markNotificationRead } from "@/lib/notifications.functions";
import { NotificationItem, type NotifRow } from "@/components/notifications/NotificationItem";
import { NOTIF_CATEGORY_META } from "@/lib/notifications-meta";
import { fallbackLinkByCategory } from "@/lib/notif-links";

export const Route = createFileRoute("/notifications")({
  component: NotificationsPage,
  head: () => ({ meta: [{ title: "Notifications — Kadence" }] }),
});

type Filter = "all" | "unread" | "urgent";
const CATS = ["planning", "shift", "training", "request", "document", "pointage", "general"] as const;
const PAGE = 50;

function NotificationsPage() {
  const navigate = useNavigate();
  const fetchList = useServerFn(listMyNotifications);
  const markRead = useServerFn(markNotificationRead);
  const markAll = useServerFn(markAllRead);

  const [items, setItems] = useState<NotifRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState<Filter>("all");
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  const load = async (off = 0, append = false) => {
    setLoading(true);
    try {
      const r: any = await fetchList({ data: { filter, category: category as any, limit: PAGE, offset: off } });
      const next = (r?.items ?? []) as NotifRow[];
      setItems((prev) => append ? [...prev, ...next] : next);
      setTotal(r?.total ?? 0);
      setOffset(off);
    } catch (e: any) {
      toast.error("Erreur de chargement", { description: e?.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(0, false); /* eslint-disable-next-line */ }, [filter, category]);

  const handleClick = async (n: NotifRow) => {
    if (!n.read_at) {
      try {
        await markRead({ data: { notificationId: n.id } });
        setItems((prev) => prev.map((x) => x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x));
      } catch {}
    }
    const href = n.link || fallbackLinkByCategory(n.category, false);
    if (href.startsWith("/")) navigate({ to: href as any }).catch(() => { window.location.href = href; });
    else window.location.href = href;
  };

  const handleToggleRead = async (n: NotifRow) => {
    const wasUnread = !n.read_at;
    setItems((prev) => prev.map((x) => x.id === n.id ? { ...x, read_at: wasUnread ? new Date().toISOString() : null } : x));
    try { await markRead({ data: { notificationId: n.id, unread: !wasUnread } }); } catch {}
  };

  const handleMarkAll = async () => {
    try {
      await markAll({ data: {} });
      toast.success("Toutes les notifications marquées comme lues");
      load(0, false);
    } catch (e: any) {
      toast.error("Erreur", { description: e?.message });
    }
  };

  return (
    <div className="p-4 md:p-6" style={{ maxWidth: 880 }}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 mb-5">
        <div className="min-w-0">
          <h1 className="truncate" style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em" }}>Notifications</h1>
          <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 4 }}>
            {total} notification{total > 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={handleMarkAll}
          className="inline-flex items-center gap-1.5 rounded-md border px-3 shrink-0"
          style={{ fontSize: 12, fontWeight: 500, borderColor: "var(--border)", backgroundColor: "var(--card)", minHeight: 40 }}
        >
          <CheckCheck size={13} />
          <span className="hidden sm:inline">Tout marquer lu</span>
          <span className="sm:hidden">Tout lu</span>
        </button>
      </div>

      {/* Filtres : scroll horizontal mobile, wrap desktop */}
      <div
        className="flex md:flex-wrap gap-2 mb-4 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 md:overflow-visible"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" } as React.CSSProperties}
      >
        {(["all", "unread", "urgent"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="rounded-full px-3 shrink-0"
            style={{
              fontSize: 12,
              fontWeight: 500,
              minHeight: 32,
              backgroundColor: filter === f ? "var(--foreground)" : "var(--muted)",
              color: filter === f ? "var(--card)" : "var(--foreground)",
            }}
          >
            {f === "all" ? "Toutes" : f === "unread" ? "Non lues" : "Urgentes"}
          </button>
        ))}
        <div className="shrink-0" style={{ width: 1, backgroundColor: "var(--border)", margin: "0 4px" }} />
        <button
          onClick={() => setCategory(undefined)}
          className="rounded-full px-3 shrink-0"
          style={{
            fontSize: 12,
            fontWeight: 500,
            minHeight: 32,
            backgroundColor: !category ? "var(--foreground)" : "var(--muted)",
            color: !category ? "var(--card)" : "var(--foreground)",
          }}
        >
          Toutes catégories
        </button>
        {CATS.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className="rounded-full px-3 shrink-0"
            style={{
              fontSize: 12,
              fontWeight: 500,
              minHeight: 32,
              backgroundColor: category === c ? NOTIF_CATEGORY_META[c].color : "var(--muted)",
              color: category === c ? "#fff" : "var(--foreground)",
            }}
          >
            {NOTIF_CATEGORY_META[c].label}
          </button>
        ))}
      </div>

      {loading && items.length === 0 ? (
        <div className="flex items-center justify-center py-12" style={{ color: "var(--muted-foreground)" }}>
          <Loader2 size={18} className="animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border p-10 text-center" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Aucune notification</div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Tu es à jour.</div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((n) => (
            <NotificationItem
              key={n.id}
              notif={n}
              onClick={() => handleClick(n)}
              onToggleRead={() => handleToggleRead(n)}
              showActions
            />
          ))}
          {items.length < total && (
            <button
              onClick={() => load(offset + PAGE, true)}
              disabled={loading}
              className="mt-3 mx-auto rounded-md border px-4 py-2 disabled:opacity-50"
              style={{ fontSize: 12, fontWeight: 500, borderColor: "var(--border)", backgroundColor: "var(--card)" }}
            >
              {loading ? "Chargement…" : `Charger plus (${total - items.length} restantes)`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
