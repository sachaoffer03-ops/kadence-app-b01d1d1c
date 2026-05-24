import * as React from "react";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { render } from "@react-email/render";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { EMAIL_REGISTRY } from "@/emails";

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
    const html = await render(
      React.createElement(Component, template.mockData),
    );
    return { html, subject: template.subject };
  });
