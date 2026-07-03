// Serveur uniquement : lit la config email d'une organisation.
// Tant que le multi-tenant n'est pas activé, on renvoie toujours la ligne
// "default" (UUID fixe). Prévu pour évoluer sans changer les callers.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  DEFAULT_EMAIL_TENANT,
  type EmailTenantConfig,
} from "@/emails/tenant-context";

export const DEFAULT_ORG_EMAIL_CONFIG_ID =
  "00000000-0000-0000-0000-000000000001";

let cached: { value: EmailTenantConfig; at: number } | null = null;
const TTL_MS = 60_000;

export async function getEmailTenantConfig(
  organizationId?: string | null,
): Promise<EmailTenantConfig> {
  const id = organizationId ?? DEFAULT_ORG_EMAIL_CONFIG_ID;

  // Petit cache mémoire (worker) pour éviter un SELECT par email.
  if (
    !organizationId &&
    cached &&
    Date.now() - cached.at < TTL_MS
  ) {
    return cached.value;
  }

  const { data, error } = await supabaseAdmin
    .from("organization_email_config" as any)
    .select(
      "display_name, from_name, brand_color, logo_url, reply_to_email, footer_note, privacy_url",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return DEFAULT_EMAIL_TENANT;
  }

  const value: EmailTenantConfig = {
    displayName: data.display_name ?? DEFAULT_EMAIL_TENANT.displayName,
    fromName: data.from_name ?? DEFAULT_EMAIL_TENANT.fromName,
    brandColor: data.brand_color ?? DEFAULT_EMAIL_TENANT.brandColor,
    logoUrl: data.logo_url ?? null,
    replyToEmail: data.reply_to_email ?? null,
    footerNote: data.footer_note ?? null,
    privacyUrl: data.privacy_url ?? DEFAULT_EMAIL_TENANT.privacyUrl,
  };

  if (!organizationId) {
    cached = { value, at: Date.now() };
  }
  return value;
}

export function clearEmailTenantCache() {
  cached = null;
}
