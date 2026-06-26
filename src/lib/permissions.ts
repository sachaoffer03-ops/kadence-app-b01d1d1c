// Granular permissions for managers — keys = sidebar route base paths.
// Sub-actions use the format "/route:action_name".
// Admins always have everything; employees never enter the admin console.

export interface PermissionAction {
  key: string;          // "edit_questions" (sans préfixe route)
  label: string;
  description?: string;
}

export interface PermissionItem {
  key: string;         // route prefix used by sidebar & guard
  label: string;
  description?: string;
  actions?: PermissionAction[];
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
      {
        key: "/rapports",
        label: "Rapports",
        description: "Shifts, feedbacks, clôtures",
        actions: [{ key: "export", label: "Exporter CSV" }],
      },
      {
        key: "/planning",
        label: "Planning",
        description: "Création/édition des shifts",
        actions: [
          { key: "write", label: "Créer/modifier un shift manuellement", description: "Inclut drag&drop, assignation, création shift" },
          { key: "generate", label: "Lancer une génération IA" },
          { key: "publish", label: "Publier un planning généré" },
        ],
      },
      {
        key: "/dispos-monitoring",
        label: "Monitoring dispos",
        description: "Suivi des disponibilités",
        actions: [{ key: "send_reminders", label: "Relancer les retardataires" }],
      },
      {
        key: "/staff",
        label: "Staff",
        description: "Fiches & historique employés",
        actions: [
          { key: "write", label: "Modifier un profil employé" },
          { key: "invite", label: "Inviter un nouvel employé" },
          { key: "deactivate", label: "Désactiver un employé" },
        ],
      },
      {
        key: "/trous",
        label: "Trous à combler",
        description: "Suggestions de remplacement",
        actions: [
          { key: "assign", label: "Assigner un employé à un trou" },
          { key: "send_proposals", label: "Envoyer des propositions" },
        ],
      },
    ],
  },
  {
    title: "Opérations",
    items: [
      {
        key: "/notifications",
        label: "Notifications",
        description: "Centre de notifications",
        actions: [{ key: "manage", label: "Gérer toutes les notifications" }],
      },
      {
        key: "/demandes",
        label: "Demandes de modification",
        description: "Annulations, échanges, changements",
        actions: [{ key: "accept_refuse", label: "Accepter ou refuser une demande" }],
      },
      {
        key: "/signalements",
        label: "Signalements",
        description: "Casse, manquants, incidents",
        actions: [{ key: "resolve", label: "Marquer un signalement résolu" }],
      },
      {
        key: "/pointage",
        label: "Pointage",
        description: "Contrôle des clock-in/out",
        actions: [{ key: "edit", label: "Corriger un pointage erroné" }],
      },
      {
        key: "/cloture",
        label: "Clôture",
        description: "Checklists & questions de fin de shift",
        actions: [
          { key: "read_responses", label: "Voir les réponses post-shift" },
          { key: "review_photos", label: "Valider/refuser les photos (override IA)" },
          { key: "edit_questions", label: "Modifier les questions post-shift" },
          { key: "edit_checklists", label: "Modifier les templates checklists" },
          { key: "edit_scoring", label: "Modifier les règles de scoring" },
        ],
      },
      {
        key: "/feedbacks",
        label: "Feedbacks",
        description: "Évaluation des shifts",
        actions: [{ key: "reply", label: "Répondre aux feedbacks" }],
      },
      {
        key: "/formation",
        label: "Formation",
        description: "Modules & quizz",
        actions: [
          { key: "edit_content", label: "Modifier les contenus de formation" },
          { key: "qualify_employee", label: "Qualifier un employé sur un rôle" },
        ],
      },
    ],
  },
  {
    title: "Conformité",
    items: [
      {
        key: "/dimona",
        label: "Dimona",
        description: "Déclarations légales",
        actions: [{ key: "declare", label: "Faire les déclarations Dimona" }],
      },
      { key: "/contingents", label: "Quotas étudiants", description: "Suivi des heures contingent" },
    ],
  },
  {
    title: "Configuration",
    items: [
      {
        key: "/studios",
        label: "Studios & postes",
        description: "Établissements et rôles métier",
        actions: [{ key: "write", label: "Créer/modifier un studio" }],
      },
      {
        key: "/assistant-ia",
        label: "Assistant IA",
        description: "Chatbot et base de connaissance",
        actions: [
          { key: "add_knowledge", label: "Ajouter de l'info à la base" },
          { key: "edit_knowledge", label: "Modifier ou supprimer la base" },
        ],
      },
      {
        key: "/reglages",
        label: "Réglages",
        description: "Paramètres généraux",
        actions: [
          { key: "edit_quotas", label: "Modifier les quotas hebdo (max_weekly_*)" },
          { key: "edit_clockings", label: "Modifier paramètres pointage (geo, QR, grace)" },
          { key: "edit_general", label: "Modifier les paramètres généraux" },
        ],
      },
    ],
  },
];

export const ALL_PAGE_KEYS = PERMISSION_SECTIONS.flatMap((s) => s.items.map((i) => i.key));
export const ALL_ACTION_KEYS = PERMISSION_SECTIONS.flatMap((s) =>
  s.items.flatMap((i) => (i.actions ?? []).map((a) => `${i.key}:${a.key}`)),
);
// Garde le nom historique : inclut désormais pages + actions pour validation server.
export const ALL_PERMISSION_KEYS = [...ALL_PAGE_KEYS, ...ALL_ACTION_KEYS];

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
  // Seules les clés "page" comptent ici (pas les sous-actions avec ":").
  return managerPerms.some((k) => !k.includes(":") && (pathname === k || pathname.startsWith(k + "/")));
}

/**
 * Vérifie une permission granulaire.
 * Format : "/cloture" (page) ou "/cloture:edit_questions" (action).
 * Admin → toujours true. Manager → consulte managerPerms. Sinon → false.
 */
export function hasPermission(
  key: string,
  appRole: "admin" | "manager" | "employee" | null,
  managerPerms: string[] | null,
): boolean {
  if (appRole === "admin") return true;
  if (appRole !== "manager") return false;
  if (!managerPerms || managerPerms.length === 0) return false;
  return managerPerms.includes(key);
}

export const PRESET_MANAGER_SKULT: string[] = [
  // Pages
  "/planning", "/dispos-monitoring", "/staff", "/trous",
  "/notifications", "/demandes", "/signalements",
  "/pointage", "/cloture", "/feedbacks", "/formation", "/assistant-ia",
  // Sous-actions
  "/planning:write", "/planning:generate", "/planning:publish",
  "/dispos-monitoring:send_reminders",
  "/staff:write", "/staff:invite", "/staff:deactivate",
  "/trous:assign", "/trous:send_proposals",
  "/notifications:manage",
  "/demandes:accept_refuse",
  "/signalements:resolve",
  "/pointage:edit",
  "/cloture:read_responses", "/cloture:review_photos",
  "/cloture:edit_questions", "/cloture:edit_checklists", "/cloture:edit_scoring",
  "/feedbacks:reply",
  "/formation:edit_content", "/formation:qualify_employee",
  "/assistant-ia:add_knowledge",
];
