import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Send, AlertTriangle, Check, Info, Search, X } from "lucide-react";
import { toast } from "sonner";
import { dimonaEntries, roleColors, getUrgencyColor, type DimonaEntry, type Studio } from "@/lib/mock-data";

export const Route = createFileRoute("/dimona")({
  component: DimonaPage,
  head: () => ({ meta: [{ title: "Dimona — Shyft" }] }),
});

const allStudios: (Studio | "tous")[] = ["tous", "Skult Rhodes", "Skult Châtelain"];
type StatusFilter = "tous" | DimonaEntry["status"];
const statusFilters: { value: StatusFilter; label: string }[] = [
  { value: "tous", label: "Tous" },
  { value: "prête", label: "Prêtes" },
  { value: "données-manquantes", label: "Données manquantes" },
  { value: "envoyée", label: "Envoyées" },
];

function DimonaPage() {
  const [entries, setEntries] = useState(dimonaEntries);
  const [studio, setStudio] = useState<Studio | "tous">("tous");
  const [status, setStatus] = useState<StatusFilter>("tous");
  const [search, setSearch] = useState("");
  const [fixingId, setFixingId] = useState<string | null>(null);
  const [fixValue, setFixValue] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (studio !== "tous" && e.studio !== studio) return false;
      if (status !== "tous" && e.status !== status) return false;
      if (q && !e.employeeName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [entries, studio, status, search]);

  const ready = entries.filter((e) => e.status === "prête");
  const missing = entries.filter((e) => e.status === "données-manquantes");
  const sent = entries.filter((e) => e.status === "envoyée");
  const criticalCount = entries.filter((e) => e.urgency === "critique" && e.status !== "envoyée").length;

  const handleSend = (id: string) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, status: "envoyée" as const } : e)));
    const e = entries.find((x) => x.id === id);
    toast.success(`Dimona envoyée pour ${e?.employeeName}`);
  };
  const handleSendAll = () => {
    const n = ready.length;
    setEntries((prev) => prev.map((e) => (e.status === "prête" ? { ...e, status: "envoyée" as const } : e)));
    toast.success(`${n} déclaration${n > 1 ? "s" : ""} envoyée${n > 1 ? "s" : ""} à l'ONSS`);
  };
  const startFix = (id: string) => { setFixingId(id); setFixValue(""); };
  const submitFix = (id: string) => {
    const v = fixValue.trim();
    if (!v) { toast.error("Renseignez la donnée manquante"); return; }
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, status: "prête" as const, niss: v, missingData: undefined } : e)));
    setFixingId(null);
    toast.success("Donnée mise à jour, déclaration prête à envoyer");
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 500, marginBottom: 2 }}>Déclarations Dimona</h1>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
            Envoyez les déclarations ONSS avant le début de chaque shift.
          </p>
        </div>
        {ready.length > 0 && (
          <button onClick={handleSendAll} className="rounded-md px-4 py-2 flex items-center gap-1.5"
            style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
            <Send size={13} />
            Envoyer toutes les prêtes ({ready.length})
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <MiniKpi label="À envoyer" value={ready.length.toString()} color={criticalCount > 0 ? "var(--danger-text)" : undefined} />
        <MiniKpi label="Données manquantes" value={missing.length.toString()} color={missing.length > 0 ? "var(--warning-text)" : undefined} />
        <MiniKpi label="Envoyées ce mois" value={(sent.length + 42).toString()} />
        <MiniKpi label="Taux d'erreur" value="0%" sub="objectif" />
      </div>

      {criticalCount > 0 && (
        <div className="rounded-xl px-5 py-3 flex items-center gap-3 mb-5" style={{ backgroundColor: "var(--danger-bg)" }}>
          <AlertTriangle size={16} style={{ color: "var(--danger-text)" }} />
          <span style={{ fontSize: 12, fontWeight: 500, color: "var(--danger-text)" }}>
            {criticalCount} Dimona critique{criticalCount > 1 ? "s" : ""} — shifts dans moins de 24h sans déclaration
          </span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="flex items-center gap-2 rounded-md px-2.5 py-1.5" style={{ border: "0.5px solid var(--border)", backgroundColor: "var(--card)" }}>
          <Search size={13} style={{ color: "var(--muted-foreground)" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un employé…"
            style={{ fontSize: 12, background: "transparent", outline: "none", border: "none", width: 200 }} />
          {search && <X size={12} style={{ cursor: "pointer", color: "var(--muted-foreground)" }} onClick={() => setSearch("")} />}
        </div>
        <Chips value={studio} onChange={(v) => setStudio(v as Studio | "tous")} options={allStudios.map((s) => ({ value: s, label: s === "tous" ? "Tous studios" : s.replace("Skult ", "") }))} />
        <Chips value={status} onChange={(v) => setStatus(v as StatusFilter)} options={statusFilters} />
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
              <tr><td colSpan={7} className="px-4 py-8 text-center" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Aucune déclaration ne correspond aux filtres.</td></tr>
            ) : (
              filtered.map((entry) => (
                <DimonaRow key={entry.id} entry={entry}
                  onSend={() => handleSend(entry.id)}
                  fixing={fixingId === entry.id}
                  fixValue={fixValue} setFixValue={setFixValue}
                  onStartFix={() => startFix(entry.id)}
                  onCancelFix={() => setFixingId(null)}
                  onSubmitFix={() => submitFix(entry.id)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl px-5 py-4 flex items-start gap-3 mt-5" style={{ backgroundColor: "var(--info-bg)" }}>
        <Info size={16} style={{ color: "var(--info-text)", marginTop: 1, flexShrink: 0 }} />
        <div style={{ fontSize: 12, color: "var(--info-text)", lineHeight: 1.6 }}>
          <span style={{ fontWeight: 500 }}>Rappel légal :</span> La déclaration Dimona IN doit être envoyée à l'ONSS avant le début effectif du shift.
          Un employé non déclaré est considéré comme travailleur au noir par l'inspection sociale.
        </div>
      </div>
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

function DimonaRow({ entry, onSend, fixing, fixValue, setFixValue, onStartFix, onCancelFix, onSubmitFix }:
  { entry: DimonaEntry; onSend: () => void; fixing: boolean; fixValue: string; setFixValue: (v: string) => void; onStartFix: () => void; onCancelFix: () => void; onSubmitFix: () => void }) {
  const urgencyColor = getUrgencyColor(entry.urgency);
  const roleColor = roleColors[entry.role];
  const statusStyles = {
    "prête": { bg: "var(--success-bg)", text: "var(--success-text)", label: "Prête" },
    "données-manquantes": { bg: "var(--warning-bg)", text: "var(--warning-text)", label: "Données manquantes" },
    "envoyée": { bg: "var(--info-bg)", text: "var(--info-text)", label: "Envoyée" },
    "erreur": { bg: "var(--danger-bg)", text: "var(--danger-text)", label: "Erreur" },
  };
  const s = statusStyles[entry.status];

  return (
    <tr style={{ borderBottom: "0.5px solid var(--border)" }}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span style={{ fontWeight: 500 }}>{entry.employeeName}</span>
          <span className="rounded-full px-1.5 py-0.5" style={{ fontSize: 10, backgroundColor: roleColor.bg, color: roleColor.text }}>{entry.role}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div style={{ fontSize: 12 }}>{entry.shiftDate}</div>
        <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{entry.shiftTime}</div>
      </td>
      <td className="px-4 py-3" style={{ fontSize: 12 }}>{entry.studio.replace("Skult ", "")}</td>
      <td className="px-4 py-3" style={{ fontSize: 12, fontFamily: "monospace" }}>
        {fixing ? (
          <input autoFocus value={fixValue} onChange={(e) => setFixValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onSubmitFix(); if (e.key === "Escape") onCancelFix(); }}
            placeholder={entry.missingData}
            style={{ fontSize: 12, fontFamily: "monospace", padding: "4px 8px", border: "0.5px solid var(--border)", borderRadius: 4, width: 160, backgroundColor: "var(--background)" }} />
        ) : entry.niss ? (
          entry.niss
        ) : (
          <span style={{ color: "var(--warning-text)" }}>{entry.missingData}</span>
        )}
      </td>
      <td className="px-4 py-3">
        <span className="rounded-full px-2 py-0.5" style={{ fontSize: 10, fontWeight: 500, backgroundColor: urgencyColor.bg, color: urgencyColor.text }}>{urgencyColor.label}</span>
      </td>
      <td className="px-4 py-3">
        <span className="rounded-full px-2 py-0.5" style={{ fontSize: 10, fontWeight: 500, backgroundColor: s.bg, color: s.text }}>{s.label}</span>
      </td>
      <td className="px-4 py-3">
        {entry.status === "prête" && (
          <button onClick={onSend} className="rounded-md px-3 py-1.5 flex items-center gap-1" style={{ fontSize: 11, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
            <Send size={11} /> Envoyer
          </button>
        )}
        {entry.status === "données-manquantes" && !fixing && (
          <button onClick={onStartFix} className="rounded-md px-3 py-1.5" style={{ fontSize: 11, fontWeight: 500, border: "0.5px solid var(--border)" }}>
            Compléter
          </button>
        )}
        {entry.status === "données-manquantes" && fixing && (
          <div className="flex gap-1">
            <button onClick={onSubmitFix} className="rounded-md px-2.5 py-1.5" style={{ fontSize: 11, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>OK</button>
            <button onClick={onCancelFix} className="rounded-md px-2 py-1.5" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Annuler</button>
          </div>
        )}
        {entry.status === "envoyée" && <Check size={16} style={{ color: "var(--success-text)" }} />}
      </td>
    </tr>
  );
}

function MiniKpi({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      <div style={{ fontSize: 10, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{label}</div>
      <div className="flex items-baseline gap-1">
        <span style={{ fontSize: 22, fontWeight: 500, color: color || "var(--foreground)" }}>{value}</span>
        {sub && <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{sub}</span>}
      </div>
    </div>
  );
}
