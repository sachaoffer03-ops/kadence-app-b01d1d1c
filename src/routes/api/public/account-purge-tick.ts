import { createFileRoute } from "@tanstack/react-router";

/**
 * Purge des comptes d'authentification 30 jours après une demande de
 * suppression. Appelé par pg_cron. Les données comptables anonymisées
 * restent en base (obligation légale belge, 7 ans).
 */
async function handle(request: Request) {
  const key = request.headers.get("apikey") ?? "";
  const allowed = [process.env.SUPABASE_PUBLISHABLE_KEY, process.env.SUPABASE_ANON_KEY].filter(
    (k): k is string => typeof k === "string" && k.length > 0,
  );
  if (allowed.length === 0 || !allowed.includes(key)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }


  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("list_pending_auth_purges");
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let purged = 0;
  for (const row of (data ?? []) as { user_id: string }[]) {
    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(row.user_id);
    // 404 = déjà supprimé côté auth : on marque quand même comme purgé
    if (delErr && !/not found/i.test(delErr.message)) {
      console.error("[account-purge-tick] échec suppression auth", row.user_id, delErr.message);
      continue;
    }
    await supabaseAdmin.rpc("mark_auth_purged", { _user_id: row.user_id });
    purged += 1;
  }

  return new Response(JSON.stringify({ ok: true, purged }), {
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/account-purge-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => handle(request),
      GET: async ({ request }) => handle(request),
    },
  },
});
