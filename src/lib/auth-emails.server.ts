// Server-only helper — génère un lien d'auth via supabaseAdmin puis envoie
// l'email via notre pipeline Resend (queue transactional_emails, tenant-aware).
// Remplace le webhook Supabase Auth → Lovable Emails quand
// AUTH_EMAIL_PROVIDER === "kadence".

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { enqueueTemplateEmail } from "@/lib/email-send.server";

export type AuthEmailType =
  | "signup"
  | "invite"
  | "magiclink"
  | "recovery"
  | "email_change"
  | "reauthentication";

export type AuthEmailProvider = "lovable" | "kadence";

export function getAuthEmailProvider(): AuthEmailProvider {
  const raw = (process.env.AUTH_EMAIL_PROVIDER || "").toLowerCase();
  return raw === "kadence" ? "kadence" : "lovable";
}

const ROOT_DOMAIN = "kadence.be";

// Mapping type Supabase → template Kadence enregistré dans EMAIL_REGISTRY.
const TEMPLATE_BY_TYPE: Record<AuthEmailType, string> = {
  signup: "auth-signup-confirm",
  invite: "invitation-employe",
  magiclink: "auth-magic-link",
  recovery: "reset-password",
  email_change: "auth-email-change",
  reauthentication: "auth-reauthentication",
};

export interface SendAuthEmailInput {
  type: AuthEmailType;
  email: string;
  redirectTo?: string;
  data?: Record<string, unknown>;
  newEmail?: string; // requis pour email_change
  password?: string; // requis pour signup si on veut créer un user
  organizationId?: string | null;
  firstName?: string | null;
  extraTemplateData?: Record<string, unknown>;
}

export interface SendAuthEmailResult {
  ok: boolean;
  reason?: string;
  messageId?: string;
}

// generateLink retourne l'action_link (URL magic) et éventuellement un
// token_hash. Pour recovery on préfère construire notre propre URL basée sur
// token_hash + /reset-password (flow verifyOtp, cross-device safe).
export async function sendAuthEmail(
  input: SendAuthEmailInput,
): Promise<SendAuthEmailResult> {
  const email = input.email.trim().toLowerCase();
  if (!email.includes("@")) return { ok: false, reason: "invalid_email" };

  const genOptions: Record<string, unknown> = {};
  if (input.redirectTo) genOptions.redirectTo = input.redirectTo;
  if (input.data) genOptions.data = input.data;

  const params: any = { type: input.type, email, options: genOptions };
  if (input.type === "email_change" && input.newEmail) {
    params.newEmail = input.newEmail;
  }
  if (input.type === "signup" && input.password) {
    params.password = input.password;
  }

  const { data: linkData, error } =
    await supabaseAdmin.auth.admin.generateLink(params);

  if (error || !linkData) {
    return {
      ok: false,
      reason: error?.message ?? "generateLink_failed",
    };
  }

  const props = linkData.properties;
  let confirmationUrl = props?.action_link ?? "";
  const tokenHash = props?.hashed_token ?? "";
  const token = props?.email_otp ?? "";

  // Pour recovery on route vers notre page /reset-password (verifyOtp)
  if (input.type === "recovery" && tokenHash) {
    confirmationUrl = `https://${ROOT_DOMAIN}/reset-password?token_hash=${encodeURIComponent(
      tokenHash,
    )}&type=recovery`;
  }

  const templateId = TEMPLATE_BY_TYPE[input.type];
  const templateData: Record<string, unknown> = {
    firstName: input.firstName ?? "",
    email,
    confirmationUrl,
    resetUrl: confirmationUrl, // alias pour ResetPasswordEmail
    inviteUrl: confirmationUrl, // alias pour InvitationEmployeEmail
    token,
    ...(input.type === "email_change"
      ? { oldEmail: email, newEmail: input.newEmail ?? "" }
      : {}),
    ...(input.extraTemplateData ?? {}),
  };

  const idempotencyKey = `auth-${input.type}-${email}-${Date.now()}`;
  const res = await enqueueTemplateEmail({
    templateId,
    recipient: email,
    idempotencyKey,
    organizationId: input.organizationId ?? null,
    data: templateData,
  });

  return res;
}
