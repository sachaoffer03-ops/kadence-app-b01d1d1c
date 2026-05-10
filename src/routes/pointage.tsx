import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Clock, Check, AlertTriangle, Calendar, Search, X, Edit3, LogIn, LogOut } from "lucide-react";
import { toast } from "sonner";
import { pointageEntries, roleColors, type PointageEntry, type Studio } from "@/lib/mock-data";

export const Route = createFileRoute("/pointage")({
  component: PointagePage,
  head: () => ({ meta: [{ title: "Pointage — Kadence" }] }),
});

function nowHHMM() {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, "0")}h${d.getMinutes().toString().padStart(2, "0")}`;
}

type StatusFilter = "tous" | PointageEntry["status"];

function PointagePage() {
  const [entries, setEntries] = useState(pointageEntries);
  const [search, setSearch] = useState("");
  const [studio, setStudio] = useState<Studio | "tous">("tous");
  const [status, setStatus] = useState<StatusFilter>("tous");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editIn, setEditIn] = useState("");
  const [editOut, setEditOut] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (studio !== "tous" && e.studio !== studio) return false;
      if (status !== "tous" && e.status !== status) return false;
      if (q && !e.employeeName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [entries, search, studio, status]);

  const onTime = entries.filter((e) => e.status === "à-temps").length;
  const late = entries.filter((e) => e.status === "retard").length;
  const inProgress = entries.filter((e) => e.status === "en-cours").length;
  const upcoming = entries.filter((e) => e.status === "à-venir").length;

  const forceClockIn = (id: string) => {
    const t = nowHHMM();
    setEntries((prev) => prev.map((e) => e.id === id ? { ...e, clockIn: t, status: "en-cours" } : e));
    toast.success(`Pointage IN forcé à ${t}`);
  };
  const forceClockOut = (id: string) => {
    const t = nowHHMM();
    setEntries((prev) => prev.map((e) => e.id === id ? { ...e, clockOut: t, status: "à-temps" } : e));
    toast.success(`Pointage OUT forcé à ${t}`);
  };
  const markAbsent = (id: string) => {
    setEntries((prev) => prev.map((e) => e.id === id ? { ...e, status: "absent" } : e));
    toast.warning("Marqué comme absent");
  };
  const startEdit = (e: PointageEntry) => {
    setEditingId(e.id);
    setEditIn(e.clockIn || "");
    setEditOut(e.clockOut || "");
  };
  const submitEdit = (id: string) => {
    setEntries((prev) => prev.map((e) => e.id === id ? { ...e, clockIn: editIn || undefined, clockOut: editOut || undefined } : e));
    setEditingId(null);
    toast.success("Horaire corrigé");
  };

  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 style={{ fontSize: 18, fontWeight: 500, marginBottom: 2 }}>Pointage</h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Suivi en temps réel des arrivées et départs.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <MiniKpi label="A l'heure" value={onTime.toString()} icon={<Check size={14} />} color="var(--success-text)" />
        <MiniKpi label="Retards" value={late.toString()} icon={<AlertTriangle size={14} />} color="var(--warning-text)" />
        <MiniKpi label="En cours" value={inProgress.toString()} icon={<Clock size={14} />} />
        <MiniKpi label="À venir" value={upcoming.toString()} icon={<Calendar size={14} />} />
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="flex items-center gap-2 rounded-md px-2.5 py-1.5" style={{ border: "0.5px solid var(--border)", backgroundColor: "var(--card)" }}>
          <Search size={13} style={{ color: "var(--muted-foreground)" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…"
            style={{ fontSize: 12, background: "transparent", outline: "none", border: "none", width: 180 }} />
          {search && <X size={12} style={{ cursor: "pointer" }} onClick={() => setSearch("")} />}
        </div>
        <Chips value={studio} onChange={(v) => setStudio(v as Studio | "tous")}
          options={[{ value: "tous", label: "Tous" }, { value: "Skult Rhodes", label: "Rhodes" }, { value: "Skult Châtelain", label: "Châtelain" }]} />
        <Chips value={status} onChange={(v) => setStatus(v as StatusFilter)} options={[
          { value: "tous", label: "Tous" }, { value: "à-temps", label: "À l'heure" }, { value: "retard", label: "Retards" },
          { value: "en-cours", label: "En cours" }, { value: "à-venir", label: "À venir" }, { value: "absent", label: "Absents" },
        ]} />
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
        <table className="w-full" style={{ fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "0.5px solid var(--border)" }}>
              {["Employé", "Shift prévu", "Studio", "Pointage IN", "Pointage OUT", "Statut", ""].map((h) => (
                <th key={h} className="text-left px-4 py-2.5" style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Aucun pointage trouvé.</td></tr>
            ) : (
              filtered.map((entry) => {
                const roleColor = roleColors[entry.role];
                const statusMap = {
                  "à-temps": { bg: "var(--success-bg)", text: "var(--success-text)", label: "À l'heure" },
                  "retard": { bg: "var(--warning-bg)", text: "var(--warning-text)", label: `Retard ${entry.delayMinutes}'` },
                  "en-cours": { bg: "var(--coral-light)", text: "var(--coral-dark)", label: "En cours" },
                  "à-venir": { bg: "var(--info-bg)", text: "var(--info-text)", label: "À venir" },
                  "absent": { bg: "var(--danger-bg)", text: "var(--danger-text)", label: "Absent" },
                };
                const s = statusMap[entry.status];
                const editing = editingId === entry.id;
                return (
                  <tr key={entry.id} style={{ borderBottom: "0.5px solid var(--border)" }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span style={{ fontWeight: 500 }}>{entry.employeeName}</span>
                        <span className="rounded-full px-1.5 py-0.5" style={{ fontSize: 10, backgroundColor: roleColor.bg, color: roleColor.text }}>{entry.role}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3" style={{ fontSize: 12 }}>{entry.shiftStart} — {entry.shiftEnd}</td>
                    <td className="px-4 py-3" style={{ fontSize: 12 }}>{entry.studio.replace("Skult ", "")}</td>
                    <td className="px-4 py-3" style={{ fontSize: 12, fontFamily: "monospace" }}>
                      {editing ? (
                        <input value={editIn} onChange={(e) => setEditIn(e.target.value)} placeholder="07h00"
                          style={{ fontSize: 12, padding: "2px 6px", border: "0.5px solid var(--border)", borderRadius: 4, width: 80, fontFamily: "monospace", backgroundColor: "var(--background)" }} />
                      ) : (entry.clockIn || "—")}
                    </td>
                    <td className="px-4 py-3" style={{ fontSize: 12, fontFamily: "monospace" }}>
                      {editing ? (
                        <input value={editOut} onChange={(e) => setEditOut(e.target.value)} placeholder="12h00"
                          style={{ fontSize: 12, padding: "2px 6px", border: "0.5px solid var(--border)", borderRadius: 4, width: 80, fontFamily: "monospace", backgroundColor: "var(--background)" }} />
                      ) : (entry.clockOut || "—")}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full px-2 py-0.5" style={{ fontSize: 10, fontWeight: 500, backgroundColor: s.bg, color: s.text }}>{s.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      {editing ? (
                        <div className="flex gap-1">
                          <button onClick={() => submitEdit(entry.id)} className="rounded-md px-2.5 py-1" style={{ fontSize: 11, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>OK</button>
                          <button onClick={() => setEditingId(null)} className="rounded-md px-2 py-1" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>×</button>
                        </div>
                      ) : (
                        <RowActions entry={entry} onIn={() => forceClockIn(entry.id)} onOut={() => forceClockOut(entry.id)} onAbsent={() => markAbsent(entry.id)} onEdit={() => startEdit(entry)} />
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RowActions({ entry, onIn, onOut, onAbsent, onEdit }: { entry: PointageEntry; onIn: () => void; onOut: () => void; onAbsent: () => void; onEdit: () => void }) {
  return (
    <div className="flex items-center gap-1 justify-end">
      {entry.status === "à-venir" && (
        <>
          <button onClick={onIn} title="Forcer pointage IN" className="rounded-md p-1.5" style={{ border: "0.5px solid var(--border)" }}><LogIn size={12} /></button>
          <button onClick={onAbsent} title="Marquer absent" className="rounded-md p-1.5" style={{ border: "0.5px solid var(--border)", color: "var(--danger-text)" }}><X size={12} /></button>
        </>
      )}
      {entry.status === "en-cours" && (
        <button onClick={onOut} title="Forcer pointage OUT" className="rounded-md px-2.5 py-1 flex items-center gap-1" style={{ fontSize: 11, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
          <LogOut size={11} /> Clôturer
        </button>
      )}
      <button onClick={onEdit} title="Corriger" className="rounded-md p-1.5" style={{ border: "0.5px solid var(--border)" }}><Edit3 size={12} /></button>
    </div>
  );
}

function Chips({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button key={o.value} onClick={() => onChange(o.value)} className="rounded-full px-2.5 py-1"
            style={{ fontSize: 11, fontWeight: active ? 500 : 400,
              backgroundColor: active ? "var(--foreground)" : "transparent",
              color: active ? "var(--card)" : "var(--muted-foreground)",
              border: active ? "none" : "0.5px solid var(--border)" }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function MiniKpi({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color?: string }) {
  return (
    <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      <div className="flex items-center gap-1.5 mb-2" style={{ color: color || "var(--muted-foreground)" }}>
        {icon}<span style={{ fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      </div>
      <span style={{ fontSize: 22, fontWeight: 500, color: color || "var(--foreground)" }}>{value}</span>
    </div>
  );
}
