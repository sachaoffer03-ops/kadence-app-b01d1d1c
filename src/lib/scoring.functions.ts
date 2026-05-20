import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdminOrManager(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const ok = data?.some((r: any) => r.role === "admin" || r.role === "manager");
  if (!ok) throw new Error("Réservé aux admins/managers");
}

// Recalcul global
export const recalculateAllScores = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdminOrManager(supabase, userId);
    const { data, error } = await supabase.rpc("recalculate_all_scores");
    if (error) throw new Error(error.message);
    return { ok: true, count: data ?? 0 };
  });

// Détail du score d'un employé (pour breakdown UI)
export const getScoreBreakdown = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ userId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdminOrManager(supabase, userId);
    const { computeScoreBreakdown } = await import("./scoring.server");
    return computeScoreBreakdown(supabase, data.userId);
  });
