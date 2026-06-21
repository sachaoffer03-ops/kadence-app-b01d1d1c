import { createFileRoute } from "@tanstack/react-router";

type RoleSegment = { role: string; start_time: string; end_time: string };

export const Route = createFileRoute("/api/public/role-transitions-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Auth via Supabase apikey (pattern canonique pg_cron)
        const apikey =
          request.headers.get("apikey") ?? request.headers.get("x-api-key");
        const expected =
          process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";
        if (!expected || apikey !== expected) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        const now = new Date();
        const today = now.toISOString().slice(0, 10);

        // 1) Récupérer tous les shifts du jour ayant des role_segments
        const { data: shifts, error: shiftsErr } = await supabaseAdmin
          .from("shifts")
          .select("id,user_id,shift_date,start_time,end_time,business_role,role_segments,clocked_out_at")
          .eq("shift_date", today)
          .not("role_segments", "is", null);

        if (shiftsErr) {
          console.error("role-transitions-tick shifts query failed", shiftsErr);
          return Response.json({ error: "shifts_query_failed" }, { status: 500 });
        }

        const candidates: Array<{
          shiftId: string;
          userId: string;
          transitionIndex: number;
          atISO: string;
          nextRole: string;
        }> = [];

        for (const s of shifts ?? []) {
          if (s.clocked_out_at) continue;
          const segs = s.role_segments as unknown as RoleSegment[] | null;
          if (!Array.isArray(segs) || segs.length < 2) continue;

          for (let i = 1; i < segs.length; i++) {
            const t = String(segs[i].start_time).slice(0, 5);
            const atISO = `${s.shift_date}T${t}:00`;
            // Fenêtre [transition - 6min, transition - 3min]
            const at = new Date(atISO).getTime();
            const diffMin = (at - now.getTime()) / 60_000;
            if (diffMin <= 6 && diffMin >= 3) {
              candidates.push({
                shiftId: s.id as string,
                userId: s.user_id as string,
                transitionIndex: i,
                atISO,
                nextRole: segs[i].role,
              });
            }
          }
        }

        if (candidates.length === 0) {
          return Response.json({ notifs_sent: 0, scanned: shifts?.length ?? 0 });
        }

        // 2) Filtrer celles déjà envoyées
        const keys = candidates.map((c) => `${c.shiftId}:${c.transitionIndex}`);
        const { data: already } = await supabaseAdmin
          .from("role_transition_notifications")
          .select("shift_id,transition_index")
          .in(
            "shift_id",
            Array.from(new Set(candidates.map((c) => c.shiftId))),
          );
        const sentKeys = new Set(
          (already ?? []).map(
            (r: any) => `${r.shift_id}:${r.transition_index}`,
          ),
        );
        const toSend = candidates.filter(
          (c, i) => !sentKeys.has(keys[i]),
        );

        if (toSend.length === 0) {
          return Response.json({ notifs_sent: 0, candidates: candidates.length });
        }

        // 3) Insert notifications
        const notifRows = toSend.map((c) => ({
          user_id: c.userId,
          type: "role_transition",
          title: "Changement de rôle",
          body: `Dans 5 min, tu passes en ${c.nextRole}`,
          link: "/staff-app?tab=planning",
          priority: "normal",
          category: "shift",
        }));
        const { error: notifErr } = await supabaseAdmin
          .from("notifications")
          .insert(notifRows);
        if (notifErr) {
          console.error("role-transitions-tick notif insert failed", notifErr);
          return Response.json({ error: "notif_insert_failed" }, { status: 500 });
        }

        // 4) Tracker
        const trackRows = toSend.map((c) => ({
          shift_id: c.shiftId,
          transition_index: c.transitionIndex,
        }));
        const { error: trackErr } = await supabaseAdmin
          .from("role_transition_notifications")
          .insert(trackRows);
        if (trackErr) {
          console.error("role-transitions-tick tracking insert failed", trackErr);
        }

        return Response.json({
          notifs_sent: toSend.length,
          candidates: candidates.length,
          scanned: shifts?.length ?? 0,
        });
      },
    },
  },
});
