import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Clock, Check, Calendar, Search, X, LogIn, LogOut } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getRoleStyle, hhmm, fullName, computePunctuality, computePartialPunctuality, punctualityColor } from "@/lib/staff-helpers";

export const Route = createFileRoute("/pointage")({
  component: PointagePage,
  head: () => ({ meta: [{ title: "Pointage — Kadence" }] }),
});

interface Shift {
  id: string; shift_date: string; start_time: string; end_time: string;
  business_role: string; user_id: string | null; studio_id: string | null;
  clocked_in_at: string | null; clocked_out_at: string | null;
}

type StatusFilter = "tous" | "en-cours" | "terminé" | "à-venir";

function PointagePage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [profiles, setProfiles] = useState<Map<string, { first_name: string; last_name: string }>>(new Map());
  const [studios, setStudios] = useState<Map<string, string>>(new Map());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("tous");

  const load = async () => {
    const today = new Date().toISOString().split("T")[0];
    const [{ data: s }, { data: p }, { data: st }] = await Promise.all([
      supabase.from("shifts").select("*").eq("shift_date", today).order("start_time"),
      supabase.from("profiles").select("id,first_name,last_name"),
      supabase.from("studios").select("id,name"),
    ]);
    setShifts((s || []) as Shift[]);
    setProfiles(new Map((p || []).map((x) => [x.id, x])));
    setStudios(new Map((st || []).map((x) => [x.id, x.name])));
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("pointage-rt").on("postgres_changes", { event: "*", schema: "public", table: "shifts" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const getStatus = (s: Shift): StatusFilter =>
    s.clocked_out_at ? "terminé" : s.clocked_in_at ? "en-cours" : "à-venir";

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return shifts.filter((s) => {
      if (statusFilter !== "tous" && getStatus(s) !== statusFilter) return false;
      if (q) {
        const profile = s.user_id ? profiles.get(s.user_id) : null;
        const name = profile ? `${profile.first_name} ${profile.last_name}` : "";
        if (!name.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [shifts, search, statusFilter, profiles]);

  const counts = {
    inProgress: shifts.filter((s) => getStatus(s) === "en-cours").length,
    done: shifts.filter((s) => getStatus(s) === "terminé").length,
    upcoming: shifts.filter((s) => getStatus(s) === "à-venir").length,
  };

  const clockIn = async (id: string) => {
    const { error } = await supabase.from("shifts").update({ clocked_in_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error(error.message); else toast.success("Pointage IN forcé");
  };
  const clockOut = async (id: string) => {
    const { error } = await supabase.from("shifts").update({ clocked_out_at: new Date().toISOString(), status: "completed" }).eq("id", id);
    if (error) toast.error(error.message); else toast.success("Pointage OUT forcé");
  };

  return (
    <div className="p-4 md:p-6">
      <div className="mb-5">
        <h1 style={{ fontSize: 18, fontWeight: 500, marginBottom: 2 }}>Pointage</h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Suivi en temps réel des arrivées et départs — {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <Kpi label="En cours" value={counts.inProgress} icon={<Clock size={14} />} />
        <Kpi label="Terminés" value={counts.done} icon={<Check size={14} />} color="var(--success-text)" />
        <Kpi label="À venir" value={counts.upcoming} icon={<Calendar size={14} />} />
        <Kpi label="Total jour" value={shifts.length} icon={<Clock size={14} />} />
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="flex items-center gap-2 rounded-md px-2.5 py-1.5" style={{ border: "0.5px solid var(--border)", backgroundColor: "var(--card)" }}>
          <Search size={13} style={{ color: "var(--muted-foreground)" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…" style={{ fontSize: 12, background: "transparent", outline: "none", border: "none", width: 180 }} />
          {search && <X size={12} style={{ cursor: "pointer" }} onClick={() => setSearch("")} />}
        </div>
        <Chips value={statusFilter} onChange={(v) => setStatusFilter(v as StatusFilter)} options={[
          { value: "tous", label: "Tous" }, { value: "à-venir", label: "À venir" }, { value: "en-cours", label: "En cours" }, { value: "terminé", label: "Terminés" },
        ]} />
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
        <table className="w-full" style={{ fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "0.5px solid var(--border)" }}>
              {["Employé", "Shift prévu", "Studio", "IN", "OUT", "Ponctualité", "Statut", ""].map((h) => (
                <th key={h} className="text-left px-4 py-2.5" style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Aucun shift aujourd'hui.</td></tr>
            ) : filtered.map((entry) => {
              const profile = entry.user_id ? profiles.get(entry.user_id) : null;
              const status = getStatus(entry);
              const rc = getRoleStyle(entry.business_role);
              const studioName = entry.studio_id ? (studios.get(entry.studio_id) || "—").replace("Skult ", "") : "—";
              const sty = status === "terminé" ? { bg: "var(--success-bg)", text: "var(--success-text)", label: "Terminé" }
                : status === "en-cours" ? { bg: "var(--coral-light)", text: "var(--coral-dark)", label: "En cours" }
                : { bg: "var(--info-bg)", text: "var(--info-text)", label: "À venir" };
              const inT = entry.clocked_in_at ? new Date(entry.clocked_in_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }).replace(":", "h") : "—";
              const outT = entry.clocked_out_at ? new Date(entry.clocked_out_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }).replace(":", "h") : "—";
              const punct = entry.clocked_out_at
                ? computePunctuality(entry)
                : entry.clocked_in_at
                ? computePartialPunctuality(entry)
                : null;
              const punctIsFinal = !!entry.clocked_out_at;

              return (
                <tr key={entry.id} style={{ borderBottom: "0.5px solid var(--border)" }}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span style={{ fontWeight: 500 }}>{profile ? fullName(profile) : "Non assigné"}</span>
                      <span className="rounded-full px-1.5 py-0.5" style={{ fontSize: 10, backgroundColor: rc.bg, color: rc.text }}>{entry.business_role}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3" style={{ fontSize: 12 }}>{hhmm(entry.start_time)} — {hhmm(entry.end_time)}</td>
                  <td className="px-4 py-3" style={{ fontSize: 12 }}>{studioName}</td>
                  <td className="px-4 py-3" style={{ fontSize: 12, fontFamily: "monospace" }}>{inT}</td>
                  <td className="px-4 py-3" style={{ fontSize: 12, fontFamily: "monospace" }}>{outT}</td>
                  <td className="px-4 py-3" style={{ fontSize: 12 }}>
                    {punct === null ? (
                      <span style={{ color: "var(--muted-foreground)" }}>—</span>
                    ) : (
                      <span style={{ fontWeight: 500, color: punctualityColor(punct) }}>
                        {punct}%{!punctIsFinal && <span style={{ fontSize: 10, color: "var(--muted-foreground)", marginLeft: 4 }}>(IN)</span>}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3"><span className="rounded-full px-2 py-0.5" style={{ fontSize: 10, fontWeight: 500, backgroundColor: sty.bg, color: sty.text }}>{sty.label}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      {status === "à-venir" && profile && (
                        <button onClick={() => clockIn(entry.id)} title="Forcer pointage IN" className="rounded-md p-1.5" style={{ border: "0.5px solid var(--border)" }}><LogIn size={12} /></button>
                      )}
                      {status === "en-cours" && (
                        <button onClick={() => clockOut(entry.id)} className="rounded-md px-2.5 py-1 flex items-center gap-1" style={{ fontSize: 11, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
                          <LogOut size={11} /> Clôturer
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Chips({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {options.map((o) => {
        const a = value === o.value;
        return (
          <button key={o.value} onClick={() => onChange(o.value)} className="rounded-full px-2.5 py-1"
            style={{ fontSize: 11, fontWeight: a ? 500 : 400, backgroundColor: a ? "var(--foreground)" : "transparent", color: a ? "var(--card)" : "var(--muted-foreground)", border: a ? "none" : "0.5px solid var(--border)" }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Kpi({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color?: string }) {
  return (
    <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      <div className="flex items-center gap-1.5 mb-2" style={{ color: color || "var(--muted-foreground)" }}>
        {icon}<span style={{ fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      </div>
      <span style={{ fontSize: 22, fontWeight: 500, color: color || "var(--foreground)" }}>{value}</span>
    </div>
  );
}
