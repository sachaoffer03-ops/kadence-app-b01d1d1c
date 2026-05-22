import { supabase } from "@/integrations/supabase/client";
import type { ChecklistTemplate } from "@/types/checklists";

export type ChecklistPhase = "opening" | "transition" | "closing";
export type ChecklistMoment = ChecklistPhase | null;

export interface ApplicableTemplateContext {
  shiftId: string;
  studioId: string | null;
  businessRole: string;
  userId: string;
}

/**
 * Find the most specific active checklist template that applies to a given shift+phase.
 * Specificity priority (high → low):
 *   1. role + studio match
 *   2. role match (any studio)
 *   3. studio match (any role)
 *   4. fully generic
 * Returns null if no template applies for the requested phase.
 */
export async function findApplicableTemplate(ctx: {
  studioId: string | null;
  businessRole: string;
  phase?: ChecklistPhase;
}): Promise<ChecklistTemplate | null> {
  const phase: ChecklistPhase = ctx.phase ?? "closing";
  const { data: roleRow } = await supabase
    .from("business_roles")
    .select("id")
    .eq("name", ctx.businessRole)
    .maybeSingle();
  const roleId = (roleRow as any)?.id ?? null;

  const { data: tpls } = await supabase
    .from("checklist_templates" as any)
    .select("*")
    .eq("is_active", true)
    .eq("phase", phase);

  const list = ((tpls as any[]) ?? []).filter((t) =>
    (t.business_role_id === roleId || t.business_role_id === null) &&
    (t.studio_id === ctx.studioId || t.studio_id === null)
  );
  list.sort((a, b) => {
    const score = (t: any) => (t.business_role_id ? 2 : 0) + (t.studio_id ? 1 : 0);
    return score(b) - score(a);
  });
  return (list[0] as ChecklistTemplate) ?? null;
}

/**
 * Detect which checklist phase applies at clock-in / clock-out based on the day's
 * cascade of shifts on the same studio × business_role.
 *
 * clock_in :
 *   - If NO other shift ends at/before my start_time → 'opening'
 *   - Otherwise → 'transition'
 *
 * clock_out :
 *   - If NO other shift starts at/after my end_time → 'closing'
 *   - Otherwise → 'transition'
 *
 * Returns null if no template is configured for the resolved phase (caller can skip flow).
 */
export async function detectChecklistMoment(args: {
  shiftId: string;
  side: "clock_in" | "clock_out";
}): Promise<ChecklistMoment> {
  const { data: shift } = await supabase
    .from("shifts")
    .select("id, shift_date, start_time, end_time, business_role, studio_id")
    .eq("id", args.shiftId)
    .maybeSingle();
  if (!shift) return null;

  const { data: peers } = await supabase
    .from("shifts")
    .select("id, start_time, end_time, status, user_id")
    .eq("shift_date", (shift as any).shift_date)
    .eq("business_role", (shift as any).business_role)
    .eq("studio_id", (shift as any).studio_id)
    .neq("id", (shift as any).id)
    .not("user_id", "is", null)
    .neq("status", "cancelled");

  const others = ((peers as any[]) ?? []);
  let phase: ChecklistPhase;
  if (args.side === "clock_in") {
    const hasEarlier = others.some((s) => s.end_time <= (shift as any).start_time);
    phase = hasEarlier ? "transition" : "opening";
  } else {
    const hasLater = others.some((s) => s.start_time >= (shift as any).end_time);
    phase = hasLater ? "transition" : "closing";
  }

  // Confirm a template actually exists for this phase — otherwise no checklist to show.
  const tpl = await findApplicableTemplate({
    studioId: (shift as any).studio_id,
    businessRole: (shift as any).business_role,
    phase,
  });
  return tpl ? phase : null;
}

/**
 * Get-or-create a submission row for (user, shift, template, phase).
 * Idempotent: returns the existing submission if one exists.
 */
export async function getOrCreateSubmission(
  userId: string,
  shiftId: string,
  templateId: string,
  phase: ChecklistPhase = "closing",
): Promise<string> {
  const { data: existing } = await supabase
    .from("checklist_submissions" as any)
    .select("id")
    .eq("user_id", userId)
    .eq("shift_id", shiftId)
    .eq("template_id", templateId)
    .eq("phase", phase)
    .maybeSingle();
  if (existing) return (existing as any).id;
  const { data, error } = await supabase
    .from("checklist_submissions" as any)
    .insert({ user_id: userId, shift_id: shiftId, template_id: templateId, status: "in_progress", phase } as any)
    .select("id")
    .single();
  if (error) throw error;
  return (data as any).id;
}

/**
 * Upload a submission photo to the private bucket.
 * Path convention enforced by storage RLS: submissions/{user_id}/{filename}
 */
export async function uploadSubmissionPhoto(
  file: File,
  userId: string,
  submissionId: string,
  templatePhotoId: string,
): Promise<string> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `submissions/${userId}/${submissionId}-${templatePhotoId}.${ext}`;
  const { error } = await supabase.storage
    .from("checklist-photos")
    .upload(path, file, { contentType: file.type || "image/jpeg", upsert: true });
  if (error) throw error;
  return path;
}

/**
 * Notify the employee that picks up the next shift on the same studio × business_role.
 * Called after a transition clock_out so the next person knows the previous one finished.
 * Best-effort: silent on failure.
 */
export async function notifyTransitionIncoming(args: {
  fromShiftId: string;
  fromUserFirstName?: string | null;
  handoffMessage?: string | null;
}): Promise<void> {
  try {
    const { data: shift } = await supabase
      .from("shifts")
      .select("shift_date, end_time, business_role, studio_id")
      .eq("id", args.fromShiftId)
      .maybeSingle();
    if (!shift) return;
    const { data: next } = await supabase
      .from("shifts")
      .select("id, user_id, start_time")
      .eq("shift_date", (shift as any).shift_date)
      .eq("business_role", (shift as any).business_role)
      .eq("studio_id", (shift as any).studio_id)
      .gte("start_time", (shift as any).end_time)
      .not("user_id", "is", null)
      .neq("status", "cancelled")
      .order("start_time", { ascending: true })
      .limit(1);
    const target = (next ?? [])[0] as any;
    if (!target?.user_id) return;
    const who = args.fromUserFirstName?.trim() || "L'équipe précédente";
    const handoff = args.handoffMessage?.trim()
      ? ` Message : « ${args.handoffMessage.trim().slice(0, 140)} »`
      : "";
    await supabase.from("notifications").insert({
      user_id: target.user_id,
      type: "shift_transition_incoming",
      title: "Bientôt à toi",
      body: `${who} vient de finir son service.${handoff}`,
      link: "/staff-app?tab=planning",
      priority: "normal",
      category: "shift",
    } as any);
  } catch (e) {
    console.warn("[notifyTransitionIncoming]", e);
  }
}
