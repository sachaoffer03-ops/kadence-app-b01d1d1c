import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bell, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { listMyNotifications, markNotificationRead, markAllRead } from "@/lib/notifications.functions";
import { supabase } from "@/integrations/supabase/client";
import { NOTIF_CATEGORY_META, type NotifCategory } from "@/lib/notifications-meta";
import { NotificationItem, type NotifRow } from "@/components/notifications/NotificationItem";

export const Route = createFileRoute("/notifications")({
  component: NotificationsPage,
  head: () => ({ meta: [{ title: "Notifications — Kadence" }] }),
});

const CATEGORIES: { value: NotifCategory | "all"; label: string }[] = [
  { value: "all", label: "Toutes" },
  { value: "pointage", label: "Pointage" },
  { value: "request", label: "Demandes" },
  { value: "shift", label: "Shifts" },
  { value: "planning", label: "Planning" },
  { value: "training", label: "Formation" },
  { value: "document", label: "Documents" },
  { value: "general", label: "Général" },
];

const PAGE_SIZE = 50;

function NotificationsPage() {
  const navigate = useNavigate();
  const listFn = useServerFn(listMyNotifications);
  const markFn = useServerFn(markNotificationRead);
  const markAllFn = useServerFn(markAllRead);

  const [category, setCategory] = useState<NotifCategory | "all">("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<NotifRow[]>([]);
  const [counts, setCounts] = useState({ urgent: 0, normal: 0, info: 0, total: 0 });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    listFn({
      data: {
        filter: unreadOnly ? "unread" : "all",
        category: category === "all" ? undefined : category,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      },
    })
      .then((r: any) => {
        setItems(r.items as NotifRow[]);
        setCounts(r.counts);
        setTotal(r.total);
      })
      .finally(() => setLoading(false));
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
        .channel(`notif-page-${userId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () => load())
        .subscribe();
    })();
    return () => { if (channel) supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, unreadOnly, page]);

  const handleClick = async (n: NotifRow) => {
    if (!n.read_at) {
      try { await markFn({ data: { notificationId: n.id } }); } catch {}
      setItems((prev) => prev.map((x) => x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x));
    }
    if (n.link) navigate({ to: n.link as any });
  };

  const toggleRead = async (n: NotifRow) => {
    const wasUnread = !n.read_at;
    try { await markFn({ data: { notificationId: n.id, unread: !wasUnread } }); } catch {}
    setItems((prev) => prev.map((x) => x.id === n.id ? { ...x, read_at: wasUnread ? new Date().toISOString() : null } : x));
  };

  const handleMarkAll = async () => {
    try { await markAllFn({ data: category === "all" ? {} : { category } }); load(); } catch {}
  };

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.01em" }}>Notifications</h1>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 4 }}>
            {counts.total > 0 ? (
              <>
                <span style={{ color: "#DC2626", fontWeight: 500 }}>{counts.urgent}</span> urgent · {" "}
                <span style={{ color: "var(--coral-dark)", fontWeight: 500 }}>{counts.normal}</span> important · {" "}
                <span>{counts.info}</span> info
              </>
            ) : (
              "Aucune notification non lue"
            )}
          </div>
        </div>
        {counts.total > 0 && (
          <button
            onClick={handleMarkAll}
            className="rounded-md px-3 py-1.5 flex items-center gap-1.5"
            style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}
          >
            <Check size={13} /> Tout marquer lu
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {CATEGORIES.map((c) => {
          const active = category === c.value;
          return (
            <button
              key={c.value}
              onClick={() => { setCategory(c.value); setPage(0); }}
              className="rounded-full px-3 py-1 transition-colors"
              style={{
                fontSize: 11, fontWeight: 500,
                backgroundColor: active ? "var(--foreground)" : "var(--card)",
                color: active ? "var(--card)" : "var(--muted-foreground)",
                border: "0.5px solid rgba(0,0,0,0.08)",
              }}
            >
              {c.label}
            </button>
          );
        })}
        <div className="flex-1" />
        <label className="flex items-center gap-1.5 cursor-pointer" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
          <input type="checkbox" checked={unreadOnly} onChange={(e) => { setUnreadOnly(e.target.checked); setPage(0); }} />
          Non lues uniquement
        </label>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {[1,2,3,4,5].map((i) => (
            <div key={i} className="rounded-xl h-16 animate-pulse" style={{ backgroundColor: "var(--muted)", opacity: 0.5 }} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl py-12 text-center" style={{ backgroundColor: "var(--card)", border: "0.5px solid var(--border)" }}>
          <Bell size={24} style={{ color: "var(--muted-foreground)", margin: "0 auto 8px" }} />
          <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Aucune notification pour le moment</div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((n) => (
            <NotificationItem
              key={n.id}
              notif={n}
              onClick={() => handleClick(n)}
              onToggleRead={() => toggleRead(n)}
              showActions
            />
          ))}
        </div>
      )}

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-3 mt-5">
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="flex items-center gap-1 rounded-md px-3 py-1.5 disabled:opacity-40"
            style={{ fontSize: 12, border: "0.5px solid var(--border)" }}
          >
            <ChevronLeft size={13} /> Précédent
          </button>
          <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Page {page + 1} / {pageCount}</span>
          <button
            disabled={page + 1 >= pageCount}
            onClick={() => setPage((p) => p + 1)}
            className="flex items-center gap-1 rounded-md px-3 py-1.5 disabled:opacity-40"
            style={{ fontSize: 12, border: "0.5px solid var(--border)" }}
          >
            Suivant <ChevronRight size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
