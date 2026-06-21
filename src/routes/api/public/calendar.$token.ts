import { createFileRoute } from "@tanstack/react-router";

function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }

function formatICSDate(date: string, time: string): string {
  // date: YYYY-MM-DD, time: HH:MM or HH:MM:SS — treated as Europe/Brussels local
  const [hh, mm] = time.split(":");
  const [y, mo, d] = date.split("-");
  return `${y}${mo}${pad(Number(d))}T${pad(Number(hh))}${pad(Number(mm))}00`;
}

function escapeICS(s: string): string {
  return (s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function fold(line: string): string {
  // RFC5545: 75 octets per line
  if (line.length <= 75) return line;
  const out: string[] = [];
  let i = 0;
  while (i < line.length) {
    out.push((i === 0 ? "" : " ") + line.slice(i, i + 73));
    i += 73;
  }
  return out.join("\r\n");
}

export const Route = createFileRoute("/api/public/calendar/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const raw = params.token || "";
        const token = raw.replace(/\.ics$/i, "");

        const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRe.test(token)) return new Response("Not found", { status: 404 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("id,first_name,last_name")
          .eq("calendar_token", token)
          .maybeSingle();

        if (!profile) return new Response("Not found", { status: 404 });

        // Shifts: 6 months back, 12 months forward
        const now = new Date();
        const fromDate = new Date(now); fromDate.setMonth(fromDate.getMonth() - 6);
        const toDate = new Date(now); toDate.setMonth(toDate.getMonth() + 12);
        const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

        const { data: shifts } = await supabaseAdmin
          .from("shifts")
          .select("id,shift_date,start_time,end_time,business_role,notes,studio_id,updated_at,created_at")
          .eq("user_id", profile.id)
          .gte("shift_date", isoDay(fromDate))
          .lte("shift_date", isoDay(toDate))
          .order("shift_date");

        const studioIds = Array.from(new Set((shifts || []).map(s => s.studio_id).filter(Boolean))) as string[];
        const studios: Record<string, string> = {};
        if (studioIds.length) {
          const { data: st } = await supabaseAdmin.from("studios").select("id,name").in("id", studioIds);
          for (const s of st || []) studios[s.id] = s.name;
        }

        const lines: string[] = [];
        lines.push("BEGIN:VCALENDAR");
        lines.push("VERSION:2.0");
        lines.push("PRODID:-//Kadence//Skult Studios//FR");
        lines.push("CALSCALE:GREGORIAN");
        lines.push("METHOD:PUBLISH");
        lines.push("X-WR-CALNAME:Mes shifts Skult");
        lines.push("X-WR-TIMEZONE:Europe/Brussels");
        lines.push("REFRESH-INTERVAL;VALUE=DURATION:PT1H");
        lines.push("X-PUBLISHED-TTL:PT1H");

        // Europe/Brussels VTIMEZONE block
        lines.push("BEGIN:VTIMEZONE");
        lines.push("TZID:Europe/Brussels");
        lines.push("BEGIN:STANDARD");
        lines.push("DTSTART:19701025T030000");
        lines.push("RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=10");
        lines.push("TZOFFSETFROM:+0200");
        lines.push("TZOFFSETTO:+0100");
        lines.push("TZNAME:CET");
        lines.push("END:STANDARD");
        lines.push("BEGIN:DAYLIGHT");
        lines.push("DTSTART:19700329T020000");
        lines.push("RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=3");
        lines.push("TZOFFSETFROM:+0100");
        lines.push("TZOFFSETTO:+0200");
        lines.push("TZNAME:CEST");
        lines.push("END:DAYLIGHT");
        lines.push("END:VTIMEZONE");

        const dtstamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

        for (const s of shifts || []) {
          if (!s.shift_date || !s.start_time || !s.end_time) continue;
          const studioName = s.studio_id ? (studios[s.studio_id] || "") : "";
          const role = s.business_role || "Shift";
          const summary = `${role}${studioName ? ` · ${studioName.replace(/^Skult\s+/i, "")}` : ""}`;
          const description = s.notes ? String(s.notes) : "";
          const lastMod = s.updated_at || s.created_at || now.toISOString();
          const lastModFmt = new Date(lastMod).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

          lines.push("BEGIN:VEVENT");
          lines.push(fold(`UID:shift-${s.id}@kadence.skult`));
          lines.push(`DTSTAMP:${dtstamp}`);
          lines.push(`LAST-MODIFIED:${lastModFmt}`);
          lines.push(`DTSTART;TZID=Europe/Brussels:${formatICSDate(s.shift_date, s.start_time)}`);
          lines.push(`DTEND;TZID=Europe/Brussels:${formatICSDate(s.shift_date, s.end_time)}`);
          lines.push(fold(`SUMMARY:${escapeICS(summary)}`));
          if (studioName) lines.push(fold(`LOCATION:${escapeICS(studioName)}`));
          if (description) lines.push(fold(`DESCRIPTION:${escapeICS(description)}`));
          lines.push("END:VEVENT");
        }

        lines.push("END:VCALENDAR");

        const body = lines.join("\r\n") + "\r\n";

        return new Response(body, {
          status: 200,
          headers: {
            "Content-Type": "text/calendar; charset=utf-8",
            "Cache-Control": "public, max-age=900",
            "Content-Disposition": `inline; filename="kadence-shifts.ics"`,
          },
        });
      },
    },
  },
});
