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

    // Toujours utiliser le domaine de production pour les liens envoyés par email,
    // peu importe d'où l'admin crée l'invitation (preview Lovable, dev local, prod).
    // Sous-domaine selon le rôle de l'invité.
    const appRole = body.app_role ?? "employee";
    const activationOrigin = appRole === "employee"
      ? "https://app.shyft.flashsite.fr"
      : "https://admin.shyft.flashsite.fr";
    const activationUrl = `${activationOrigin}/activation?token=${inv.token}`;

    const { data: studio } = studioIds[0]
      ? await admin.from("studios").select("name").eq("id", studioIds[0]).maybeSingle()
      : { data: null };

    // Envoi via l'infrastructure email de l'app : queue, retries et logs centralisés.
    const emailRouteOrigin = "https://app.shyft.flashsite.fr";
    let emailSent = false;
    try {
      const r = await fetch(`${emailRouteOrigin}/lovable/email/transactional/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: authHeader },
        body: JSON.stringify({
          templateName: "invitation-employe",
          recipientEmail: body.email,
          idempotencyKey: `invitation-employe-${inv.id}`,
          templateData: {
            firstName: body.first_name,
            studioName: studio?.name ?? "Skult Studios",
            inviteUrl: activationUrl,
          },
        }),
      });
      emailSent = r.ok;
      if (!r.ok) {
        const errText = await r.text();
        console.error("Email send failed:", r.status, errText);
      }
    } catch (e) {
      console.error("Email send error:", e);
    }

    return new Response(JSON.stringify({ ok: true, invitation_id: inv.id, activation_url: activationUrl, email_sent: emailSent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
