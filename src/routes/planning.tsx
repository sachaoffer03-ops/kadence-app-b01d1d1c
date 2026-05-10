import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Sparkle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getRoleStyle, hhmm } from "@/lib/staff-helpers";

export const Route = createFileRoute("/planning")({
  component: PlanningPage,
  head: () => ({ meta: [{ title: "Planning — Kadence" }] }),
});

interface DBShift {
  id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  business_role: string;
  status: string;
  user_id: string | null;
  studio_id: string | null;
}

const dayNames = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const monthNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

function getMonday(d: Date) {
  const day = d.getDay();
  const diff = d.getDate() - (day === 0 ? 6 : day - 1);
  const m = new Date(d);
  m.setDate(diff);
  m.setHours(0, 0, 0, 0);
  return m;
}

function PlanningPage() {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [shifts, setShifts] = useState<DBShift[]>([]);
  const [profiles, setProfiles] = useState<Map<string, { first_name: string; last_name: string }>>(new Map());
  const [studios, setStudios] = useState<Map<string, string>>(new Map());

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d;
  }), [weekStart]);

  useEffect(() => {
    const load = async () => {
      const start = weekDays[0].toISOString().split("T")[0];
      const end = weekDays[6].toISOString().split("T")[0];
      const [{ data: shifts }, { data: profs }, { data: stud }] = await Promise.all([
        supabase.from("shifts").select("*").gte("shift_date", start).lte("shift_date", end).order("start_time"),
        supabase.from("profiles").select("id,first_name,last_name"),
        supabase.from("studios").select("id,name"),
      ]);
      setShifts((shifts || []) as DBShift[]);
      setProfiles(new Map((profs || []).map((p) => [p.id, p])));
      setStudios(new Map((stud || []).map((s) => [s.id, s.name])));
    };
    load();
    const ch = supabase.channel("planning-rt").on("postgres_changes", { event: "*", schema: "public", table: "shifts" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [weekStart]);

  const shiftsByDay = useMemo(() => {
    const m: Record<string, DBShift[]> = {};
    shifts.forEach((s) => { (m[s.shift_date] ??= []).push(s); });
    return m;
  }, [shifts]);

  const total = shifts.length;
  const assigned = shifts.filter((s) => s.user_id).length;
  const holes = total - assigned;

  const navigate = (delta: number) => {
    const d = new Date(weekStart); d.setDate(d.getDate() + delta * 7); setWeekStart(d);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 500, marginBottom: 2 }}>Planning</h1>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
            Semaine du {weekDays[0].getDate()} {monthNames[weekDays[0].getMonth()]} — {assigned}/{total} attribués
            {holes > 0 && <> · <Link to="/trous" style={{ color: "var(--coral-dark)", textDecoration: "underline" }}>{holes} trou{holes > 1 ? "s" : ""}</Link></>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="rounded-md p-2" style={{ border: "0.5px solid var(--border)" }}><ChevronLeft size={14} /></button>
          <button onClick={() => setWeekStart(getMonday(new Date()))} className="rounded-md px-3 py-2" style={{ fontSize: 12, fontWeight: 500, border: "0.5px solid var(--border)" }}>Aujourd'hui</button>
          <button onClick={() => navigate(1)} className="rounded-md p-2" style={{ border: "0.5px solid var(--border)" }}><ChevronRight size={14} /></button>
          <Link to="/planning/generate" className="rounded-md px-3 py-2 flex items-center gap-1.5"
            style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)", textDecoration: "none" }}>
            <Sparkle size={13} /> Générer
          </Link>
        </div>
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
        <div className="grid grid-cols-7" style={{ borderBottom: "0.5px solid var(--border)" }}>
          {weekDays.map((d, i) => {
            const isToday = d.toDateString() === new Date().toDateString();
            return (
              <div key={i} className="px-3 py-2.5 text-center" style={{ borderRight: i < 6 ? "0.5px solid var(--border)" : "none", backgroundColor: isToday ? "var(--coral-light)" : "transparent" }}>
                <div style={{ fontSize: 10, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{dayNames[i]}</div>
                <div style={{ fontSize: 14, fontWeight: 500, marginTop: 2, color: isToday ? "var(--coral-dark)" : "var(--foreground)" }}>{d.getDate()}</div>
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-7">
          {weekDays.map((d, i) => {
            const key = d.toISOString().split("T")[0];
            const dayShifts = shiftsByDay[key] || [];
            return (
              <div key={i} className="p-2 flex flex-col gap-1.5" style={{ borderRight: i < 6 ? "0.5px solid var(--border)" : "none", minHeight: 240 }}>
                {dayShifts.length === 0 ? (
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)", textAlign: "center", padding: "12px 0" }}>—</div>
                ) : dayShifts.map((s) => {
                  const rc = getRoleStyle(s.business_role);
                  const profile = s.user_id ? profiles.get(s.user_id) : null;
                  const studio = s.studio_id ? studios.get(s.studio_id) : null;
                  return (
                    <div key={s.id} className="rounded-md px-2 py-1.5"
                      style={{ backgroundColor: profile ? rc.bg : "var(--danger-bg)", borderLeft: `3px solid ${profile ? rc.dot : "var(--danger-text)"}` }}>
                      <div style={{ fontSize: 11, fontWeight: 500, color: profile ? rc.text : "var(--danger-text)" }}>
                        {hhmm(s.start_time)} — {hhmm(s.end_time)}
                      </div>
                      <div style={{ fontSize: 11, color: profile ? rc.text : "var(--danger-text)", marginTop: 1 }}>
                        {profile ? `${profile.first_name} ${profile.last_name.charAt(0)}.` : "Non assigné"}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 1 }}>{s.business_role}{studio ? ` · ${studio.replace("Skult ", "")}` : ""}</div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
