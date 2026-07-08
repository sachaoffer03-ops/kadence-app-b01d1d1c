import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  token: z.string().min(1).max(200),
  phone: z.string().max(40).nullable().optional(),
  birth_date: z.string().max(20).nullable().optional(),
  nationality: z.string().max(80).nullable().optional(),
  city: z.string().max(120).nullable().optional(),
  address: z.string().max(255).nullable().optional(),
  niss: z.string().max(40).nullable().optional(),
  iban: z.string().max(50).nullable().optional(),
  emergency_contact_name: z.string().max(120).nullable().optional(),
  emergency_contact_phone: z.string().max(40).nullable().optional(),
  emergency_contact_relation: z.string().max(80).nullable().optional(),
  student_card_valid: z.boolean().optional(),
  avatar_url: z.string().url().max(1000).nullable().optional(),
});

const PrepareInput = z.object({
  token: z.string().min(1).max(200),
  password: z.string().min(1).max(200),
});

export const prepareActivationAccount = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => PrepareInput.parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const normalized = data.token.replace(/[^a-fA-F0-9]/gi, "").toLowerCase();

    const { data: inv, error: invError } = await supabaseAdmin
      .from("invitations")
      .select("id, email, first_name, last_name, app_role")
      .eq("token", normalized)
      .eq("status", "pending")
      .maybeSingle();

    if (invError) throw new Error(invError.message);
    if (!inv) throw new Error("Invitation introuvable");

    const email = (inv.email || "").trim().toLowerCase();
    if (!email) throw new Error("Email d'invitation invalide");

    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, email")
      .ilike("email", email)
      .maybeSingle();

    let existingUser: { id: string; email?: string | null; user_metadata?: Record<string, unknown> | null } | null = null;
    for (let page = 1; page <= 20 && !existingUser; page += 1) {
      const { data: pageData, error: listError } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 1000,
      });
      if (listError) throw new Error(listError.message);
      existingUser =
        pageData.users.find((user) => (user.email || "").toLowerCase() === email) || null;
      if (pageData.users.length < 1000) break;
    }

    const metadata = {
      ...(existingUser?.user_metadata || {}),
      invitation_token: normalized,
      first_name: inv.first_name,
      last_name: inv.last_name,
    };

    if (existingUser) {
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
        password: data.password,
        email_confirm: true,
        user_metadata: metadata,
      });
      if (updateError) throw new Error(updateError.message);

      if (existingProfile && existingProfile.id !== existingUser.id) {
        const { error: mergeError } = await supabaseAdmin.rpc("merge_profile_data", {
          old_id: existingProfile.id,
          new_id: existingUser.id,
        });
        if (mergeError) throw new Error(mergeError.message);

        await supabaseAdmin.from("profiles").delete().eq("id", existingProfile.id);
      }

      return { ok: true, userId: existingUser.id, email, appRole: inv.app_role };
    }

    const createPayload: Parameters<typeof supabaseAdmin.auth.admin.createUser>[0] = {
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: metadata,
    };
    if (existingProfile?.id) createPayload.id = existingProfile.id;

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser(createPayload);
    if (createError) throw new Error(createError.message);
    if (!created.user?.id) throw new Error("Compte introuvable après création");

    return { ok: true, userId: created.user.id, email, appRole: inv.app_role };
  });

export const completeActivationProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const normalized = data.token.replace(/[^a-fA-F0-9]/gi, "").toLowerCase();

    // Vérifier que l'invitation correspond bien à l'utilisateur authentifié (via email)
    const { data: inv } = await supabaseAdmin
      .from("invitations")
      .select("id, email")
      .eq("token", normalized)
      .maybeSingle();
    if (!inv) throw new Error("Invitation introuvable");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, email")
      .eq("id", userId)
      .maybeSingle();
    if (!profile) throw new Error("Profil introuvable");
    if ((profile.email || "").toLowerCase() !== (inv.email || "").toLowerCase()) {
      throw new Error("Invitation ne correspond pas au compte");
    }

    const patch: Record<string, unknown> = {
      status: "active",
    };
    const assign = (k: string, v: unknown) => {
      if (v !== undefined && v !== null && v !== "") patch[k] = v;
    };
    assign("phone", data.phone);
    assign("birth_date", data.birth_date);
    assign("nationality", data.nationality);
    assign("city", data.city);
    assign("address", data.address);
    assign("niss", data.niss);
    assign("iban", data.iban);
    assign("emergency_contact_name", data.emergency_contact_name);
    assign("emergency_contact_phone", data.emergency_contact_phone);
    assign("emergency_contact_relation", data.emergency_contact_relation);
    if (typeof data.student_card_valid === "boolean") patch.student_card_valid = data.student_card_valid;
    if (data.avatar_url) patch.avatar_url = data.avatar_url;

    const { error } = await supabaseAdmin.from("profiles").update(patch as any).eq("id", userId);
    if (error) throw new Error(error.message);

    // Inscription terminée jusqu'au bout : on marque enfin l'invitation
    // comme « accepted », ce qui rend le lien inactif.
    await supabaseAdmin
      .from("invitations")
      .update({ status: "accepted", accepted_at: new Date().toISOString() })
      .eq("id", inv.id);

    return { ok: true };
  });

