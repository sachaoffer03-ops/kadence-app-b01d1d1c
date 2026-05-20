import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { computeStatsForUser } = await import("./my-stats.server");
    return computeStatsForUser(supabase, userId);
  });

async function assertAdminOrManager(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const ok = data?.some((r: any) => r.role === "admin" || r.role === "manager");
  if (!ok) throw new Error("Réservé aux admins/managers");
}

export const getEmployeeStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ userId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdminOrManager(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { computeStatsForUser, computeAdminExtras } = await import("./my-stats.server");
    const [stats, extras] = await Promise.all([
      computeStatsForUser(supabaseAdmin, data.userId),
      computeAdminExtras(supabaseAdmin, data.userId),
    ]);
    return { ...stats, admin: extras };
  });
