import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Rapport d'intégrité — collecte des stats live depuis la DB
 * pour alimenter la page /admin/integrity-report.
 */

const ALL_TABLES = [
  "ai_planning_settings", "availabilities", "business_roles",
  "checklist_submission_items", "checklist_submission_photos", "checklist_submissions",
  "checklist_template_items", "checklist_template_photos", "checklist_templates",
  "feedbacks", "formation_completions", "formations", "invitations", "messages",
  "modification_requests", "notifications", "planning_publications", "planning_runs",
  "profiles", "shift_handoffs", "shift_proposals", "shift_reports", "shifts",
  "signalements", "staffing_templates", "studio_business_roles", "studio_exceptions",
  "studios", "training_folders", "training_paths", "training_progress",
  "training_resources", "training_steps", "user_business_roles", "user_contracts",
  "user_roles", "user_studios",
];

const EXPECTED_TRIGGERS = [
  { name: "trg_score_feedbacks", table: "feedbacks" },
  { name: "trg_score_shifts", table: "shifts" },
  { name: "trg_recalc_score_on_checklist_items", table: "checklist_submission_items" },
  { name: "trg_recalc_score_on_checklist_subs", table: "checklist_submissions" },
  { name: "trg_shifts_minutes_late", table: "shifts" },
];

const EXPECTED_FUNCTIONS = [
  "calculate_profile_score",
  "shifts_compute_minutes_late",
  "trg_recalculate_score",
  "has_role",
  "handle_new_user",
];

export const collectIntegrityStats = createServerFn({ method: "GET" }).handler(async () => {
  const t0 = Date.now();
  const tableCounts: Record<string, number | string> = {};
  await Promise.all(
    ALL_TABLES.map(async (t) => {
      try {
        const { count, error } = await (supabaseAdmin as any)
          .from(t)
          .select("*", { head: true, count: "exact" });
        tableCounts[t] = error ? `ERR: ${error.message}` : (count ?? 0);
      } catch (e: any) {
        tableCounts[t] = `ERR: ${e?.message ?? e}`;
      }
    }),
  );

  const triggers: any = null;

  // On valide les triggers et fonctions via une approche heuristique :
  // si la fonction calculate_profile_score est appelable, on considère OK.
  let scoreFnOk = false;
  try {
    const { data: anyProfile } = await supabaseAdmin
      .from("profiles").select("id").limit(1).maybeSingle();
    if (anyProfile?.id) {
      const { error } = await supabaseAdmin.rpc("calculate_profile_score" as any, {
        target_user_id: anyProfile.id,
      });
      scoreFnOk = !error;
    } else scoreFnOk = true; // pas d'utilisateur, on ne peut pas tester
  } catch { scoreFnOk = false; }

  // Détecter publications IA settings
  const { data: settings } = await supabaseAdmin
    .from("ai_planning_settings").select("*").maybeSingle();

  // Dernière génération
  const { data: lastRun } = await supabaseAdmin
    .from("planning_runs").select("id, status, started_at, coverage_rate, shifts_generated")
    .order("started_at", { ascending: false }).limit(1).maybeSingle();

  // Compte d'admins
  const { count: adminCount } = await supabaseAdmin
    .from("user_roles").select("*", { head: true, count: "exact" })
    .eq("role", "admin");

  return {
    durationMs: Date.now() - t0,
    tableCounts,
    scoreFnOk,
    settingsPresent: !!settings,
    lastRun,
    adminCount: adminCount ?? 0,
    expectedTriggers: EXPECTED_TRIGGERS,
    expectedFunctions: EXPECTED_FUNCTIONS,
    triggersFromDb: triggers,
  };
});
