import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: role } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!role) throw new Error("Admin uniquement");
  return supabaseAdmin;
}

export const getSystemHealthChecks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await assertAdmin(context.userId);

    const [crons, realtime] = await Promise.all([
      supabaseAdmin.rpc("diag_get_crons" as any),
      supabaseAdmin.rpc("diag_realtime_tables" as any),
    ]);

    return {
      crons: crons.data,
      realtime: realtime.data,
    };
  });

export const triggerAvailRemindersTick = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const host = getRequestHeader("host") ?? "kadence-app.lovable.app";
    const proto = getRequestHeader("x-forwarded-proto") ?? "https";
    const url = `${proto}://${host}/api/public/avail-reminders-tick`;
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const text = await r.text();
      let result: any = null;
      try { result = JSON.parse(text); } catch { result = { raw: text }; }
      return { status: r.status, ok: r.ok, url, result, ranAt: new Date().toISOString() };
    } catch (e: any) {
      return { status: 0, ok: false, url, error: e?.message || "fetch failed", ranAt: new Date().toISOString() };
    }
  });

export const getRecentEmailLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await assertAdmin(context.userId);
    // Dédup par message_id, garde le statut le plus récent
    const { data, error } = await supabaseAdmin
      .from("email_send_log")
      .select("id, message_id, template_name, recipient_email, status, error_message, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return { error: error.message, logs: [] as any[] };
    const seen = new Set<string>();
    const dedup: any[] = [];
    for (const row of data ?? []) {
      const key = (row as any).message_id ?? (row as any).id;
      if (seen.has(key)) continue;
      seen.add(key);
      dedup.push(row);
      if (dedup.length >= 10) break;
    }
    return { logs: dedup };
  });
