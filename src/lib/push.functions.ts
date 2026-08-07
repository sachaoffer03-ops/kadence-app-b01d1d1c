import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PUSH_CATEGORIES, type PushCategory } from "./push-categories";

/** Enregistre (ou met à jour) l'appareil mobile de l'employé. */
export const registerPushDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        playerId: z.string().min(8).max(200),
        platform: z.string().max(30).optional().default("unknown"),
        appVersion: z.string().max(50).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Un appareil = un seul utilisateur (téléphone partagé)
    await supabase
      .from("push_subscriptions")
      .delete()
      .eq("player_id", data.playerId)
      .neq("user_id", userId);

    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: userId,
        player_id: data.playerId,
        platform: data.platform,
        app_version: data.appVersion ?? null,
        enabled: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "player_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Coupe les push sur cet appareil (déconnexion). */
export const unregisterPushDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ playerId: z.string().min(8).max(200) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase
      .from("push_subscriptions")
      .delete()
      .eq("player_id", data.playerId)
      .eq("user_id", userId);
    return { ok: true };
  });

export const getMyPushSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: devices }] = await Promise.all([
      supabase.from("profiles").select("push_prefs").eq("id", userId).maybeSingle(),
      supabase
        .from("push_subscriptions")
        .select("id, platform, enabled, updated_at")
        .eq("user_id", userId),
    ]);
    const raw = ((profile as any)?.push_prefs ?? {}) as Record<string, boolean>;
    const prefs = Object.fromEntries(PUSH_CATEGORIES.map((c) => [c, raw[c] !== false])) as Record<
      PushCategory,
      boolean
    >;
    return { prefs, devices: (devices ?? []) as any[] };
  });

export const updateMyPushPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ prefs: z.record(z.enum(PUSH_CATEGORIES), z.boolean()) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .update({ push_prefs: data.prefs } as any)
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
