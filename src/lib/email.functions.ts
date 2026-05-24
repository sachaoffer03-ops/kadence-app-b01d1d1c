import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { EMAIL_REGISTRY } from "@/emails";

const SendEmailInput = z.object({
  templateId: z.string().min(1).max(100),
  data: z.record(z.string(), z.any()),
  recipient: z.string().email(),
});

export const sendEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => SendEmailInput.parse(i))
  .handler(async ({ data, context }) => {
    const template = EMAIL_REGISTRY.find((t) => t.id === data.templateId);
    if (!template) {
      throw new Error(`Template introuvable: ${data.templateId}`);
    }

    // Forward au server route Lovable qui s'occupe du rendu, de la queue,
    // des retries, de la suppression et du tracking.
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const host = getRequestHeader("host");
    const proto = getRequestHeader("x-forwarded-proto") ?? "https";
    const baseUrl = `${proto}://${host}`;
    const authHeader = getRequestHeader("authorization");

    const idempotencyKey = `${data.templateId}-${data.recipient}-${Date.now()}`;

    const res = await fetch(`${baseUrl}/lovable/email/transactional/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify({
        templateName: data.templateId,
        recipientEmail: data.recipient,
        idempotencyKey,
        templateData: data.data,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Échec envoi email (${res.status}): ${text}`);
    }

    return { ok: true, subject: template.subject, userId: context.userId };
  });
