import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertManagerPermission } from "@/lib/permission-guard.server";

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

    // Vérifier que l'appelant est admin ou manager
    await assertManagerPermission(supabase, userId, "/staff:invite");


    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Garde-fous anti-doublons
    const emailNorm = data.email.trim().toLowerCase();
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, status")
      .ilike("email", emailNorm)
      .maybeSingle();
    if (existingProfile) {
      throw new Error("Un compte existe déjà pour cet email");
    }
    const { data: existingInv } = await supabaseAdmin
      .from("invitations")
      .select("id")
      .ilike("email", emailNorm)
      .eq("status", "pending")
      .maybeSingle();
    if (existingInv) {
      throw new Error("Une invitation est déjà en attente pour cet email");
    }

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
        ? "https://app.kadence.be"
        : "https://admin.kadence.be";
    const activationUrl = `${activationOrigin}/activation?token=${inv.token}`;

    const { data: studio } = await supabaseAdmin
      .from("studios")
      .select("name")
      .eq("id", data.studio_ids[0])
      .maybeSingle();

    // Envoi de l'email via l'infrastructure email de l'app.
    // On appelle directement enqueueTemplateEmail (self-fetch de
    // /lovable/email/transactional/send est peu fiable dans le Worker).
    let emailSent = false;
    try {
      const { enqueueTemplateEmail } = await import("@/lib/email-send.server");
      const res = await enqueueTemplateEmail({
        templateId: "invitation-employe",
        recipient: data.email,
        idempotencyKey: `invitation-employe-${inv.id}`,
        data: {
          firstName: data.first_name,
          studioName: studio?.name ?? "Skult Studios",
          inviteUrl: activationUrl,
        },
      });
      emailSent = res.ok;
      if (!res.ok) {
        console.error("Invitation email send failed:", res.reason);
      }
    } catch (e) {
      console.error("Invitation email send error:", e);
    }

    return { ok: true, invitation_id: inv.id, activation_url: activationUrl, email_sent: emailSent };
  });

// Renvoyer l'email d'une invitation existante (sans créer de doublon)
const ResendInput = z.object({ invitation_id: z.string().uuid() });

export const resendInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ResendInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    await assertManagerPermission(supabase, userId, "/staff:invite");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: inv, error: invErr } = await supabaseAdmin
      .from("invitations")
      .select("id, email, first_name, token, app_role, status, studio_id, studio_ids")
      .eq("id", data.invitation_id)
      .maybeSingle();
    if (invErr || !inv) throw new Error("Invitation introuvable");
    if (inv.status === "accepted") throw new Error("Cette invitation a déjà été acceptée");

    // Réactiver si révoquée/expirée et prolonger
    await supabaseAdmin
      .from("invitations")
      .update({ status: "pending", expires_at: "9999-12-31T23:59:59Z" })
      .eq("id", inv.id);

    const activationOrigin =
      inv.app_role === "employee"
        ? "https://app.kadence.be"
        : "https://admin.kadence.be";
    const activationUrl = `${activationOrigin}/activation?token=${inv.token}`;

    const studioId = inv.studio_ids?.[0] ?? inv.studio_id ?? null;
    const { data: studio } = studioId
      ? await supabaseAdmin.from("studios").select("name").eq("id", studioId).maybeSingle()
      : { data: null as any };

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
        recipientEmail: inv.email,
        // suffix timestamp to bypass idempotency cache after a previous DLQ
        idempotencyKey: `invitation-employe-${inv.id}-${Date.now()}`,
        templateData: {
          firstName: inv.first_name,
          studioName: studio?.name ?? "Skult Studios",
          inviteUrl: activationUrl,
        },
      }),
    });
    if (!r.ok) {
      const txt = await r.text();
      console.error("Resend invitation email failed:", r.status, txt);
      throw new Error("L'envoi de l'email a échoué");
    }
    return { ok: true, email: inv.email };
  });

