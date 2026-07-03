import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  userId: z.string().uuid(),
});

/**
 * Régénère un lien d'activation individuel pour un employé.
 *
 * - Réinitialise (ou crée) une invitation pour cet employé avec un nouveau token.
 * - Si un compte auth existe déjà mais n'a jamais été finalisé (employé jamais
 *   connecté côté staff-app), il est supprimé pour permettre une nouvelle
 *   inscription propre via la page /activation.
 * - Le lien renvoie vers /activation?token=... → l'employé crée son mot de passe
 *   et remplit toutes ses infos (téléphone, NISS, IBAN, contact urgence, etc.).
 * - Le lien est unique, valide plusieurs fois tant qu'il n'a pas été utilisé.
 */
export const regenerateEmployeeAccessLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId: callerId } = context;

    // Vérifier admin
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Error("Réservé aux administrateurs");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Récupérer le profil employé
    const { data: profile, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select(
        "id, email, first_name, last_name, phone, contract, studio_id, hire_date",
      )
      .eq("id", data.userId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!profile?.email) throw new Error("Employé introuvable ou sans email");

    // Récupérer le rôle applicatif
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.userId);
    const appRole = roles?.some((r) => r.role === "admin")
      ? "admin"
      : roles?.some((r) => r.role === "manager")
      ? "manager"
      : "employee";

    // Vérifier que l'employé n'a pas déjà finalisé son compte
    // (signe = il a déjà un mot de passe / s'est déjà connecté)
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(
      data.userId,
    );
    const lastSignIn = authUser?.user?.last_sign_in_at;
    if (lastSignIn) {
      throw new Error(
        "Cet employé s'est déjà connecté au moins une fois. Utilisez plutôt « Réinitialiser le mot de passe » pour lui renvoyer un accès.",
      );
    }

    // Si un compte auth existe mais jamais utilisé : on le supprime pour
    // permettre un nouveau signUp via la page d'activation.
    if (authUser?.user) {
      await supabaseAdmin.auth.admin.deleteUser(data.userId);
    }

    // Chercher l'invitation existante la plus récente pour cet email
    const { data: existing } = await supabaseAdmin
      .from("invitations")
      .select("id")
      .eq("email", profile.email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Nouveau token (32 octets hex)
    const newToken = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    let invitationId: string;
    if (existing) {
      const { error: updErr } = await supabaseAdmin
        .from("invitations")
        .update({
          token: newToken,
          status: "pending",
          accepted_at: null,
          expires_at: "9999-12-31 23:59:59+00",
        })
        .eq("id", existing.id);
      if (updErr) throw new Error(updErr.message);
      invitationId = existing.id;
    } else {
      // Pas d'invitation passée → on en crée une à partir du profil
      const { data: inserted, error: insErr } = await supabaseAdmin
        .from("invitations")
        .insert({
          token: newToken,
          email: profile.email,
          first_name: profile.first_name || "",
          last_name: profile.last_name || "",
          phone: profile.phone ?? null,
          studio_id: profile.studio_id ?? null,
          studio_ids: profile.studio_id ? [profile.studio_id] : [],
          contract: profile.contract ?? null,
          contracts: profile.contract ? [profile.contract] : [],
          business_roles: [],
          app_role: appRole,
          hire_date: profile.hire_date ?? null,
          status: "pending",
          created_by: callerId,
        })
        .select("id")
        .single();
      if (insErr) throw new Error(insErr.message);
      invitationId = inserted.id;
    }

    const origin =
      appRole === "employee"
        ? "https://app.kadence.be"
        : "https://admin.kadence.be";
    const url = `${origin}/activation?token=${newToken}`;

    return {
      url,
      email: profile.email,
      first_name: profile.first_name ?? "",
      invitation_id: invitationId,
    };
  });
