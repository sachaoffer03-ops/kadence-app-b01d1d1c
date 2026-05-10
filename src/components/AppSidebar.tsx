import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  AlertTriangle,
  FileEdit,
  Clock,
  ClipboardCheck,
  MessageSquare,
  PackageSearch,
  GraduationCap,
  FileText,
  BarChart3,
  Building2,
  Settings,
  X,
} from "lucide-react";

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
      { label: "Planning", to: "/planning", icon: CalendarDays },
      { label: "Staff", to: "/staff", icon: Users, badge: 3 },
      { label: "Trous à combler", to: "/trous", icon: AlertTriangle, badge: 4, badgeType: "danger" },
    ],
  },
  {
    title: "Opérations",
    items: [
      { label: "Demandes modif", to: "/demandes", icon: FileEdit, badge: 3, badgeType: "danger" },
      { label: "Signalements", to: "/signalements", icon: PackageSearch, badge: 5, badgeType: "danger" },
      { label: "Pointage", to: "/pointage", icon: Clock },
      { label: "Checklists", to: "/checklists", icon: ClipboardCheck },
      { label: "Feedbacks", to: "/feedbacks", icon: MessageSquare, badge: 5 },
      { label: "Formation", to: "/formation", icon: GraduationCap },
    ],
  },
  {
    title: "Conformité",
    items: [
      { label: "Dimona", to: "/dimona", icon: FileText, badge: 2, badgeType: "danger" },
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
      <div className="px-5 pt-5 pb-4">
        <div style={{ fontSize: 18, fontWeight: 500, color: "var(--foreground)" }}>Shyft</div>
        <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 1 }}>Skult Studios</div>
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
              const isActive = currentPath === item.to || currentPath.startsWith(item.to + "/");
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={onNavigate}
                  className="flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-colors"
                  style={{
                    fontSize: 13,
                    fontWeight: isActive ? 500 : 400,
                    color: isActive ? "var(--foreground)" : "var(--sidebar-foreground)",
                    backgroundColor: isActive ? "var(--sidebar-accent)" : "transparent",
                  }}
                >
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
