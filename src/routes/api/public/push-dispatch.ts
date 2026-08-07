import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { sendOneSignalPush } from "@/lib/push-send.server";

const BodySchema = z.object({ notificationId: z.string().uuid() });

export const Route = createFileRoute("/api/public/push-dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return new Response("Bad request", { status: 400 });
        }

        const parsed = BodySchema.safeParse(payload);
        if (!parsed.success) return new Response("Bad request", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // La base est la source de vérité : on ne fait confiance qu'à l'id.
        const { data: notif } = await supabaseAdmin
          .from("notifications")
          .select("id, user_id, title, body, link, category, created_at")
          .eq("id", parsed.data.notificationId)
          .maybeSingle();

        if (!notif) return Response.json({ sent: false, reason: "not_found" });

        // Anti-rejeu : on n'envoie que les notifications fraîches.
        const ageMs = Date.now() - new Date(notif.created_at as string).getTime();
        if (ageMs > 5 * 60 * 1000) return Response.json({ sent: false, reason: "stale" });

        const [{ data: profile }, { data: devices }] = await Promise.all([
          supabaseAdmin.from("profiles").select("push_prefs").eq("id", notif.user_id).maybeSingle(),
          supabaseAdmin
            .from("push_subscriptions")
            .select("player_id")
            .eq("user_id", notif.user_id)
            .eq("enabled", true),
        ]);

        const category = (notif.category as string | null) ?? "general";
        const prefs = (profile?.push_prefs ?? {}) as Record<string, boolean>;
        if (prefs[category] === false) return Response.json({ sent: false, reason: "muted" });

        const playerIds = (devices ?? []).map((d: any) => d.player_id).filter(Boolean);
        if (playerIds.length === 0) return Response.json({ sent: false, reason: "no_device" });

        const result = await sendOneSignalPush({
          playerIds,
          title: (notif.title as string) || "Kadence",
          body: (notif.body as string) || "",
          url: (notif.link as string) || "/staff-app",
          data: { notificationId: notif.id, category },
        });

        if (!result.ok) {
          console.error("[push-dispatch]", result.error);
          return Response.json({ sent: false, reason: result.error }, { status: 200 });
        }
        return Response.json({ sent: true, id: result.id, devices: playerIds.length });
      },
    },
  },
});
