// =============================================================================
// Cron endpoint — appelé par pg_cron toutes les 15 minutes.
// Idempotent : la fermeture et l'envoi des rappels utilisent notifications_sent
// et un UPDATE conditionné par status='open'.
// =============================================================================
import { createFileRoute } from "@tanstack/react-router";
import { processWindowsTick } from "@/lib/availability-windows.server";

export const Route = createFileRoute("/api/public/availability-windows-tick")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const result = await processWindowsTick();
          return new Response(JSON.stringify({ ok: true, ...result }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e: any) {
          console.error("availability-windows-tick failed", e);
          return new Response(
            JSON.stringify({ ok: false, error: e?.message ?? "unknown" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
      GET: async () => {
        // Permet un déclenchement manuel en debug (lecture seule de la même logique)
        const result = await processWindowsTick();
        return new Response(JSON.stringify({ ok: true, ...result }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
