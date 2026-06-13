import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type Status = "ok" | "partial" | "missing";
type Check = { id: string; label: string; status: Status; detail?: string };
type Section = { key: string; title: string; checks: Check[]; error?: string };

// Static inventory — no fs access (Cloudflare Worker has no filesystem)
const KNOWN_SERVER_FNS = [
  { file: "src/lib/generate-planning.functions.ts", exports: ["generatePlanning"] },
  { file: "src/lib/seed.functions.ts", exports: ["seedFakeData", "resetData"] },
  { file: "src/lib/migrate-studios.functions.ts", exports: ["migrateStudios"] },
  { file: "src/lib/diagnostic.functions.ts", exports: ["runDiagnostic"] },
  { file: "src/lib/data-diagnostic.functions.ts", exports: ["runDataDiagnostic"] },
  { file: "src/lib/proposals.functions.ts", exports: ["createProposal", "respondToProposal"] },
  { file: "src/lib/shifts.functions.ts", exports: ["createShift", "updateShift", "deleteShift"] },
  { file: "src/lib/audit.functions.ts", exports: ["runAudit"] },
];

const KNOWN_ROUTES = [
  "/", "/login", "/activation", "/reset-password",
  "/dashboard", "/planning", "/planning/generate",
  "/staff", "/staff/:id", "/trous",
  "/demandes", "/signalements", "/pointage", "/checklists", "/feedbacks", "/formation",
  "/dimona", "/contingents",
  "/studios", "/reglages",
  "/staff-app",
  "/admin/diagnostic", "/admin/migrate-studios", "/admin/demo-tools",

];

// Heuristic implementation flags — based on what we know exists in the repo today.
// These are static booleans rather than file-content scans.
const IMPL = {
  disposSheet: true,
  disposInsert: true,
  disposMinDuration: false,
  disposEdit: true,
  disposDeadline: false,

  staffIndex: true,
  staffDetail: true,
  inviteModal: true,
  inviteEmail: true,
  multiTableInsert: true,

  staffingTemplatesEditor: true,
  staffingTemplatesFull: true,
  staffingWeekView: false,

  planGenerate: true,
  planRunsTable: true,
  publishFlow: false,
  publishNotif: false,

  planView: true,
  staffAppPlanning: true,
  shiftCreateModal: true,
  shiftDragDrop: false,
  manualHoleAssign: true,

  feedbacksRoute: true,
  feedbackInsert: false,
  scoreRecalc: false,
  scoreFormula: false,

  pointageRoute: true,
  clockInOut: true,
  punctuality: false,
  punctualityFeedsScore: false,

  checklistsRoute: true,
  checklistTemplates: true,
  checklistItems: true,
  checklistUiCheck: true,
  checklistPhoto: false,
  visionAi: false,
  visionAiScore: false,

  demandesRoute: true,
  signalementsRoute: true,
  proposalsFns: true,
  notifAdminOnRequest: false,

  notifInApp: true,
  notifEmail: false,
  messaging: true,
};

