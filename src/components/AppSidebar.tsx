import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  CalendarDays,
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
  Eye,
  X,
} from "lucide-react";
import logo from "@/assets/kadence-logo.png";

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

const navSections: NavSection[] = [
  {
    title: "Pilotage",
    items: [
      { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
      { label: "Rapports", to: "/rapports", icon: BarChart3 },
      { label: "Planning", to: "/planning", icon: CalendarDays },
      { label: "Staff", to: "/staff", icon: Users },
      { label: "Trous à combler", to: "/trous", icon: AlertTriangle },
    ],
  },
  {
    title: "Opérations",
    items: [
      { label: "Demandes modif", to: "/demandes", icon: FileEdit },
      { label: "Signalements", to: "/signalements", icon: PackageSearch },
      { label: "Pointage", to: "/pointage", icon: Clock },
      { label: "Clôture", to: "/cloture", icon: DoorClosed },
      { label: "Feedbacks", to: "/feedbacks", icon: MessageSquare },
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
      { label: "Réglages", to: "/reglages", icon: Settings },
    ],
  },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const currentPath = useRouterState({ select: (s) => s.location.pathname });

  return (
    <>
      {/* Logo */}
      <div className="px-4 pt-6 pb-5">
        <img src={logo} alt="Kadence" style={{ height: 80, width: "auto", maxWidth: "100%", display: "block", marginLeft: "auto", marginRight: "auto" }} />
        <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 6 }}>Skult Studios</div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 pb-3">
        {navSections.map((section) => (
          <div key={section.title} className="mb-4">
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
            {section.items.map((item) => {
              const isExternal = item.to.includes("?");
              const isActive = !isExternal && (currentPath === item.to || currentPath.startsWith(item.to + "/"));
              const linkStyle = {
                fontSize: 13,
                fontWeight: isActive ? 500 : 400,
                color: isActive ? "var(--foreground)" : "var(--sidebar-foreground)",
                backgroundColor: isActive ? "var(--sidebar-accent)" : "transparent",
              } as const;
              const inner = (
                <>
                  <item.icon size={15} strokeWidth={1.8} />
                  <span className="flex-1">{item.label}</span>
                  {item.badge && (
                    <span
                      className="inline-flex items-center justify-center rounded-full"
                      style={{
                        fontSize: 10,
                        fontWeight: 500,
                        minWidth: 18,
                        height: 18,
                        padding: "0 5px",
                        backgroundColor: item.badgeType === "danger" ? "var(--danger-bg)" : "var(--muted)",
                        color: item.badgeType === "danger" ? "var(--danger-text)" : "var(--muted-foreground)",
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                </>
              );
              if (isExternal) {
                return (
                  <a
                    key={item.to}
                    href={item.to}
                    onClick={onNavigate}
                    className="flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-colors"
                    style={linkStyle}
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
                  className="flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-colors"
                  style={linkStyle}
                >
                  {inner}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="px-4 py-3 border-t flex items-center gap-2.5" style={{ borderColor: "var(--border)" }}>
        <div
          className="flex items-center justify-center rounded-full"
          style={{
            width: 32,
            height: 32,
            backgroundColor: "var(--foreground)",
            color: "var(--coral)",
            fontSize: 11,
            fontWeight: 500,
          }}
        >
          SA
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)" }}>Sacha</div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Administrateur</div>
        </div>
      </div>
    </>
  );
}

/* Desktop sidebar */
export function AppSidebar() {
  return (
    <aside
      className="fixed left-0 top-0 bottom-0 flex-col border-r hidden md:flex"
      style={{
        width: 220,
        backgroundColor: "var(--sidebar-bg)",
        borderColor: "var(--border)",
      }}
    >
      <SidebarContent />
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
