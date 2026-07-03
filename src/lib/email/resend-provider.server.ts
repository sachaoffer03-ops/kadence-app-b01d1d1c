// Provider Resend — envoi transactionnel via l'API Resend officielle.
// Utilisé quand EMAIL_PROVIDER = "resend" ou "both".
// Ne remplace PAS les emails d'auth (qui restent sur Lovable Emails).

import { Resend } from "resend";
import {
  RESEND_FROM_ADDRESS,
} from "./provider-config.server";

export interface SendViaResendInput {
  to: string;
  fromName: string;
  replyTo?: string | null;
  subject: string;
  html: string;
  text?: string;
  tags?: Record<string, string>;
  headers?: Record<string, string>;
}

export interface SendViaResendResult {
  ok: boolean;
  provider: "resend";
  id?: string;
  error?: string;
}

let cachedClient: Resend | null = null;
function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!cachedClient) cachedClient = new Resend(key);
  return cachedClient;
}

// Resend n'accepte que [A-Za-z0-9_-] pour les noms/valeurs de tags.
function sanitizeTagValue(v: string): string {
  return v.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 256) || "unknown";
}

export async function sendViaResend(
  input: SendViaResendInput,
): Promise<SendViaResendResult> {
  const client = getClient();
  if (!client) {
    return { ok: false, provider: "resend", error: "RESEND_API_KEY manquant" };
  }

  const from = `${input.fromName} <${RESEND_FROM_ADDRESS}>`;
  const tags = input.tags
    ? Object.entries(input.tags).map(([name, value]) => ({
        name: sanitizeTagValue(name),
        value: sanitizeTagValue(String(value)),
      }))
    : undefined;

  try {
    const { data, error } = await client.emails.send({
      from,
      to: input.to,
      replyTo: input.replyTo ?? undefined,
      subject: input.subject,
      html: input.html,
      text: input.text,
      tags,
      headers: input.headers,
    });
    if (error) {
      return {
        ok: false,
        provider: "resend",
        error: error.message ?? String(error),
      };
    }
    return { ok: true, provider: "resend", id: data?.id };
  } catch (e) {
    return {
      ok: false,
      provider: "resend",
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
