import * as React from "react";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { render } from "@react-email/render";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { EMAIL_REGISTRY } from "@/emails";
import { EmailTenantProvider } from "@/emails/tenant-context";
import { getEmailTenantConfig } from "@/lib/email-tenant.server";
import { assertManagerPermission } from "@/lib/permission-guard.server";

export const getEmailPreview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ templateId: z.string().min(1).max(100) }).parse(i),
  )
  .handler(async ({ data }) => {
    const template = EMAIL_REGISTRY.find((t) => t.id === data.templateId);
    if (!template) {
      throw new Error(`Template introuvable: ${data.templateId}`);
    }
    const Component = template.component as React.ComponentType<any>;
    const tenant = await getEmailTenantConfig();
    const html = await render(
      React.createElement(
        EmailTenantProvider as any,
        { value: tenant },
        React.createElement(Component, template.mockData),
      ),
    );
    return { html, subject: template.subject };
  });

// Preview live avec overrides non persistés (utilisé par /reglages Emails).
export const previewEmailTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        templateId: z.string().min(1).max(100),
        overrides: z
          .object({
            display_name: z.string().max(120).optional(),
            reply_to_email: z.string().max(200).optional(),
            logo_url: z.string().max(1000).nullable().optional(),
          })
          .default({}),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertManagerPermission(
      context.supabase,
      context.userId,
      "/reglages:edit_general",
    );
    const template = EMAIL_REGISTRY.find((t) => t.id === data.templateId);
    if (!template) throw new Error(`Template introuvable: ${data.templateId}`);
    const base = await getEmailTenantConfig();
    const tenant = {
      ...base,
      ...(data.overrides.display_name
        ? {
            displayName: data.overrides.display_name,
            fromName: data.overrides.display_name,
          }
        : {}),
      ...(data.overrides.reply_to_email !== undefined
        ? { replyToEmail: data.overrides.reply_to_email || null }
        : {}),
      ...(data.overrides.logo_url !== undefined
        ? { logoUrl: data.overrides.logo_url }
        : {}),
    };
    const Component = template.component as React.ComponentType<any>;
    const html = await render(
      React.createElement(
        EmailTenantProvider as any,
        { value: tenant },
        React.createElement(Component, template.mockData),
      ),
    );
    return { html, subject: template.subject };
  });
