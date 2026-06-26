// Granular permissions for managers — keys = sidebar route base paths.
// Admins always have everything; employees never enter the admin console.

export interface PermissionItem {
  key: string;         // route prefix used by sidebar & guard
  label: string;
  description?: string;
}

export interface PermissionSection {
  title: string;
  items: PermissionItem[];
}

export const PERMISSION_SECTIONS: PermissionSection[] = [
  {
    title: "Pilotage",
    items: [
      { key: "/dashboard", label: "Dashboard", description: "Vue d'ensemble & KPI" },
      { key: "/rapports", label: "Rapports", description: "Shifts, feedbacks, clôtures" },
      { key: "/planning", label: "Planning", description: "Création/édition des shifts" },
      { key: "/dispos-monitoring", label: "Monitoring dispos", description: "Suivi des disponibilités" },
      { key: "/staff", label: "Staff", description: "Fiches & historique employés" },
      { key: "/trous", label: "Trous à combler", description: "Suggestions de remplacement" },
    ],
  },
  {
    title: "Opérations",
    items: [
      { key: "/notifications", label: "Notifications", description: "Centre de notifications" },
      { key: "/demandes", label: "Demandes de modification", description: "Annulations, échanges, changements" },
      { key: "/signalements", label: "Signalements", description: "Casse, manquants, incidents" },
      { key: "/pointage", label: "Pointage", description: "Contrôle des clock-in/out" },
      { key: "/cloture", label: "Clôture", description: "Checklists & questions de fin de shift" },
      { key: "/feedbacks", label: "Feedbacks", description: "Évaluation des shifts" },
      { key: "/formation", label: "Formation", description: "Modules & quizz" },
    ],
  },
  {
    title: "Conformité",
    items: [
      { key: "/dimona", label: "Dimona", description: "Déclarations légales" },
      { key: "/contingents", label: "Quotas étudiants", description: "Suivi des heures contingent" },
    ],
  },
  {
    title: "Configuration",
    items: [
      { key: "/studios", label: "Studios & postes", description: "Établissements et rôles métier" },
      { key: "/assistant-ia", label: "Assistant IA", description: "Chatbot et base de connaissance" },
      { key: "/reglages", label: "Réglages", description: "Paramètres généraux" },
    ],
  },
];

export const ALL_PERMISSION_KEYS = PERMISSION_SECTIONS.flatMap((s) => s.items.map((i) => i.key));

// Routes always accessible to any signed-in admin/manager (profile, logout, etc.)
const ALWAYS_ALLOWED_PREFIXES = ["/login", "/logout", "/staff-app", "/activation", "/auth"];

export function canAccessRoute(
  pathname: string,
  appRole: "admin" | "manager" | "employee" | null,
  managerPerms: string[] | null,
): boolean {
  if (appRole === "admin") return true;
  if (appRole !== "manager") return false;
  if (ALWAYS_ALLOWED_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  if (!managerPerms) return false;
  return managerPerms.some((k) => pathname === k || pathname.startsWith(k + "/"));
}
