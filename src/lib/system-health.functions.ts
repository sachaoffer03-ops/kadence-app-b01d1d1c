import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getSystemHealthChecks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: role } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) throw new Error("Admin uniquement");

    const [crons, locale, enqueueEmail, realtime] = await Promise.all([
      supabaseAdmin.rpc("diag_get_crons" as any),
      supabaseAdmin.rpc("diag_test_locale" as any),
      supabaseAdmin.rpc("diag_function_signature" as any, { fname: "enqueue_email" }),
      supabaseAdmin.rpc("diag_realtime_tables" as any),
    ]);

    return {
      crons: crons.data,
      locale: locale.data,
      enqueueEmail: enqueueEmail.data,
      realtime: realtime.data,
    };
  });
