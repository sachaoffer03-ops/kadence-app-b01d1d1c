import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertManagerPermission } from "@/lib/permission-guard.server";

const CONFIG_ID = "00000000-0000-0000-0000-000000000001";
const LOGO_BUCKET = "avatars";
const LOGO_PREFIX = "_brand/org-logos";
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

async function assertAccess(supabase: any, userId: string) {
  await assertManagerPermission(supabase, userId, "/reglages:edit_general");
}

function since30d(): string {
  return new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
}

export const getEmailStats30d = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAccess(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = since30d();

    // Dedupe: latest status per message_id
    const { data, error } = await supabaseAdmin
      .from("email_send_log")
      .select("message_id, status, created_at")
      .gte("created_at", since)
      .not("message_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(10000);
    if (error) throw new Error(error.message);

    const latest = new Map<string, string>();
    for (const r of data ?? []) {
      if (!latest.has(r.message_id as string)) latest.set(r.message_id as string, r.status as string);
    }
    const statuses = Array.from(latest.values());
    const sent = statuses.filter((s) =>
      ["sent", "delivered", "bounced", "complained"].includes(s),
    ).length;
    const delivered = statuses.filter((s) => s === "delivered").length;
    const bounced = statuses.filter((s) => s === "bounced").length;
    const complained = statuses.filter((s) => s === "complained").length;

    const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);
    return {
      sent,
      delivered,
      bounced,
      complained,
      delivery_rate: pct(delivered, sent),
      bounce_rate: pct(bounced, sent),
      complaint_rate: pct(complained, sent),
    };
  });

export const getEmailConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAccess(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("organization_email_config" as any)
      .select("id, display_name, from_name, reply_to_email, logo_url")
      .eq("id", CONFIG_ID)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      display_name: (data as any)?.from_name ?? (data as any)?.display_name ?? "",
      reply_to_email: (data as any)?.reply_to_email ?? "",
      logo_url: (data as any)?.logo_url ?? null,
    };
  });

export const updateEmailConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        display_name: z.string().trim().min(1).max(120),
        reply_to_email: z.union([z.string().trim().email(), z.literal("")]),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAccess(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("organization_email_config" as any)
      .update({
        display_name: data.display_name,
        from_name: data.display_name,
        reply_to_email: data.reply_to_email || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", CONFIG_ID);
    if (error) throw new Error(error.message);
    const { clearEmailTenantCache } = await import("@/lib/email-tenant.server");
    clearEmailTenantCache();
    return { ok: true };
  });

export const uploadOrganizationLogo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        mime: z.string().min(1).max(50),
        // base64 (sans préfixe data:) du fichier
        base64: z.string().min(1).max(4_000_000),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAccess(context.supabase, context.userId);
    const ext = ALLOWED_LOGO_MIME[data.mime];
    if (!ext) throw new Error("Format non supporté (PNG, JPEG, WEBP ou SVG uniquement)");
    const bytes = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
    if (bytes.byteLength > MAX_LOGO_BYTES) {
      throw new Error("Fichier trop lourd (max 2 MB)");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Nettoie les anciennes variantes d'extension pour éviter les fichiers orphelins
    const previous = Object.values(ALLOWED_LOGO_MIME).map(
      (e) => `${LOGO_PREFIX}/${CONFIG_ID}.${e}`,
    );
    await supabaseAdmin.storage.from(LOGO_BUCKET).remove(previous);
    const path = `${LOGO_PREFIX}/${CONFIG_ID}.${ext}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from(LOGO_BUCKET)
      .upload(path, bytes, { contentType: data.mime, upsert: true, cacheControl: "3600" });
    if (upErr) throw new Error(upErr.message);
    const { data: pub } = supabaseAdmin.storage.from(LOGO_BUCKET).getPublicUrl(path);
    // cache-buster pour forcer le rechargement dans la preview/emails
    const publicUrl = `${pub.publicUrl}?v=${Date.now()}`;
    const { error: updErr } = await supabaseAdmin
      .from("organization_email_config" as any)
      .update({ logo_url: publicUrl, updated_at: new Date().toISOString() })
      .eq("id", CONFIG_ID);
    if (updErr) throw new Error(updErr.message);
    const { clearEmailTenantCache } = await import("@/lib/email-tenant.server");
    clearEmailTenantCache();
    return { ok: true, logo_url: publicUrl };
  });

export const removeOrganizationLogo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAccess(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const paths = Object.values(ALLOWED_LOGO_MIME).map(
      (e) => `${LOGO_PREFIX}/${CONFIG_ID}.${e}`,
    );
    await supabaseAdmin.storage.from(LOGO_BUCKET).remove(paths);
    const { error } = await supabaseAdmin
      .from("organization_email_config" as any)
      .update({ logo_url: null, updated_at: new Date().toISOString() })
      .eq("id", CONFIG_ID);
    if (error) throw new Error(error.message);
    const { clearEmailTenantCache } = await import("@/lib/email-tenant.server");
    clearEmailTenantCache();
    return { ok: true };
  });

async function fetchSuppressionList(reason: "bounce" | "complaint") {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const since = since30d();
  const { data: sup, error } = await supabaseAdmin
    .from("suppressed_emails")
    .select("email, reason, metadata, created_at")
    .eq("reason", reason)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  const emails = (sup ?? []).map((r: any) => r.email);
  let templates: Record<string, string> = {};
  if (emails.length > 0) {
    const { data: logs } = await supabaseAdmin
      .from("email_send_log")
      .select("recipient_email, template_name, created_at")
      .in("recipient_email", emails)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(2000);
    for (const l of logs ?? []) {
      const k = (l.recipient_email as string).toLowerCase();
      if (!templates[k]) templates[k] = l.template_name as string;
    }
  }
  return (sup ?? []).map((r: any) => ({
    email: r.email,
    reason: r.reason,
    metadata: r.metadata,
    created_at: r.created_at,
    template_name: templates[(r.email as string).toLowerCase()] ?? null,
  }));
}

export const getBounces30d = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAccess(context.supabase, context.userId);
    return { items: await fetchSuppressionList("bounce") };
  });

export const getComplaints30d = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAccess(context.supabase, context.userId);
    return { items: await fetchSuppressionList("complaint") };
  });

export const reactivateEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        email: z.string().trim().email(),
        reason: z.enum(["bounce", "complaint"]),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAccess(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("suppressed_emails")
      .delete()
      .eq("email", data.email)
      .eq("reason", data.reason);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
