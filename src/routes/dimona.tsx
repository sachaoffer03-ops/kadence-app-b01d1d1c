import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Send, AlertTriangle, Check, Info, Search, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getRoleStyle, hhmm, fullName } from "@/lib/staff-helpers";

export const Route = createFileRoute("/dimona")({
  component: DimonaPage,
  head: () => ({ meta: [{ title: "Dimona — Kadence" }] }),
});

interface DShift {
  id: string; shift_date: string; start_time: string; end_time: string;
  business_role: string; user_id: string | null; studio_id: string | null;
  notes: string | null;
}
interface ProfileRow { id: string; first_name: string; last_name: string; niss: string | null }

type DStatus = "prête" | "données-manquantes" | "envoyée";
type StatusFilter = "tous" | DStatus;

function DimonaPage() {
  const [shifts, setShifts] = useState<DShift[]>([]);
  const [profiles, setProfiles] = useState<Map<string, ProfileRow>>(new Map());
  const [studios, setStudios] = useState<Map<string, string>>(new Map());
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("tous");

  useEffect(() => {
    const load = async () => {
      const today = new Date().toISOString().split("T")[0];
      const in7 = new Date(Date.now() + 7 * 86400_000).toISOString().split("T")[0];
      const [{ data: s }, { data: p }, { data: st }] = await Promise.all([
        supabase.from("shifts").select("id,shift_date,start_time,end_time,business_role,user_id,studio_id,notes").gte("shift_date", today).lte("shift_date", in7).not("user_id", "is", null).order("shift_date").order("start_time"),
        supabase.from("profiles").select("id,first_name,last_name,niss"),
        supabase.from("studios").select("id,name"),
      ]);
      setShifts((s || []) as DShift[]);
      setProfiles(new Map((p || []).map((x) => [x.id, x as ProfileRow])));
      setStudios(new Map((st || []).map((x) => [x.id, x.name])));
    };
    load();
    const ch = supabase.channel("dimona-rt").on("postgres_changes", { event: "*", schema: "public", table: "shifts" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const getStatus = (s: DShift): DStatus => {
    if (sent.has(s.id)) return "envoyée";
    const profile = s.user_id ? profiles.get(s.user_id) : null;
    if (!profile?.niss) return "données-manquantes";
    return "prête";
  };

  const getUrgency = (s: DShift): { label: string; bg: string; text: string } => {
    const shiftMs = new Date(`${s.shift_date}T${s.start_time}`).getTime();
    const hours = (shiftMs - Date.now()) / 3_600_000;
    if (hours < 24) return { label: "Critique", bg: "var(--danger-bg)", text: "var(--danger-text)" };
    if (hours < 48) return { label: "Urgent", bg: "var(--warning-bg)", text: "var(--warning-text)" };
    return { label: "Normal", bg: "var(--info-bg)", text: "var(--info-text)" };
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return shifts.filter((s) => {
      if (statusFilter !== "tous" && getStatus(s) !== statusFilter) return false;
      if (q) {
        const profile = s.user_id ? profiles.get(s.user_id) : null;
        if (!profile || !`${profile.first_name} ${profile.last_name}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [shifts, profiles, search, statusFilter, sent]);

  const ready = shifts.filter((s) => getStatus(s) === "prête");
  const missing = shifts.filter((s) => getStatus(s) === "données-manquantes");
  const sentCount = shifts.filter((s) => getStatus(s) === "envoyée").length;
  const critical = shifts.filter((s) => getUrgency(s).label === "Critique" && getStatus(s) !== "envoyée").length;

  const send = (id: string) => {
    setSent((prev) => new Set(prev).add(id));
    const s = shifts.find((x) => x.id === id);
    const profile = s?.user_id ? profiles.get(s.user_id) : null;
    toast.success(`Dimona envoyée pour ${fullName(profile)}`);
  };
  const sendAll = () => {
    const ids = ready.map((s) => s.id);
    setSent((prev) => { const n = new Set(prev); ids.forEach((i) => n.add(i)); return n; });
    toast.success(`${ids.length} déclaration${ids.length > 1 ? "s" : ""} envoyée${ids.length > 1 ? "s" : ""} à l'ONSS`);
  };

  const updateNiss = async (userId: string, niss: string) => {
    const { error } = await supabase.from("profiles").update({ niss }).eq("id", userId);
    if (error) toast.error(error.message);
    else { toast.success("NISS mis à jour"); setProfiles((prev) => { const n = new Map(prev); const p = n.get(userId); if (p) n.set(userId, { ...p, niss }); return n; }); }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 500, marginBottom: 2 }}>Déclarations Dimona</h1>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Envoyez les déclarations ONSS avant le début de chaque shift.</p>
        </div>
        {ready.length > 0 && (
          <button onClick={sendAll} className="rounded-md px-4 py-2 flex items-center gap-1.5"
            style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
            <Send size={13} /> Envoyer toutes les prêtes ({ready.length})
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <Kpi label="À envoyer" value={ready.length.toString()} color={critical > 0 ? "var(--danger-text)" : undefined} />
        <Kpi label="Données manquantes" value={missing.length.toString()} color={missing.length > 0 ? "var(--warning-text)" : undefined} />
        <Kpi label="Envoyées" value={sentCount.toString()} />
        <Kpi label="Critiques (<24h)" value={critical.toString()} color={critical > 0 ? "var(--danger-text)" : undefined} />
      </div>

      {critical > 0 && (
        <div className="rounded-xl px-5 py-3 flex items-center gap-3 mb-5" style={{ backgroundColor: "var(--danger-bg)" }}>
          <AlertTriangle size={16} style={{ color: "var(--danger-text)" }} />
          <span style={{ fontSize: 12, fontWeight: 500, color: "var(--danger-text)" }}>
            {critical} Dimona critique{critical > 1 ? "s" : ""} — shifts dans moins de 24h sans déclaration
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="flex items-center gap-2 rounded-md px-2.5 py-1.5" style={{ border: "0.5px solid var(--border)", backgroundColor: "var(--card)" }}>
          <Search size={13} style={{ color: "var(--muted-foreground)" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…" style={{ fontSize: 12, background: "transparent", outline: "none", border: "none", width: 200 }} />
          {search && <X size={12} style={{ cursor: "pointer" }} onClick={() => setSearch("")} />}
        </div>
        {[{ value: "tous", label: "Tous" }, { value: "prête", label: "Prêtes" }, { value: "données-manquantes", label: "Données manquantes" }, { value: "envoyée", label: "Envoyées" }].map((o) => {
          const a = statusFilter === o.value;
          return (
            <button key={o.value} onClick={() => setStatusFilter(o.value as StatusFilter)} className="rounded-full px-2.5 py-1"
              style={{ fontSize: 11, fontWeight: a ? 500 : 400, backgroundColor: a ? "var(--foreground)" : "transparent", color: a ? "var(--card)" : "var(--muted-foreground)", border: a ? "none" : "0.5px solid var(--border)" }}>
              {o.label}
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
        <table className="w-full" style={{ fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "0.5px solid var(--border)" }}>
              {["Employé", "Shift", "Studio", "NISS", "Urgence", "Statut", ""].map((h) => (
                <th key={h} className="text-left px-4 py-2.5" style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Aucune déclaration ne correspond.</td></tr>
            ) : filtered.map((s) => {
              const profile = s.user_id ? profiles.get(s.user_id) : null;
              const studioName = s.studio_id ? (studios.get(s.studio_id) || "—").replace("Skult ", "") : "—";
              const status = getStatus(s);
              const urgency = getUrgency(s);
              const rc = getRoleStyle(s.business_role);
              const sty = status === "prête" ? { bg: "var(--success-bg)", text: "var(--success-text)", label: "Prête" }
                : status === "envoyée" ? { bg: "var(--info-bg)", text: "var(--info-text)", label: "Envoyée" }
                : { bg: "var(--warning-bg)", text: "var(--warning-text)", label: "Données manquantes" };
              return (
                <DimonaRow key={s.id} shift={s} profile={profile} studio={studioName} status={status}
                  rc={rc} sty={sty} urgency={urgency}
                  onSend={() => send(s.id)} onUpdateNiss={(v) => profile && updateNiss(profile.id, v)} />
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl px-5 py-4 flex items-start gap-3 mt-5" style={{ backgroundColor: "var(--info-bg)" }}>
        <Info size={16} style={{ color: "var(--info-text)", marginTop: 1, flexShrink: 0 }} />
        <div style={{ fontSize: 12, color: "var(--info-text)", lineHeight: 1.6 }}>
          <span style={{ fontWeight: 500 }}>Rappel légal :</span> La déclaration Dimona IN doit être envoyée à l'ONSS avant le début effectif du shift.
        </div>
      </div>
    </div>
  );
}

function DimonaRow({ shift, profile, studio, status, rc, sty, urgency, onSend, onUpdateNiss }: {
  shift: DShift; profile: ProfileRow | null; studio: string; status: DStatus;
  rc: { bg: string; text: string }; sty: { bg: string; text: string; label: string };
  urgency: { label: string; bg: string; text: string };
  onSend: () => void; onUpdateNiss: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState("");
  return (
    <tr style={{ borderBottom: "0.5px solid var(--border)" }}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span style={{ fontWeight: 500 }}>{fullName(profile)}</span>
          <span className="rounded-full px-1.5 py-0.5" style={{ fontSize: 10, backgroundColor: rc.bg, color: rc.text }}>{shift.business_role}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div style={{ fontSize: 12 }}>{new Date(shift.shift_date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}</div>
        <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{hhmm(shift.start_time)} — {hhmm(shift.end_time)}</div>
      </td>
      <td className="px-4 py-3" style={{ fontSize: 12 }}>{studio}</td>
      <td className="px-4 py-3" style={{ fontSize: 12, fontFamily: "monospace" }}>
        {editing ? (
          <input autoFocus value={val} onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && val.trim()) { onUpdateNiss(val.trim()); setEditing(false); } if (e.key === "Escape") setEditing(false); }}
            placeholder="NISS" style={{ fontSize: 12, fontFamily: "monospace", padding: "4px 8px", border: "0.5px solid var(--border)", borderRadius: 4, width: 160, backgroundColor: "var(--background)" }} />
        ) : profile?.niss ? profile.niss : <span style={{ color: "var(--warning-text)" }}>Manquant</span>}
      </td>
      <td className="px-4 py-3"><span className="rounded-full px-2 py-0.5" style={{ fontSize: 10, fontWeight: 500, backgroundColor: urgency.bg, color: urgency.text }}>{urgency.label}</span></td>
      <td className="px-4 py-3"><span className="rounded-full px-2 py-0.5" style={{ fontSize: 10, fontWeight: 500, backgroundColor: sty.bg, color: sty.text }}>{sty.label}</span></td>
      <td className="px-4 py-3">
        {status === "prête" && (
          <button onClick={onSend} className="rounded-md px-3 py-1.5 flex items-center gap-1" style={{ fontSize: 11, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
            <Send size={11} /> Envoyer
          </button>
        )}
        {status === "données-manquantes" && !editing && (
          <button onClick={() => setEditing(true)} className="rounded-md px-3 py-1.5" style={{ fontSize: 11, fontWeight: 500, border: "0.5px solid var(--border)" }}>Compléter</button>
        )}
        {status === "envoyée" && <Check size={16} style={{ color: "var(--success-text)" }} />}
      </td>
    </tr>
  );
}

function Kpi({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      <div style={{ fontSize: 10, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{label}</div>
      <span style={{ fontSize: 22, fontWeight: 500, color: color || "var(--foreground)" }}>{value}</span>
    </div>
  );
}
