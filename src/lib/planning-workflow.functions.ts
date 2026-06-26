import { assertManagerPermission } from "@/lib/permission-guard.server";
// =============================================================================
// PLANNING WORKFLOW — draft → review → published → unpublished
// =============================================================================
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type WfStatus = "draft" | "review" | "published" | "unpublished";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (!data?.some((r: any) => r.role === "admin")) {
    throw new Error("Réservé aux administrateurs");
  }
}

async function loadRun(supabase: any, runId: string) {
  const { data, error } = await supabase
    .from("planning_runs")
    .select("id, month_start_date, month_end_date, studios_included, workflow_status, status, shifts_generated")
    .eq("id", runId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Run introuvable");
  return data;
}

function assertTransition(from: WfStatus, allowed: WfStatus[]) {
  if (!allowed.includes(from)) {
    throw new Error(`Transition impossible depuis l'état "${from}"`);
  }
}

const RunIdInput = z.object({ planning_run_id: z.string().uuid() });

// =============================================================================
// markPlanningForReview : draft → review
// =============================================================================
export const markPlanningForReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => RunIdInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertManagerPermission(supabase, userId, "/planning:publish");
    const run = await loadRun(supabase, data.planning_run_id);
    assertTransition(run.workflow_status as WfStatus, ["draft", "unpublished"]);

    const { error } = await supabase
      .from("planning_runs")
      .update({
        workflow_status: "review",
        marked_review_at: new Date().toISOString(),
        marked_review_by: userId,
      })
      .eq("id", data.planning_run_id);
    if (error) throw new Error(error.message);
    return { ok: true, workflow_status: "review" as WfStatus };
  });

// =============================================================================
// publishPlanning : review → published
// =============================================================================
export const publishPlanning = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => RunIdInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertManagerPermission(supabase, userId, "/planning:publish");
    const run = await loadRun(supabase, data.planning_run_id);
    assertTransition(run.workflow_status as WfStatus, ["review"]);

    const nowIso = new Date().toISOString();

    // Met à jour les shifts du run (sur la période + studios, hors manuels).
    // L'enum shift_status n'a pas "confirmed" : on marque la publication via
    // published_at (≠ null) + is_locked = true, et on garde status = "scheduled".
    const { data: updatedShifts, error: e1 } = await supabase
      .from("shifts")
      .update({ status: "scheduled", published_at: nowIso, is_locked: true })
      .gte("shift_date", run.month_start_date)
      .lte("shift_date", run.month_end_date)
      .in("studio_id", run.studios_included)
      .eq("is_manual", false)
      .select("id, user_id");
    if (e1) throw new Error(`Mise à jour des shifts échouée : ${e1.message}`);

    // Marque le run
    const { error: e2 } = await supabase
      .from("planning_runs")
      .update({
        workflow_status: "published",
        published_at: nowIso,
        published_by: userId,
      })
      .eq("id", data.planning_run_id);
    if (e2) throw new Error(e2.message);

    // Trace dans planning_publications (best-effort)
    await supabase.from("planning_publications").insert({
      period_start: run.month_start_date,
      period_end: run.month_end_date,
      shifts_count: updatedShifts?.length ?? 0,
      published_by: userId,
    });

    // Notifications in-app aux employés concernés
    const concernedUsers = Array.from(
      new Set((updatedShifts ?? []).map((s: any) => s.user_id).filter(Boolean))
    ) as string[];
    const monthLabel = new Date(`${run.month_start_date}T00:00:00`)
      .toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    if (concernedUsers.length > 0) {
      const rows = concernedUsers.map((uid) => ({
        user_id: uid,
        type: "planning_published",
        title: "Nouveau planning publié",
        body: `Le planning de ${monthLabel} est disponible. Consulte-le maintenant.`,
        link: "/staff-app?tab=planning",
        priority: "info",
        category: "planning",
      }));
      await supabase.from("notifications").insert(rows);
    }

    return {
      ok: true,
      workflow_status: "published" as WfStatus,
      shifts_published: updatedShifts?.length ?? 0,
      notified_users: concernedUsers.length,
    };
  });

// =============================================================================
// unpublishPlanning : published → unpublished
// =============================================================================
export const unpublishPlanning = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => RunIdInput.extend({ reason: z.string().min(3).max(500) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertManagerPermission(supabase, userId, "/planning:publish");
    const run = await loadRun(supabase, data.planning_run_id);
    assertTransition(run.workflow_status as WfStatus, ["published"]);

    const nowIso = new Date().toISOString();

    // Repasse les shifts en scheduled + déverrouille (garde published_at historique)
    const { error: e1 } = await supabase
      .from("shifts")
      .update({ status: "scheduled", is_locked: false })
      .gte("shift_date", run.month_start_date)
      .lte("shift_date", run.month_end_date)
      .in("studio_id", run.studios_included)
      .eq("is_manual", false);
    if (e1) throw new Error(`Mise à jour des shifts échouée : ${e1.message}`);

    const { error: e2 } = await supabase
      .from("planning_runs")
      .update({
        workflow_status: "unpublished",
        unpublished_at: nowIso,
        unpublished_by: userId,
        unpublished_reason: data.reason,
      })
      .eq("id", data.planning_run_id);
    if (e2) throw new Error(e2.message);

    return { ok: true, workflow_status: "unpublished" as WfStatus };
  });

// =============================================================================
// revertToDraft : review → draft  OU  unpublished → draft
// =============================================================================
export const revertPlanningToDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => RunIdInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertManagerPermission(supabase, userId, "/planning:publish");
    const run = await loadRun(supabase, data.planning_run_id);
    assertTransition(run.workflow_status as WfStatus, ["review", "unpublished"]);

    const { error } = await supabase
      .from("planning_runs")
      .update({
        workflow_status: "draft",
        marked_review_at: null,
        marked_review_by: null,
      })
      .eq("id", data.planning_run_id);
    if (error) throw new Error(error.message);

    return { ok: true, workflow_status: "draft" as WfStatus };
  });

// =============================================================================
// getPlanningRun : un seul run avec ses infos workflow
// =============================================================================
export const getPlanningRun = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => RunIdInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertManagerPermission(supabase, userId, "/planning:publish");
    const { data: run, error } = await supabase
      .from("planning_runs")
      .select(
        "id, month_start_date, month_end_date, studios_included, status, workflow_status, shifts_generated, marked_review_at, marked_review_by, published_at, published_by, unpublished_at, unpublished_by, unpublished_reason"
      )
      .eq("id", data.planning_run_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!run) throw new Error("Run introuvable");

    // Récupère les noms (best effort)
    const ids = [run.marked_review_by, run.published_by, run.unpublished_by].filter(Boolean) as string[];
    let names: Record<string, string> = {};
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, first_name, last_name").in("id", ids);
      names = Object.fromEntries((profs ?? []).map((p: any) => [p.id, `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim()]));
    }
    return { run, names };
  });
