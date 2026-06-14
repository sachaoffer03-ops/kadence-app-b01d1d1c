import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const diagnoseLastPlanningRun = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Vérifier admin
    const { data: role } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) throw new Error("Admin uniquement");

    const { data: lastFailed } = await supabaseAdmin
      .from("planning_runs")
      .select("id, status, started_at, completed_at, error_message, solver_logs, month_start_date, month_end_date")
      .eq("status", "failed")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!lastFailed) {
      return { hasFailed: false as const };
    }

    const err = (lastFailed.error_message || "").toLowerCase();
    let hypothesis = "Erreur non catégorisée";
    let action = "Inspecter les logs solver et le message d'erreur ci-dessus";

    if (!err) {
      hypothesis = "Run failed sans message d'erreur";
      action = "Vérifier les solver_logs pour comprendre l'échec";
    } else if (err.includes("aucun employé") || err.includes("no employee") || err.includes("eligible")) {
      hypothesis = "Aucun employé éligible pour la période";
      action = "Vérifier que les employés ont saisi leurs dispos et sont rattachés aux studios concernés";
    } else if (err.includes("timeout") || err.includes("timed out") || err.includes("temps")) {
      hypothesis = "Timeout du solver (trop de combinatoire)";
      action = "Réduire la période ou le nombre de studios traités en parallèle";
    } else if (err.includes("template") || err.includes("staffing")) {
      hypothesis = "Templates de staffing manquants ou invalides";
      action = "Vérifier les staffing_templates pour les studios actifs";
    } else if (err.includes("contract") || err.includes("contrat")) {
      hypothesis = "Problème de contrats employés (heures, type)";
      action = "Vérifier user_contracts pour les employés concernés";
    } else {
      hypothesis = "Erreur applicative — voir message brut";
      action = lastFailed.error_message?.slice(0, 200) || "Voir logs";
    }

    return {
      hasFailed: true as const,
      run: lastFailed,
      hypothesis,
      action,
    };
  });
