import { createFileRoute } from "@tanstack/react-router";
import {
  addMonthsYM,
  brusselsDeadlineDate,
  formatBrusselsDeadlineLabel,
  formatBrusselsMonthLabel,
  getBrusselsDateParts,
  monthStartISO,
} from "@/lib/brussels-time";

const APP_URL = "https://app.kadence.be/staff-app";


type Threshold = "3d" | "2d" | "24h" | "5h" | "1h";
type Urgency = "soft" | "urgent" | "ultimate";

const NOTIF_TITLES: Record<Threshold, string> = {
  "3d": "📅 Plus que 3 jours pour tes dispos",
  "2d": "⏰ Plus que 2 jours pour tes dispos",
  "24h": "⚠️ Plus que 24h pour tes dispos !",
  "5h": "⏱ 5h restantes !",
  "1h": "🔥 Dernière heure !",
};

const URGENCY_BY_THRESHOLD: Partial<Record<Threshold, Urgency>> = {
  "3d": "soft",
  "24h": "urgent",
  "1h": "ultimate",
};

export const Route = createFileRoute("/api/public/avail-reminders-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Authentification via apikey Supabase (pattern canonique pour pg_cron)
        const apikey = request.headers.get("apikey") ?? request.headers.get("x-api-key");
        const expected =
          process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";
        if (!expected || apikey !== expected) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );




        // 1) Lock day from AI planning settings
        const { data: settings } = await supabaseAdmin
          .from("ai_planning_settings")
          .select("availability_lock_day, updated_at")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const lockDay = settings?.availability_lock_day ?? 25;

        // 2) Compute next deadline (current month, or next if passed)
        const now = new Date();
        const brusselsNow = getBrusselsDateParts(now);
        let deadline = brusselsDeadlineDate(brusselsNow.year, brusselsNow.month, lockDay);
        if (now.getTime() > deadline.getTime()) {
          const nextDeadlineMonth = addMonthsYM(brusselsNow.year, brusselsNow.month, 1);
          deadline = brusselsDeadlineDate(nextDeadlineMonth.year, nextDeadlineMonth.month, lockDay);
        }
        const daysLeft =
          (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

        if (daysLeft <= 0) {
          return Response.json({ skipped: "deadline_passed" });
        }

        let threshold: Threshold;
        if (daysLeft < 0.0417) threshold = "1h";
        else if (daysLeft < 0.208) threshold = "5h";
        else if (daysLeft < 1) threshold = "24h";
        else if (daysLeft < 2) threshold = "2d";
        else if (daysLeft < 3) threshold = "3d";
        else
          return Response.json({ skipped: "too_far", days_left: daysLeft });

        const urgency = URGENCY_BY_THRESHOLD[threshold] ?? null;

        // 3) Target month = month containing the deadline (next month after lock)
        const deadlineParts = getBrusselsDateParts(deadline);
        const targetMonth = addMonthsYM(deadlineParts.year, deadlineParts.month, 1);
        const afterTargetMonth = addMonthsYM(targetMonth.year, targetMonth.month, 1);
        const targetMonthStart = monthStartISO(targetMonth.year, targetMonth.month);
        const targetMonthEnd = monthStartISO(afterTargetMonth.year, afterTargetMonth.month);
        const monthLabel = formatBrusselsMonthLabel(targetMonth.year, targetMonth.month);
        const deadlineLabel = formatBrusselsDeadlineLabel(deadline);

        // 4) Active employees (non-admin/manager)
        const { data: adminIdsRows } = await supabaseAdmin
          .from("user_roles")
          .select("user_id, role")
          .in("role", ["admin", "manager"]);
        const adminIds = new Set(
          (adminIdsRows ?? []).map((r: any) => r.user_id as string),
        );

        const { data: profiles } = await supabaseAdmin
          .from("profiles")
          .select("id, first_name, email")
          .eq("status", "active");

        const candidates = (profiles ?? []).filter(
          (p: any) => !adminIds.has(p.id),
        );
        if (candidates.length === 0) {
          return Response.json({
            threshold,
            urgency,
            notifs_sent: 0,
            emails_sent: 0,
          });
        }
        const candidateIds = candidates.map((p: any) => p.id);

        // 5) Who already filled at least one avail in target month
        const { data: filled } = await supabaseAdmin
          .from("availabilities")
          .select("user_id")
          .in("user_id", candidateIds)
          .gte("avail_date", targetMonthStart)
          .lt("avail_date", targetMonthEnd);
        const filledSet = new Set(
          (filled ?? []).map((r: any) => r.user_id as string),
        );

        // 6) Who already got notif for this threshold in last 7 days
        const sevenDaysAgo = new Date(
          deadline.getTime() - 7 * 24 * 60 * 60 * 1000,
        ).toISOString();
        const notifType = `dispo_reminder_${threshold}`;
        const { data: alreadyNotified } = await supabaseAdmin
          .from("notifications")
          .select("user_id")
          .in("user_id", candidateIds)
          .eq("type", notifType)
          .gt("created_at", sevenDaysAgo);
        const notifiedSet = new Set(
          (alreadyNotified ?? []).map((r: any) => r.user_id as string),
        );

        const toNotify = candidates.filter(
          (p: any) => !filledSet.has(p.id) && !notifiedSet.has(p.id),
        );

        if (toNotify.length === 0) {
          return Response.json({
            threshold,
            urgency,
            notifs_sent: 0,
            emails_sent: 0,
          });
        }

        // 7) Insert in-app notifications (one row per user)
        const notifRows = toNotify.map((p: any) => ({
          user_id: p.id,
          type: notifType,
          title: NOTIF_TITLES[threshold],
          body: "N'oublie pas de remplir tes dispos pour le mois prochain.",
          link: "/staff-app?tab=accueil",
          priority:
            threshold === "5h" || threshold === "1h" || threshold === "24h"
              ? "urgent"
              : "normal",
          category: "general",
        }));
        const { error: notifErr } = await supabaseAdmin
          .from("notifications")
          .insert(notifRows);
        if (notifErr) {
          console.error("avail-reminders notif insert failed", notifErr);
        }

        // 8) Emails on critical thresholds only
        let emailsSent = 0;
        if (urgency) {
          const { enqueueTemplateEmail } = await import(
            "@/lib/email-send.server"
          );
          const deadlineDateKey = `${deadlineParts.year}${String(
            deadlineParts.month,
          ).padStart(2, "0")}${String(deadlineParts.day).padStart(2, "0")}`;
          const subjectByUrgency: Record<Urgency, string> = {
            soft: `📅 Plus que 3 jours pour tes dispos de ${monthLabel}`,
            urgent: `⚠️ Plus que 24h pour tes dispos de ${monthLabel}`,
            ultimate: `🔥 Dernière heure ! Tes dispos pour ${monthLabel}`,
          };
          for (const p of toNotify) {
            const email = (p as any).email as string | null;
            if (!email) continue;
            try {
              const res = await enqueueTemplateEmail({
                templateId: "dispo-deadline-reminder",
                recipient: email,
                subject: subjectByUrgency[urgency],
                idempotencyKey: `dispo-reminder-${threshold}-${(p as any).id}-${deadlineDateKey}`,
                data: {
                  firstName: (p as any).first_name ?? "",
                  monthLabel,
                  deadlineLabel,
                  urgency,
                  statsAppUrl: APP_URL,
                },
              });
              if (res.ok) emailsSent++;
              else console.error("dispo reminder email failed", email, res.reason);
            } catch (e) {
              console.error("dispo reminder email exception", e);
            }
          }
        }


        return Response.json({
          threshold,
          urgency,
          deadline: deadline.toISOString(),
          month_label: monthLabel,
          notifs_sent: toNotify.length,
          emails_sent: emailsSent,
        });
      },
    },
  },
});
