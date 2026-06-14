import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const updateExtendedHours = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        userId: z.string().uuid(),
        allowed: z.boolean(),
        reason: z.string().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId: actorId } = context;

    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", actorId);
    const isAdmin = (roles ?? []).some(
      (r: any) => r.role === "admin" || r.role === "manager",
    );
    if (!isAdmin) throw new Error("Réservé aux admins/managers");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: prev, error: e0 } = await supabaseAdmin
      .from("profiles")
      .select("allow_extended_hours, weekly_hours_cap")
      .eq("id", data.userId)
      .single();
    if (e0) throw new Error(e0.message);

    const newAllowed = data.allowed;

    const { error: e1 } = await supabaseAdmin
      .from("profiles")
      .update({
        allow_extended_hours: newAllowed,
        weekly_hours_cap: null,
      })
      .eq("id", data.userId);
    if (e1) throw new Error(e1.message);

    await supabaseAdmin.from("extended_hours_audit").insert({
      user_id: data.userId,
      changed_by: actorId,
      previous_allowed: (prev as any)?.allow_extended_hours ?? null,
      new_allowed: newAllowed,
      previous_cap: (prev as any)?.weekly_hours_cap ?? null,
      new_cap: null,
      reason: data.reason ?? null,
    });

    return { ok: true, allowed: newAllowed };
  });
