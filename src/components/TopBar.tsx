import { useRouterState, useNavigate } from "@tanstack/react-router";
import { Bell, Search, Plus, Menu } from "lucide-react";

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
          Shyft
        </span>
        <span className="hidden md:inline" style={{ fontSize: 13, color: "var(--muted-foreground)" }}>/</span>
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)" }}>
          {pageTitle}
        </span>
      </div>

      {/* Center: search (hidden on mobile) */}
      <div
        className="hidden md:flex items-center gap-2 rounded-md border px-3"
        style={{
          width: 220,
          height: 32,
          borderColor: "var(--border)",
          backgroundColor: "var(--card)",
        }}
      >
        <Search size={14} style={{ color: "var(--muted-foreground)" }} />
        <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
          Rechercher staff, shift…
        </span>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2">
        <button
          className="flex items-center justify-center rounded-md md:hidden"
          style={{ width: 32, height: 32 }}
        >
          <Search size={18} strokeWidth={1.8} style={{ color: "var(--foreground)" }} />
        </button>
        <button
          className="relative flex items-center justify-center rounded-md transition-colors"
          style={{ width: 32, height: 32 }}
        >
          <Bell size={16} strokeWidth={1.8} style={{ color: "var(--foreground)" }} />
          <span
            className="absolute rounded-full"
            style={{
              top: 5,
              right: 6,
              width: 6,
              height: 6,
              backgroundColor: "var(--coral)",
            }}
          />
        </button>
        <button
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
