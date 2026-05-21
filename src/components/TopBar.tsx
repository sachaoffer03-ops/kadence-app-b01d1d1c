import { useRouterState, useNavigate } from "@tanstack/react-router";
import { Bell, Search, Plus, Menu, LogOut, CheckCheck } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import logo from "@/assets/kadence-logo.png";
import { CreateShiftModal } from "@/components/CreateShiftModal";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getCategoryMeta, getPriorityMeta, formatRelativeFr } from "@/lib/notifications-meta";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/planning": "Planning",
  "/staff": "Staff",
  "/trous": "Trous à combler",
  "/demandes": "Demandes modif",
  "/pointage": "Pointage",
  "/checklists": "Checklists",
  "/feedbacks": "Feedbacks",
  "/formation": "Formation",
  "/dimona": "Dimona",
  "/contingents": "Quotas étudiants",
  "/studios": "Studios & postes",
  "/reglages": "Réglages",
  "/notifications": "Notifications",
};

interface NotifRow {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
  priority: string | null;
  category: string | null;
}

type NotifTab = "all" | "unread" | "urgent";


export function TopBar({ onMenuToggle }: { onMenuToggle?: () => void }) {
  const currentPath = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [shiftOpen, setShiftOpen] = useState(false);
  const openNewShift = () => setShiftOpen(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const [notifications, setNotifications] = useState<NotifRow[]>([]);
  const [notifTab, setNotifTab] = useState<NotifTab>("unread");


  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Load notifications + realtime
  useEffect(() => {
    let userId: string | null = null;
    let channel: any = null;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      userId = user.id;
      const { data } = await supabase
        .from("notifications")
        .select("id, title, body, link, read_at, created_at, priority, category")
        .order("created_at", { ascending: false })
        .limit(20);

      setNotifications((data ?? []) as NotifRow[]);

      channel = supabase
        .channel("notif-" + userId + "-" + Math.random().toString(36).slice(2))
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
          (payload) => {
            const n = payload.new as NotifRow;
            setNotifications((prev) => [n, ...prev].slice(0, 20));
            toast(n.title, { description: n.body ?? undefined });
          },
        )
        .subscribe();
    })();

    return () => { if (channel) supabase.removeChannel(channel); };
  }, []);

  const unread = notifications.filter((n) => !n.read_at).length;

  const openNotif = async (n: NotifRow) => {
    setNotifOpen(false);
    if (!n.read_at) {
      await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", n.id);
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
    }
    if (n.link) navigate({ to: n.link as any });
  };

  const markAllRead = async () => {
    const ids = notifications.filter((n) => !n.read_at).map((n) => n.id);
    if (ids.length === 0) return;
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids);
    setNotifications((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })));
  };

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchValue.trim();
    if (!q) return;
    navigate({ to: "/staff" });
    setSearchOpen(false);
    setSearchValue("");
  };

  const pageTitle = pageTitles[currentPath] || "Dashboard";

  return (
    <>
    <header
      className="flex items-center justify-between border-b px-4 md:px-6"
      style={{ height: 52, borderColor: "var(--border)", backgroundColor: "var(--background)" }}
    >
      <div className="flex items-center gap-2">
        {onMenuToggle && (
          <button onClick={onMenuToggle} className="flex items-center justify-center rounded-md md:hidden" style={{ width: 32, height: 32 }}>
            <Menu size={20} strokeWidth={1.8} style={{ color: "var(--foreground)" }} />
          </button>
        )}
        <img src={logo} alt="Kadence" className="hidden md:block" style={{ height: 44, width: "auto" }} />
        <span className="hidden md:inline" style={{ fontSize: 13, color: "var(--muted-foreground)" }}>/</span>
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)" }}>{pageTitle}</span>
      </div>

      <form onSubmit={submitSearch} className="hidden md:flex items-center gap-2 rounded-md border px-3"
        style={{ width: 220, height: 32, borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
        <Search size={14} style={{ color: "var(--muted-foreground)" }} />
        <input value={searchValue} onChange={(e) => setSearchValue(e.target.value)} placeholder="Rechercher staff, shift…"
          className="flex-1 bg-transparent outline-none" style={{ fontSize: 12, color: "var(--foreground)" }} />
      </form>

      <div className="flex items-center gap-2">
        {searchOpen && (
          <form onSubmit={submitSearch} className="md:hidden absolute left-0 right-0 top-[52px] z-40 px-4 py-2 border-b" style={{ backgroundColor: "var(--background)", borderColor: "var(--border)" }}>
            <input autoFocus value={searchValue} onChange={(e) => setSearchValue(e.target.value)} placeholder="Rechercher staff, shift…"
              className="w-full rounded-md border px-3 py-2" style={{ fontSize: 13, borderColor: "var(--border)", backgroundColor: "var(--card)" }} />
          </form>
        )}
        <button onClick={() => setSearchOpen((v) => !v)} className="flex items-center justify-center rounded-md md:hidden" style={{ width: 32, height: 32 }}>
          <Search size={18} strokeWidth={1.8} style={{ color: "var(--foreground)" }} />
        </button>
        <div className="relative" ref={notifRef}>
          <button onClick={() => setNotifOpen((v) => !v)} className="relative flex items-center justify-center rounded-md transition-colors" style={{ width: 32, height: 32 }}>
            <Bell size={16} strokeWidth={1.8} style={{ color: "var(--foreground)" }} />
            {unread > 0 && (
              <span className="absolute rounded-full flex items-center justify-center" style={{
                top: 2, right: 2, minWidth: 14, height: 14, padding: "0 3px",
                backgroundColor: "var(--coral)", color: "#fff", fontSize: 9, fontWeight: 600,
              }}>{unread > 9 ? "9+" : unread}</span>
            )}
          </button>
          {notifOpen && (
            <div className="absolute right-0 mt-2 rounded-lg border shadow-lg overflow-hidden z-50" style={{ width: 320, backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
              <div className="px-3 py-2 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
                <span style={{ fontSize: 12, fontWeight: 500 }}>Notifications</span>
                {unread > 0 && (
                  <button onClick={markAllRead} style={{ fontSize: 10, color: "var(--muted-foreground)" }}>Tout marquer lu</button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 && (
                  <div className="px-3 py-6 text-center" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Aucune notification</div>
                )}
                {notifications.map((n) => (
                  <button key={n.id} onClick={() => openNotif(n)}
                    className="block w-full text-left px-3 py-2.5 transition-colors"
                    style={{ borderBottom: "0.5px solid var(--border)", backgroundColor: n.read_at ? "transparent" : "var(--muted)" }}>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{n.title}</div>
                    {n.body && <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{n.body}</div>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        {currentPath.startsWith("/planning") && (
          <>
            <button onClick={openNewShift} className="hidden md:flex items-center gap-1.5 rounded-md px-3 transition-colors"
              style={{ height: 32, fontSize: 12, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
              <Plus size={14} /> Nouveau shift
            </button>
            <button onClick={openNewShift} className="flex md:hidden items-center justify-center rounded-md"
              style={{ width: 32, height: 32, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
              <Plus size={16} />
            </button>
          </>
        )}
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            navigate({ to: "/login" });
          }}
          title="Déconnexion"
          className="flex items-center justify-center rounded-md transition-colors"
          style={{ width: 32, height: 32 }}
        >
          <LogOut size={16} strokeWidth={1.8} style={{ color: "var(--foreground)" }} />
        </button>
      </div>
    </header>
    <CreateShiftModal open={shiftOpen} onClose={() => setShiftOpen(false)} />
    </>
  );
}
