// Server-only helper to render a React Email template and enqueue it
// into the transactional_emails pgmq queue. Use this from server functions
// and server routes instead of self-fetching /lovable/email/transactional/send
// (self-fetch does not work reliably in the Worker runtime).

import * as React from "react";
import { render } from "@react-email/components";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { EMAIL_REGISTRY } from "@/emails";

const SITE_NAME = "Skult Studios";
const SENDER_DOMAIN = "notify.kadence.be";
const FROM_DOMAIN = "kadence.be";

function genToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface EnqueueTemplateEmailInput {
  templateId: string;
  recipient: string;
  data: Record<string, any>;
  idempotencyKey?: string;
  subject?: string;
}

export interface EnqueueTemplateEmailResult {
  ok: boolean;
  reason?: string;
  messageId?: string;
}

export async function enqueueTemplateEmail(
  input: EnqueueTemplateEmailInput,
): Promise<EnqueueTemplateEmailResult> {
  const template = EMAIL_REGISTRY.find((t) => t.id === input.templateId);
  if (!template) return { ok: false, reason: "template_not_found" };

  const recipient = input.recipient.toLowerCase().trim();
  if (!recipient || !recipient.includes("@")) {
    return { ok: false, reason: "invalid_recipient" };
  }

  // 1. suppression
  const { data: suppressed } = await supabaseAdmin
    .from("suppressed_emails")
    .select("id")
    .eq("email", recipient)
    .maybeSingle();
  if (suppressed) return { ok: false, reason: "suppressed" };

  // 2. unsubscribe token (reuse if exists)
  let token: string;
  const { data: existing } = await supabaseAdmin
    .from("email_unsubscribe_tokens")
    .select("token, used_at")
    .eq("email", recipient)
    .maybeSingle();
  if (existing?.used_at) return { ok: false, reason: "unsubscribed" };
  if (existing?.token) {
    token = existing.token;
  } else {
    token = genToken();
    await supabaseAdmin
      .from("email_unsubscribe_tokens")
      .upsert(
        { token, email: recipient },
        { onConflict: "email", ignoreDuplicates: true },
      );
    const { data: stored } = await supabaseAdmin
      .from("email_unsubscribe_tokens")
      .select("token")
      .eq("email", recipient)
      .maybeSingle();
    token = stored?.token ?? token;
  }

  // 3. render
  const element = React.createElement(template.component as any, input.data);
  const html = await render(element);
  const text = await render(element, { plainText: true });

  const subject = input.subject ?? template.subject;
  const messageId = crypto.randomUUID();
  const idempotencyKey = input.idempotencyKey ?? messageId;

  // 4. log pending
  await supabaseAdmin.from("email_send_log").insert({
    message_id: messageId,
    template_name: input.templateId,
    recipient_email: recipient,
    status: "pending",
  });

  // 5. enqueue
  const { error: enqErr } = await supabaseAdmin.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload: {
      message_id: messageId,
      to: recipient,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject,
      html,
      text,
      purpose: "transactional",
      label: input.templateId,
      idempotency_key: idempotencyKey,
      unsubscribe_token: token,
      queued_at: new Date().toISOString(),
    } as any,
  });
  if (enqErr) {
    await supabaseAdmin.from("email_send_log").insert({
      message_id: messageId,
      template_name: input.templateId,
      recipient_email: recipient,
      status: "failed",
      error_message: `enqueue failed: ${enqErr.message}`,
    });
    return { ok: false, reason: enqErr.message, messageId };
  }

  return { ok: true, messageId };
}
