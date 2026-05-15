import { supabase } from "@/integrations/supabase/client";
import type { ChecklistTemplate } from "@/types/checklists";

export interface ApplicableTemplateContext {
  shiftId: string;
  studioId: string | null;
  businessRole: string;
  userId: string;
}

/**
 * Find the most specific active checklist template that applies to a given shift.
 * Specificity priority (high → low):
 *   1. role + studio match
 *   2. role match (any studio)
 *   3. studio match (any role)
 *   4. fully generic
 * Returns null if no template applies.
 */
export async function findApplicableTemplate(ctx: { studioId: string | null; businessRole: string }): Promise<ChecklistTemplate | null> {
  const { data: roleRow } = await supabase
    .from("business_roles")
    .select("id")
    .eq("name", ctx.businessRole)
    .maybeSingle();
  const roleId = (roleRow as any)?.id ?? null;

  const { data: tpls } = await supabase
    .from("checklist_templates" as any)
    .select("*")
    .eq("is_active", true);

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
 * Get-or-create a submission row for (user, shift, template).
 * Idempotent: returns the existing submission if one exists.
 */
export async function getOrCreateSubmission(userId: string, shiftId: string, templateId: string): Promise<string> {
  const { data: existing } = await supabase
    .from("checklist_submissions" as any)
    .select("id")
    .eq("user_id", userId)
    .eq("shift_id", shiftId)
    .eq("template_id", templateId)
    .maybeSingle();
  if (existing) return (existing as any).id;
  const { data, error } = await supabase
    .from("checklist_submissions" as any)
    .insert({ user_id: userId, shift_id: shiftId, template_id: templateId, status: "in_progress" } as any)
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
