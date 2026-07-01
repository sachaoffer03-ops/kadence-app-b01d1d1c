import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function randomCode(len = 5) {
  const bytes = new Uint32Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) out += CHARS[bytes[i] % CHARS.length];
  return out;
}

export const Route = createFileRoute("/api/public/studio-qr/$studioId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const studioId = params.studioId;
        const { data: studio, error } = await supabaseAdmin
          .from("studios")
          .select("id,name,current_qr_code,qr_renewal_seconds,qr_generated_at,deleted_at")
          .eq("id", studioId)
          .maybeSingle();

        if (error) return new Response(error.message, { status: 500 });
        if (!studio || studio.deleted_at) return new Response("Studio introuvable", { status: 404 });

        const renewal = studio.qr_renewal_seconds ?? 60;
        const now = Date.now();
        const generatedAt = studio.qr_generated_at ? new Date(studio.qr_generated_at).getTime() : 0;
        const ageSec = (now - generatedAt) / 1000;

        let code = studio.current_qr_code ?? "";
        let genAt = studio.qr_generated_at ?? null;

        if (!code || ageSec >= renewal) {
          const previousCode = studio.current_qr_code ?? null;
          code = randomCode(5);
          genAt = new Date(now).toISOString();
          const { error: upErr } = await supabaseAdmin
            .from("studios")
            .update({
              current_qr_code: code,
              qr_generated_at: genAt,
              previous_qr_code: previousCode,
              previous_qr_rotated_at: previousCode ? genAt : null,
            })
            .eq("id", studioId);
          if (upErr) return new Response(upErr.message, { status: 500 });
        }

        const generatedAtMs = new Date(genAt!).getTime();
        const expiresInSec = Math.max(0, Math.round(renewal - (now - generatedAtMs) / 1000));

        return Response.json(
          {
            studioId: studio.id,
            studioName: studio.name,
            code,
            renewalSeconds: renewal,
            generatedAt: genAt,
            expiresInSec,
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