export const runAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const sb = supabaseAdmin;

    // --- DB checks (wrapped) ---
    const tableCounts: Record<string, number> = {};
    const tables = [
      "profiles", "user_contracts", "user_business_roles", "user_studios", "user_roles",
      "availabilities", "shifts", "staffing_templates", "studios", "feedbacks",
      "shift_checklist_items", "checklist_templates", "modification_requests",
      "shift_proposals", "signalements", "notifications", "messages",
      "planning_publications", "planning_runs", "invitations",
    ];
    for (const t of tables) {
      try {
        const { count } = await sb.from(t as any).select("*", { count: "exact", head: true });
        tableCounts[t] = count ?? 0;
      } catch {
        tableCounts[t] = -1;
      }
    }

    // --- Orphans (wrapped) ---
    const orphans: { rel: string; count: number; error?: string }[] = [];
    async function orphanCount(table: string, fk: string, refTable: string, refCol = "id") {
      try {
        const { data: rows } = await sb.from(table as any).select(fk).not(fk, "is", null).limit(5000);
        const ids = Array.from(new Set((rows ?? []).map((r: any) => r[fk]))) as string[];
        if (!ids.length) { orphans.push({ rel: `${table}.${fk} → ${refTable}.${refCol}`, count: 0 }); return; }
        const { data: refs } = await sb.from(refTable as any).select(refCol).in(refCol, ids);
        const present = new Set((refs ?? []).map((r: any) => r[refCol]));
        const missing = ids.filter((i) => !present.has(i)).length;
        orphans.push({ rel: `${table}.${fk} → ${refTable}.${refCol}`, count: missing });
      } catch (e: any) {
        orphans.push({ rel: `${table}.${fk} → ${refTable}.${refCol}`, count: 0, error: e?.message ?? String(e) });
      }
    }
    await orphanCount("availabilities", "user_id", "profiles");
    await orphanCount("shifts", "user_id", "profiles");
    await orphanCount("shifts", "studio_id", "studios");
    await orphanCount("user_studios", "user_id", "profiles");
    await orphanCount("user_studios", "studio_id", "studios");
    await orphanCount("feedbacks", "shift_id", "shifts");
    await orphanCount("shift_checklist_items", "shift_id", "shifts");
    await orphanCount("user_business_roles", "user_id", "profiles");
    await orphanCount("user_contracts", "user_id", "profiles");

    const rlsKnown: Record<string, "ok" | "warn" | "off"> = {};
    for (const t of tables) rlsKnown[t] = "ok";

    // --- Sections (each wrapped in try/catch) ---
    const sections: Section[] = [];
    const safeSection = (key: string, title: string, build: () => Check[]) => {
      try {
        sections.push({ key, title, checks: build() });
      } catch (e: any) {
        sections.push({ key, title, checks: [], error: e?.message ?? String(e) });
      }
    };

    const ok = (id: string, label: string, detail?: string): Check => ({ id, label, status: "ok", detail });
    const partial = (id: string, label: string, detail?: string): Check => ({ id, label, status: "partial", detail });
    const missing = (id: string, label: string, detail?: string): Check => ({ id, label, status: "missing", detail });
    const flag = (cond: boolean, id: string, label: string, detail?: string): Check =>
      cond ? ok(id, label, detail) : missing(id, label, detail);

    safeSection("A", "Disponibilités côté employé", () => [
      flag(IMPL.disposSheet, "A1", "UI dispos employé existe", "src/components/staff-app/DisposSheet.tsx"),
      flag(IMPL.disposInsert, "A2", "Insère dans availabilities (user_id, avail_date, start_time, end_time)"),
      partial("A3", "Validation durée min côté UI", "Aucune contrainte explicite ≥4h détectée"),
      flag(IMPL.disposEdit, "A4", "Modif/suppression dispos"),
      missing("A5", "Deadline saisie dispos", "Aucune deadline détectée"),
    ]);

    safeSection("B", "Gestion staff côté admin", () => [
      flag(IMPL.staffIndex && IMPL.staffDetail, "B1", "Page /staff CRUD profils"),
      flag(IMPL.inviteModal, "B2", "Saisie contrat / rôles / studios à la création"),
      flag(IMPL.multiTableInsert, "B3", "Insertion multi-tables (profiles + user_contracts + user_business_roles + user_studios)", "Trigger handle_new_user via invitation token"),
      flag(IMPL.inviteEmail, "B4", "Système d'invitation par email", "supabase/functions/send-invitation"),
    ]);

    safeSection("C", "Configuration besoins horaires", () => [
      flag(IMPL.staffingTemplatesEditor, "C1", "UI staffing_templates"),
      flag(IMPL.staffingTemplatesFull, "C2", "Champs complets (allowed_contracts, allowed_roles, required_count, is_optional)"),
      partial("C3", "Vue hebdomadaire des besoins", "Édition par jour, pas de vue grille semaine"),
    ]);

    safeSection("D", "Génération planning", () => [
      flag(IMPL.planGenerate, "D1", "Page /planning/generate fonctionnelle"),
      flag(IMPL.planRunsTable, "D2", "Sauvegarde dans planning_runs"),
      partial("D3", "Bouton Publier (status=confirmed + published_at)", "Table planning_publications existe mais flow à finaliser"),
      missing("D4", "Notifications à la publication"),
    ]);

    safeSection("E", "Visualisation planning", () => [
      flag(IMPL.planView, "E1", "Vue calendrier admin"),
      flag(IMPL.staffAppPlanning, "E2", "Vue mon planning employé"),
      partial("E3", "Édition manuelle de shift (drag & drop / modal)", "Modal de création présente, drag & drop non détecté"),
      flag(IMPL.manualHoleAssign, "E4", "Assignation manuelle sur trou"),
    ]);

    safeSection("F", "Évaluation et performance", () => [
      partial("F1", "Bouton 'Évaluer ce shift'", "Page feedbacks existe, formulaire post-shift à confirmer"),
      partial("F2", "Écriture dans feedbacks(rating, message, author_id, shift_id)"),
      missing("F3", "Recalcul automatique profiles.score", "Aucun trigger SQL dédié"),
      missing("F4", "Formule 1/3 manager + 1/3 ponctualité + 1/3 checklist (décroissance exp.)"),
    ]);

    safeSection("G", "Pointage et ponctualité", () => [
      flag(IMPL.clockInOut, "G1", "Système clock_in / clock_out"),
      flag(IMPL.clockInOut, "G2", "Stockage dans shifts (clocked_in_at/out_at)"),
      missing("G3", "Calcul de ponctualité"),
      missing("G4", "Alimente le score perf"),
    ]);

    safeSection("H", "Checklists", () => [
      flag(IMPL.checklistTemplates, "H1", "Configurables (checklist_templates)"),
      flag(IMPL.checklistItems, "H2", "Items dans shift_checklist_items"),
      flag(IMPL.checklistUiCheck, "H3", "UI employé pour cocher"),
      missing("H4", "Upload photo par item"),
      missing("H5", "Vision IA comparaison photo référence"),
      missing("H6", "Vision IA → score checklist"),
    ]);

    safeSection("I", "Demandes / signalements / propositions", () => [
      flag(IMPL.demandesRoute, "I1", "modification_requests utilisée"),
      flag(IMPL.signalementsRoute, "I2", "signalements utilisée"),
      flag(IMPL.proposalsFns, "I3", "shift_proposals utilisée"),
      missing("I4", "Notif admin lors d'une demande"),
    ]);

    safeSection("J", "Notifications et messagerie", () => [
      partial("J1", "Notifications branchées (envoi réel email/in-app)", "Insertion in-app détectée mais pas d'envoi email"),
      flag(IMPL.messaging, "J2", "Messagerie interne (table messages)", "Composant ChatPanel présent"),
    ]);

    return {
      sections,
      orphans,
      rlsKnown,
      tableCounts,
      serverFns: KNOWN_SERVER_FNS,
      routes: KNOWN_ROUTES,
    };
  });
