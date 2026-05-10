import { useRouterState, useNavigate } from "@tanstack/react-router";
import { Bell, Search, Plus, Menu } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import logo from "@/assets/kadence-logo.png";

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
};

export function TopBar({ onMenuToggle }: { onMenuToggle?: () => void }) {
  const currentPath = useRouterState({
    select: (s) => s.location.pathname,
  });
  const navigate = useNavigate();
  const openNewShift = () => navigate({ to: "/planning", search: { add: true } });
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchValue.trim();
    if (!q) return;
    navigate({ to: "/staff" });
    setSearchOpen(false);
    setSearchValue("");
  };

  const notifications = [
    { id: 1, title: "Nouvelle demande de modif", desc: "Léa souhaite échanger son shift de vendredi", to: "/demandes" as const },
  ];

  const pageTitle = pageTitles[currentPath] || "Dashboard";

  return (
    <header
      className="flex items-center justify-between border-b px-4 md:px-6"
      style={{
        height: 52,
        borderColor: "var(--border)",
        backgroundColor: "var(--background)",
      }}
    >
      {/* Left: hamburger (mobile) + breadcrumb */}
      <div className="flex items-center gap-2">
        {onMenuToggle && (
          <button
            onClick={onMenuToggle}
            className="flex items-center justify-center rounded-md md:hidden"
            style={{ width: 32, height: 32 }}
          >
            <Menu size={20} strokeWidth={1.8} style={{ color: "var(--foreground)" }} />
          </button>
        )}
        <span className="hidden md:inline" style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
          Kadence
        </span>
        <span className="hidden md:inline" style={{ fontSize: 13, color: "var(--muted-foreground)" }}>/</span>
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)" }}>
          {pageTitle}
        </span>
      </div>

      {/* Center: search (hidden on mobile) */}
      <form
        onSubmit={submitSearch}
        className="hidden md:flex items-center gap-2 rounded-md border px-3"
        style={{ width: 220, height: 32, borderColor: "var(--border)", backgroundColor: "var(--card)" }}
      >
        <Search size={14} style={{ color: "var(--muted-foreground)" }} />
        <input
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder="Rechercher staff, shift…"
          className="flex-1 bg-transparent outline-none"
          style={{ fontSize: 12, color: "var(--foreground)" }}
        />
      </form>

      {/* Right: actions */}
      <div className="flex items-center gap-2">
        {searchOpen && (
          <form onSubmit={submitSearch} className="md:hidden absolute left-0 right-0 top-[52px] z-40 px-4 py-2 border-b" style={{ backgroundColor: "var(--background)", borderColor: "var(--border)" }}>
            <input
              autoFocus
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Rechercher staff, shift…"
              className="w-full rounded-md border px-3 py-2"
              style={{ fontSize: 13, borderColor: "var(--border)", backgroundColor: "var(--card)" }}
            />
          </form>
        )}
        <button
          onClick={() => setSearchOpen((v) => !v)}
          className="flex items-center justify-center rounded-md md:hidden"
          style={{ width: 32, height: 32 }}
        >
          <Search size={18} strokeWidth={1.8} style={{ color: "var(--foreground)" }} />
        </button>
        <div className="relative" ref={notifRef}>
        <button
          onClick={() => setNotifOpen((v) => !v)}
          className="relative flex items-center justify-center rounded-md transition-colors"
          style={{ width: 32, height: 32 }}
        >
          <Bell size={16} strokeWidth={1.8} style={{ color: "var(--foreground)" }} />
          <span className="absolute rounded-full" style={{ top: 5, right: 6, width: 6, height: 6, backgroundColor: "var(--coral)" }} />
        </button>
        {notifOpen && (
          <div className="absolute right-0 mt-2 rounded-lg border shadow-lg overflow-hidden z-50" style={{ width: 280, backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <div className="px-3 py-2 border-b" style={{ borderColor: "var(--border)", fontSize: 12, fontWeight: 500 }}>Notifications</div>
            {notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => { setNotifOpen(false); navigate({ to: n.to }); }}
                className="block w-full text-left px-3 py-2.5 hover:bg-muted transition-colors"
              >
                <div style={{ fontSize: 12, fontWeight: 500 }}>{n.title}</div>
                <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{n.desc}</div>
              </button>
            ))}
          </div>
        )}
        </div>
        <button
          onClick={openNewShift}
          className="hidden md:flex items-center gap-1.5 rounded-md px-3 transition-colors"
          style={{
            height: 32,
            fontSize: 12,
            fontWeight: 500,
            backgroundColor: "var(--foreground)",
            color: "var(--card)",
          }}
        >
          <Plus size={14} />
          Nouveau shift
        </button>
        <button
          onClick={openNewShift}
          className="flex md:hidden items-center justify-center rounded-md"
          style={{
            width: 32,
            height: 32,
            backgroundColor: "var(--foreground)",
            color: "var(--card)",
          }}
        >
          <Plus size={16} />
        </button>
      </div>
    </header>
  );
}
