import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InviteInput = z.object({
  email: z.string().email(),
  first_name: z.string().min(1).max(80),
  last_name: z.string().min(1).max(80),
  phone: z.string().max(40).nullable().optional(),
  studio_ids: z.array(z.string().uuid()).min(1).max(20),
  contracts: z.array(z.enum(["Étudiant", "Flexi", "CDI"])).min(1).max(10),
  business_roles: z.array(z.string().min(1).max(80)).min(1).max(20),
  app_role: z.enum(["employee", "manager"]).default("employee"),
  hire_date: z.string().nullable().optional(),
});

export const sendInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => InviteInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Vérifier que l'appelant est admin
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleData) throw new Error("Réservé aux administrateurs");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Insérer l'invitation
    const { data: inv, error: invErr } = await supabaseAdmin
      .from("invitations")
      .insert({
        email: data.email,
        first_name: data.first_name,
        last_name: data.last_name,
        phone: data.phone ?? null,
        studio_id: data.studio_ids[0] ?? null, // compat legacy
        studio_ids: data.studio_ids,
        contract: data.contracts[0] ?? null, // compat legacy
        contracts: data.contracts,
        business_roles: data.business_roles,
        app_role: data.app_role,
        hire_date: data.hire_date ?? null,
        created_by: userId,
      })
      .select("id, token")
      .single();

    if (invErr) {
      if (invErr.code === "23505") {
        throw new Error("Une invitation existe déjà pour cet email");
      }
      throw new Error(invErr.message);
    }

    // URL d'activation : toujours le domaine de production, selon le rôle
    const activationOrigin =
      data.app_role === "employee"
        ? "https://app.shyft.flashsite.fr"
        : "https://admin.shyft.flashsite.fr";
    const activationUrl = `${activationOrigin}/activation?token=${inv.token}`;

    const { data: studio } = await supabaseAdmin
      .from("studios")
      .select("name")
      .eq("id", data.studio_ids[0])
      .maybeSingle();

    // Envoi de l'email via l'infrastructure email de l'app
    let emailSent = false;
    try {
      const { getRequestHeader } = await import("@tanstack/react-start/server");
      const host = getRequestHeader("host");
      const proto = getRequestHeader("x-forwarded-proto") ?? "https";
      const authHeader = getRequestHeader("authorization");

      const r = await fetch(`${proto}://${host}/lovable/email/transactional/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        body: JSON.stringify({
          templateName: "invitation-employe",
          recipientEmail: data.email,
          idempotencyKey: `invitation-employe-${inv.id}`,
          templateData: {
            firstName: data.first_name,
            studioName: studio?.name ?? "Skult Studios",
            inviteUrl: activationUrl,
          },
        }),
      });
      emailSent = r.ok;
      if (!r.ok) {
        console.error("Invitation email send failed:", r.status, await r.text());
      }
    } catch (e) {
      console.error("Invitation email send error:", e);
    }

    return { ok: true, invitation_id: inv.id, activation_url: activationUrl, email_sent: emailSent };
  });
