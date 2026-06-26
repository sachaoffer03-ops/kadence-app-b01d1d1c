import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertManagerPermission } from "@/lib/permission-guard.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertCanConfigureClosure(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const ok = data?.some((r: any) => r.role === "admin" || r.role === "manager");
  if (!ok) throw new Error("Réservé aux admins/managers");
}

const studioClosureSchema = z.object({
  studioId: z.string().uuid(),
  patch: z.object({
    clock_in_grace_period_min: z.number().int().min(0).max(240).optional(),
    clock_out_button_appears_before_min: z.number().int().min(0).max(240).optional(),
    clock_out_grace_period_min: z.number().int().min(0).max(240).optional(),
    clock_out_overdue_action: z.enum(["notify_manager", "auto_clock_out", "block"]).optional(),
    qr_renewal_seconds: z.number().int().min(10).max(3600).optional(),
    current_qr_code: z.string().min(1).max(20).nullable().optional(),
  }).strict(),
});

export const updateStudioClosureConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => studioClosureSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertCanConfigureClosure(context.userId);
    const { error } = await supabaseAdmin
      .from("studios")
      .update(data.patch as any)
      .eq("id", data.studioId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getStudioQrCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ studioId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertCanConfigureClosure(context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("studios")
      .select("current_qr_code, qr_renewal_seconds, qr_generated_at")
      .eq("id", data.studioId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      currentCode: (row as any)?.current_qr_code ?? "",
      renewal: (row as any)?.qr_renewal_seconds ?? 60,
      generatedAt: (row as any)?.qr_generated_at ?? null,
    };
  });

const closureQuestionSchema = z.object({
  studioId: z.string().uuid(),
  questions: z.array(z.object({
    id: z.string().uuid().optional(),
    question_text: z.string().min(1).max(500),
    response_type: z.enum(["stars_1_5", "yes_no", "free_text"]),
  })).max(50),
});

export const saveClosureQuestionsConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => closureQuestionSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertCanConfigureClosure(context.userId);

    const { data: existing, error: loadError } = await supabaseAdmin
      .from("closure_questions")
      .select("id")
      .eq("studio_id", data.studioId);
    if (loadError) throw new Error(loadError.message);

    const incomingIds = new Set(data.questions.filter((q) => q.id).map((q) => q.id));
    const removedIds = (existing ?? []).map((q: any) => q.id).filter((id: string) => !incomingIds.has(id));
    if (removedIds.length > 0) {
      const { error } = await supabaseAdmin.from("closure_questions").delete().in("id", removedIds);
      if (error) throw new Error(error.message);
    }

    for (const [orderIndex, q] of data.questions.entries()) {
      const payload = {
        studio_id: data.studioId,
        question_text: q.question_text,
        response_type: q.response_type,
        order_index: orderIndex,
      };
      const { error } = q.id
        ? await supabaseAdmin.from("closure_questions").update(payload as any).eq("id", q.id)
        : await supabaseAdmin.from("closure_questions").insert(payload as any);
      if (error) throw new Error(error.message);
    }

    const { data: fresh, error: freshError } = await supabaseAdmin
      .from("closure_questions")
      .select("*")
      .eq("studio_id", data.studioId)
      .order("order_index");
    if (freshError) throw new Error(freshError.message);
    return fresh ?? [];
  });