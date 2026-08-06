import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  studioIds: z.array(z.string().uuid()).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dryRun: z.boolean().default(true),
});

export const absorbShortGaps = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const allowed = roles?.some(
      (r: any) => r.role === "admin" || r.role === "manager",
    );
    if (!allowed) throw new Error("Réservé aux admins/managers");

    const { runAbsorbShortGaps } = await import("@/lib/gap-absorb.server");
    return await runAbsorbShortGaps({
      studioIds: data.studioIds,
      from: data.from,
      to: data.to,
      dryRun: data.dryRun,
    });
  });
