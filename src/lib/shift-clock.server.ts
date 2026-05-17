import { supabaseAdmin } from "@/integrations/supabase/client.server";

type CompleteShiftClockOutInput = {
  shiftId: string;
  actorId: string;
  submissionId?: string | null;
  rating?: number | null;
  feedbackMsg?: string | null;
  reportMsg?: string | null;
  handoffMsg?: string | null;
};

const cleanText = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

export async function completeShiftClockOut(input: CompleteShiftClockOutInput) {
  const { data: shift, error: shiftError } = await supabaseAdmin
    .from("shifts")
    .select("id,user_id,clocked_in_at,clocked_out_at")
    .eq("id", input.shiftId)
    .maybeSingle();

  if (shiftError) throw new Error(shiftError.message);
  if (!shift) throw new Error("Shift introuvable");

  const { data: roles, error: rolesError } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", input.actorId);
  if (rolesError) throw new Error(rolesError.message);

  const isAdminLike = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "manager");
  const isOwner = shift.user_id === input.actorId;
  if (!isOwner && !isAdminLike) throw new Error("Tu ne peux pas clôturer ce shift");
  if (!shift.clocked_in_at) throw new Error("Tu dois d'abord pointer ton arrivée");
  if (shift.clocked_out_at) return { alreadyCompleted: true, completedAt: shift.clocked_out_at as string };

  if (input.submissionId) {
    const { data: submission, error: subReadError } = await supabaseAdmin
      .from("checklist_submissions")
      .select("id,shift_id,user_id")
      .eq("id", input.submissionId)
      .maybeSingle();
    if (subReadError) throw new Error(subReadError.message);
    if (!submission || submission.shift_id !== input.shiftId || submission.user_id !== shift.user_id) {
      throw new Error("Checklist invalide pour ce shift");
    }
    const { error: subUpdateError } = await supabaseAdmin
      .from("checklist_submissions")
      .update({ status: "completed", submitted_at: new Date().toISOString() })
      .eq("id", input.submissionId);
    if (subUpdateError) throw new Error(subUpdateError.message);
  }

  const feedbackMsg = cleanText(input.feedbackMsg);
  const reportMsg = cleanText(input.reportMsg);
  const handoffMsg = cleanText(input.handoffMsg);

  if ((input.rating && input.rating > 0) || feedbackMsg) {
    const { error } = await supabaseAdmin.from("feedbacks").insert({
      shift_id: input.shiftId,
      author_id: input.actorId,
      rating: input.rating && input.rating > 0 ? input.rating : 3,
      message: feedbackMsg,
    });
    if (error) throw new Error(error.message);
  }
  if (reportMsg) {
    const { error } = await supabaseAdmin.from("shift_reports").insert({
      shift_id: input.shiftId,
      author_id: input.actorId,
      message: reportMsg,
    });
    if (error) throw new Error(error.message);
  }
  if (handoffMsg) {
    const { error } = await supabaseAdmin.from("shift_handoffs").insert({
      shift_id: input.shiftId,
      author_id: input.actorId,
      message: handoffMsg,
    });
    if (error) throw new Error(error.message);
  }

  const completedAt = new Date().toISOString();
  const { data: updated, error: updateError } = await supabaseAdmin
    .from("shifts")
    .update({ status: "completed", clocked_out_at: completedAt })
    .eq("id", input.shiftId)
    .is("clocked_out_at", null)
    .select("id")
    .maybeSingle();
  if (updateError) throw new Error(updateError.message);
  if (!updated) return { alreadyCompleted: true, completedAt };

  return { alreadyCompleted: false, completedAt };
}