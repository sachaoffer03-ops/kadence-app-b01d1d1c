import * as React from "react";
import { createServerFn } from "@tanstack/react-start";
import { render } from "@react-email/render";
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
  .handler(async ({ data }) => {
    const template = EMAIL_REGISTRY.find((t) => t.id === data.templateId);
    if (!template) {
      throw new Error(`Template introuvable: ${data.templateId}`);
    }

    const Component = template.component as React.ComponentType<any>;
    const html = await render(React.createElement(Component, data.data));
    const subject = template.subject;

    // TODO : brancher Resend / Lovable Emails après la démo
    console.log("[EMAIL STUB]", {
      to: data.recipient,
      subject,
      htmlPreview: html.substring(0, 200) + "...",
    });

    return { ok: true, stub: true, subject };
  });
