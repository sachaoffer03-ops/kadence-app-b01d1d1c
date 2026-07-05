import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ─────────────────────────────────────────────────────────────────────
// Public : demande de reset password
// ─────────────────────────────────────────────────────────────────────
// Endpoint public (pas d'auth) : on ne révèle pas si l'email existe.
// Comportement selon AUTH_EMAIL_PROVIDER :
//   - "lovable" (défaut) : Supabase Auth déclenche le webhook Lovable
//   - "kadence"           : on génère le lien via admin.generateLink et on
//                           envoie via notre pipeline Resend tenant-aware
const ForgotInput = z.object({
  email: z.string().email(),
  redirectTo: z.string().url().optional(),
});

export const requestPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => ForgotInput.parse(i))
  .handler(async ({ data }) => {
    const { getAuthEmailProvider, sendAuthEmail } = await import(
      "@/lib/auth-emails.server"
    );
    const provider = getAuthEmailProvider();

    if (provider === "kadence") {
      // Vérifier d'abord que l'email existe pour ne pas polluer les logs
      // — mais renvoyer TOUJOURS ok pour ne pas divulguer.
      try {
        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("id, first_name")
          .ilike("email", data.email.trim().toLowerCase())
          .maybeSingle();
        if (profile) {
          await sendAuthEmail({
            type: "recovery",
            email: data.email,
            redirectTo: data.redirectTo,
            firstName: profile.first_name,
          });
        }
      } catch (e) {
        console.error("[requestPasswordReset] kadence path error", e);
      }
      return { ok: true, provider };
    }

    // Fallback : Supabase Auth natif → webhook Lovable
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: data.redirectTo,
    });
    return { ok: true, provider };
  });

// ─────────────────────────────────────────────────────────────────────
// Admin : test d'un flow auth (invite / recovery / signup / …)
// ─────────────────────────────────────────────────────────────────────
const TestAuthInput = z.object({
  type: z.enum([
    "signup",
    "invite",
    "magiclink",
    "recovery",
    "email_change",
    "reauthentication",
  ]),
  email: z.string().email(),
  newEmail: z.string().email().optional(),
});

export const sendTestAuthEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => TestAuthInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Réservé aux admins");

    const { sendAuthEmail, getAuthEmailProvider } = await import(
      "@/lib/auth-emails.server"
    );
    const provider = getAuthEmailProvider();
    const res = await sendAuthEmail({
      type: data.type,
      email: data.email,
      newEmail: data.newEmail,
    });
    return { ...res, provider };
  });
