import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Body {
  email: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
  studio_id?: string | null; // legacy single (optional)
  studio_ids?: string[];
  contract?: string | null; // legacy single (optional)
  contracts?: string[];
  business_roles: string[];
  app_role?: string;
  hire_date?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Non authentifié" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is admin
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user) return new Response(JSON.stringify({ error: "Non authentifié" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: roleData } = await admin.from("user_roles").select("role").eq("user_id", userData.user.id).eq("role", "admin").maybeSingle();
    if (!roleData) return new Response(JSON.stringify({ error: "Réservé aux admins" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body: Body = await req.json();

    const studioIds = (body.studio_ids && body.studio_ids.length > 0)
      ? body.studio_ids
      : (body.studio_id ? [body.studio_id] : []);
    const contracts = (body.contracts && body.contracts.length > 0)
      ? body.contracts
      : (body.contract ? [body.contract] : []);

    // Insert invitation
    const { data: inv, error: invErr } = await admin.from("invitations").insert({
      email: body.email,
      first_name: body.first_name,
      last_name: body.last_name,
      phone: body.phone ?? null,
      studio_id: studioIds[0] ?? null, // legacy compat
      studio_ids: studioIds,
      contract: contracts[0] ?? null, // legacy compat
      contracts: contracts,
      business_roles: body.business_roles ?? [],
      app_role: body.app_role ?? "employee",
      hire_date: body.hire_date ?? null,
      created_by: userData.user.id,
    }).select("id, token").single();

    if (invErr) return new Response(JSON.stringify({ error: invErr.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Choisir le bon sous-domaine selon le rôle de l'invité
    const appRole = body.app_role ?? "employee";
    const requestOrigin = req.headers.get("origin") || req.headers.get("referer")?.split("/").slice(0, 3).join("/") || "";
    const isProd = requestOrigin.includes("shyft.flashsite.fr");
    let activationOrigin: string;
    if (isProd) {
      activationOrigin = appRole === "employee"
        ? "https://app.shyft.flashsite.fr"
        : "https://admin.shyft.flashsite.fr";
    } else {
      // Preview / dev: garde l'origine d'appel et passe le mode en hint
      activationOrigin = requestOrigin;
    }
    const modeHint = !isProd ? `&mode=${appRole === "employee" ? "employee" : "admin"}` : "";
    const activationUrl = `${activationOrigin}/activation?token=${inv.token}${modeHint}`;

    // Send email via Lovable AI Gateway / Resend if configured. Fallback: just return the link.
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    let emailSent = false;
    if (lovableKey) {
      try {
        const html = `
<div style="font-family: Inter, Arial, sans-serif; background:#FAFAF8; padding:32px;">
  <div style="max-width:520px; margin:0 auto; background:#fff; border-radius:12px; padding:32px; border:1px solid #ECEAE5;">
    <h1 style="font-size:22px; font-weight:500; margin:0 0 8px 0; color:#1a1a1a;">Bienvenue chez Skult Studios</h1>
    <p style="font-size:14px; color:#6b6b6b; margin:0 0 24px 0;">Bonjour ${body.first_name},</p>
    <p style="font-size:14px; color:#3a3a3a; line-height:1.6; margin:0 0 24px 0;">
      Votre administrateur vous a invité à rejoindre l'équipe sur Kadence, notre plateforme de gestion du staff. Cliquez sur le bouton ci-dessous pour activer votre compte et commencer.
    </p>
    <a href="${activationUrl}" style="display:inline-block; background:#F0997B; color:#fff; padding:12px 24px; border-radius:8px; text-decoration:none; font-size:14px; font-weight:500;">Activer mon compte</a>
    <p style="font-size:12px; color:#9a9a9a; margin:24px 0 0 0;">Ce lien expire dans 7 jours. Si vous n'attendiez pas cette invitation, ignorez ce message.</p>
  </div>
</div>`;
        const r = await fetch("https://ai.gateway.lovable.dev/v1/email", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovableKey}` },
          body: JSON.stringify({
            from: "Skult Studios <onboarding@resend.dev>",
            to: [body.email],
            subject: "Bienvenue chez Skult Studios — activez votre compte",
            html,
          }),
        });
        emailSent = r.ok;
      } catch (e) {
        console.error("Email send error:", e);
      }
    }

    return new Response(JSON.stringify({ ok: true, invitation_id: inv.id, activation_url: activationUrl, email_sent: emailSent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
