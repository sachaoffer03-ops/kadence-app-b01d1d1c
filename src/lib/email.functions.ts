import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SendEmailInput = z.object({
  templateId: z.string().min(1).max(100),
  data: z.record(z.string(), z.any()),
  recipient: z.string().email(),
});

export const sendEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => SendEmailInput.parse(i))
  .handler(async ({ data, context }) => {
    const { enqueueTemplateEmail } = await import("@/lib/email-send.server");
    const idempotencyKey =
      typeof data.data?.idempotencyKey === "string"
        ? data.data.idempotencyKey
        : `${data.templateId}-${data.recipient}`;
    const { idempotencyKey: _ignored, ...templateData } = data.data;
    const res = await enqueueTemplateEmail({
      templateId: data.templateId,
      recipient: data.recipient,
      data: templateData,
      idempotencyKey,
    });
    if (!res.ok) {
      throw new Error(`Échec envoi email: ${res.reason ?? "unknown"}`);
    }
    return { ok: true, userId: context.userId, messageId: res.messageId };
  });
