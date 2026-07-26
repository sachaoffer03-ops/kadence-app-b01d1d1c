import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Suppression de compte employé (Apple App Store 5.1.1 / Google Play / RGPD).
 *
 * - Vérifie que l'email retapé correspond au compte connecté (côté SQL).
 * - Anonymise le profil et coupe l'accès applicatif (RPC delete_my_account).
 * - Purge physiquement les fichiers personnels du stockage.
 * - La suppression du compte d'authentification est programmée à J+30.
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { emailConfirmation: string }) => {
    const email = String(data?.emailConfirmation ?? "").trim();
    if (!email || email.length > 255 || !email.includes("@")) {
      throw new Error("Adresse email de confirmation invalide");
    }
    return { emailConfirmation: email };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: result, error } = await supabase.rpc("delete_my_account", {
      _email_confirmation: data.emailConfirmation,
    });
    if (error) throw new Error(error.message);

    // Purge des fichiers personnels (documents, avatar) — nécessite le rôle service.
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      for (const bucket of ["employee-documents", "avatars"]) {
        const { data: files } = await supabaseAdmin.storage.from(bucket).list(userId, { limit: 1000 });
        const paths = (files ?? []).map((f) => `${userId}/${f.name}`);
        if (paths.length > 0) await supabaseAdmin.storage.from(bucket).remove(paths);
      }
    } catch (e) {
      console.error("[deleteMyAccount] purge stockage échouée", e);
    }

    return result as { ok: boolean; anon_id: string; purge_auth_at: string };
  });
