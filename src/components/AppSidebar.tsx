import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  CalendarDays,
  CalendarCheck,
  Users,
  AlertTriangle,
  FileEdit,
  Clock,
  DoorClosed,
  MessageSquare,
  PackageSearch,
  GraduationCap,
  FileText,
  BarChart3,
  Building2,
  Settings,
  Bell,
  Bot,
  X,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import logo from "@/assets/kadence-logo.png";
import { useSidebarCounts } from "@/hooks/use-sidebar-counts";
import { useAuth } from "@/hooks/use-auth";


interface NavItem {
  label: string;
  to: string;
  icon: React.ElementType;
  badge?: number;
  badgeType?: "default" | "danger";
}

interface NavSection {
  title: string;
  items: NavItem[];
}

function buildNavSections(counts: ReturnType<typeof useSidebarCounts>): NavSection[] {
  return [
    {
      title: "Pilotage",
      items: [
        { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
        { label: "Rapports", to: "/rapports", icon: BarChart3 },
        { label: "Planning", to: "/planning", icon: CalendarDays },
        { label: "Monitoring dispos", to: "/dispos-monitoring", icon: CalendarCheck },
        { label: "Staff", to: "/staff", icon: Users },
        { label: "Trous à combler", to: "/trous", icon: AlertTriangle, badge: counts.trous, badgeType: "danger" },
      ],
    },
    {
      title: "Opérations",
      items: [
        { label: "Notifications", to: "/notifications", icon: Bell, badge: counts.notifications, badgeType: "danger" },
        { label: "Demandes modif", to: "/demandes", icon: FileEdit, badge: counts.demandes, badgeType: "danger" },
        { label: "Signalements", to: "/signalements", icon: PackageSearch, badge: counts.signalements },
        { label: "Pointage", to: "/pointage", icon: Clock },
        { label: "Clôture", to: "/cloture", icon: DoorClosed },
        { label: "Feedbacks", to: "/feedbacks", icon: MessageSquare, badge: counts.feedbacks },
        { label: "Formation", to: "/formation", icon: GraduationCap },
      ],
    },
    {
      title: "Conformité",
      items: [
        { label: "Dimona", to: "/dimona", icon: FileText },
        { label: "Quotas étudiants", to: "/contingents", icon: BarChart3 },
      ],
    },
    {
      title: "Configuration",
      items: [
        { label: "Studios & postes", to: "/studios", icon: Building2 },
        { label: "Assistant IA", to: "/assistant-ia", icon: Bot },
        { label: "Réglages", to: "/reglages", icon: Settings },
      ],
    },
  ];
}

function SidebarContent({ onNavigate, collapsed = false, onToggleCollapse }: { onNavigate?: () => void; collapsed?: boolean; onToggleCollapse?: () => void }) {
  const currentPath = useRouterState({ select: (s) => s.location.pathname });
  const counts = useSidebarCounts();
  const { appRole, managerPermissions, user } = useAuth();
  const [profile, setProfile] = useState<{ first_name: string | null; last_name: string | null } | null>(null);
  useEffect(() => {
    if (!user?.id) { setProfile(null); return; }
    let cancelled = false;
    supabase.from("profiles").select("first_name,last_name").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (!cancelled) setProfile(data ?? null);
    });
    return () => { cancelled = true; };
  }, [user?.id]);
  const firstName = profile?.first_name?.trim() || user?.email?.split("@")[0] || "";
  const lastName = profile?.last_name?.trim() || "";
  const displayName = [firstName, lastName].filter(Boolean).join(" ") || "Utilisateur";
  const initialsStr = ((firstName[0] || "") + (lastName[0] || "")).toUpperCase() || "?";
  const roleLabel = appRole === "admin" ? "Administrateur" : appRole === "manager" ? "Manager" : "Employé";
  const rawSections = buildNavSections(counts);
  const navSections = rawSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (appRole === "admin") return true;
        if (appRole !== "manager") return true;
        if (!managerPermissions) return false;
        return managerPermissions.includes(item.to);
      }),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <>
      {/* Logo */}
      <div className={collapsed ? "px-2 pt-6 pb-5" : "px-4 pt-6 pb-5"}>
        <img
          src={logo}
          alt="Kadence"
          style={{
            height: collapsed ? 32 : 80,
            width: "auto",
            maxWidth: "100%",
            display: "block",
            marginLeft: "auto",
            marginRight: "auto",
          }}
        />
        {!collapsed && (
          <div className="flex items-center justify-between" style={{ marginTop: 6 }}>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Skult Studios</div>
            {onToggleCollapse && (
              <button
                onClick={onToggleCollapse}
                title="Replier le menu"
                className="flex items-center justify-center rounded-md transition-all duration-150 hover:bg-[var(--muted)] active:scale-90 active:bg-[var(--sidebar-accent)]"
                style={{ width: 28, height: 28, color: "var(--muted-foreground)" }}
              >
                <PanelLeftClose size={16} strokeWidth={1.8} />
              </button>
            )}
          </div>
        )}
        {collapsed && onToggleCollapse && (
          <div className="flex justify-center" style={{ marginTop: 6 }}>
            <button
              onClick={onToggleCollapse}
              title="Déplier le menu"
              className="flex items-center justify-center rounded-md transition-all duration-150 hover:bg-[var(--muted)] active:scale-90 active:bg-[var(--sidebar-accent)]"
              style={{ width: 28, height: 28, color: "var(--muted-foreground)" }}
            >
              <PanelLeft size={16} strokeWidth={1.8} />
            </button>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className={collapsed ? "flex-1 overflow-y-auto px-2 pb-3" : "flex-1 overflow-y-auto px-3 pb-3"}>
        {navSections.map((section) => (
          <div key={section.title} className="mb-4">
            {!collapsed && (
              <div
                className="px-2 mb-1"
                style={{
                  fontSize: 9,
                  fontWeight: 500,
                  color: "var(--muted-foreground)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                {section.title}
              </div>
            )}
            {section.items.map((item) => {
              const isExternal = item.to.includes("?");
              const isActive = !isExternal && (currentPath === item.to || currentPath.startsWith(item.to + "/"));
              const linkStyle = {
                fontSize: 13,
                fontWeight: isActive ? 500 : 400,
                color: isActive ? "var(--foreground)" : "var(--sidebar-foreground)",
                backgroundColor: isActive ? "var(--sidebar-accent)" : "transparent",
              } as const;
              const inner = collapsed ? (
                <div className="relative flex items-center justify-center w-full">
                  <item.icon size={18} strokeWidth={1.8} />
                  {item.badge !== undefined && item.badge > 0 ? (
                    <span
                      className="absolute rounded-full flex items-center justify-center"
                      style={{
                        top: -4,
                        right: -2,
                        minWidth: 14,
                        height: 14,
                        padding: "0 3px",
                        fontSize: 9,
                        fontWeight: 600,
                        lineHeight: 1,
                        backgroundColor: item.badgeType === "danger" ? "var(--danger-bg)" : "var(--muted)",
                        color: item.badgeType === "danger" ? "var(--danger-text)" : "var(--muted-foreground)",
                      }}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </div>
              ) : (
                <>
                  <item.icon size={15} strokeWidth={1.8} />
                  <span className="flex-1">{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 ? (
                    <span
                      className="inline-flex items-center justify-center rounded-full tabular-nums"
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        lineHeight: 1,
                        minWidth: 18,
                        height: 18,
                        padding: "0 6px",
                        boxSizing: "border-box",
                        backgroundColor: item.badgeType === "danger" ? "var(--danger-bg)" : "var(--muted)",
                        color: item.badgeType === "danger" ? "var(--danger-text)" : "var(--muted-foreground)",
                      }}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </>
              );
              const className = collapsed
                ? "flex items-center justify-center px-2 py-2 rounded-md transition-colors mb-0.5"
                : "flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-colors";
              if (isExternal) {
                return (
                  <a
                    key={item.to}
                    href={item.to}
                    onClick={onNavigate}
                    className={className}
                    style={linkStyle}
                    title={collapsed ? item.label : undefined}
                  >
                    {inner}
                  </a>
                );
              }
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={onNavigate}
                  className={className}
                  style={linkStyle}
                  title={collapsed ? item.label : undefined}
                >
                  {inner}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>


      {/* User */}
      <div
        className={
          collapsed
            ? "px-2 py-3 border-t flex items-center justify-center"
            : "px-4 py-3 border-t flex items-center gap-2.5"
        }
        style={{ borderColor: "var(--border)" }}
      >
        <div
          className="flex items-center justify-center rounded-full"
          style={{
            width: 32,
            height: 32,
            backgroundColor: "var(--foreground)",
            color: "var(--coral)",
            fontSize: 11,
            fontWeight: 500,
            flexShrink: 0,
          }}
          title={collapsed ? "Sacha — Administrateur" : undefined}
        >
          SA
        </div>
        {!collapsed && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)" }}>Sacha</div>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Administrateur</div>
          </div>
        )}
      </div>
    </>
  );
}

/* Desktop sidebar */
export function AppSidebar({ collapsed = false, onToggleCollapse }: { collapsed?: boolean; onToggleCollapse?: () => void }) {
  return (
    <aside
      className="fixed left-0 top-0 bottom-0 flex-col border-r hidden md:flex transition-[width] duration-200 ease-out"
      style={{
        width: collapsed ? 64 : 220,
        backgroundColor: "var(--sidebar-bg)",
        borderColor: "var(--border)",
      }}
    >
      <SidebarContent collapsed={collapsed} onToggleCollapse={onToggleCollapse} />
    </aside>
  );
}

/* Mobile drawer sidebar */
export function MobileSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={onClose}
          style={{ backdropFilter: "blur(2px)" }}
        />
      )}
      {/* Drawer */}
      <aside
        className="fixed left-0 top-0 bottom-0 z-50 flex flex-col border-r md:hidden transition-transform duration-250 ease-out"
        style={{
          width: 260,
          backgroundColor: "var(--sidebar-bg)",
          borderColor: "var(--border)",
          transform: open ? "translateX(0)" : "translateX(-100%)",
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-3 rounded-md p-1.5"
          style={{ color: "var(--muted-foreground)" }}
        >
          <X size={18} />
        </button>
        <SidebarContent onNavigate={onClose} />
      </aside>
    </>
  );
}
