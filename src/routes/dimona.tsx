import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { FileText, Send, AlertTriangle, Check, Clock, Info } from "lucide-react";
import { dimonaEntries, roleColors, getUrgencyColor, type DimonaEntry } from "@/lib/mock-data";

export const Route = createFileRoute("/dimona")({
  component: DimonaPage,
  head: () => ({ meta: [{ title: "Dimona — Shifty" }] }),
});

function DimonaPage() {
  const [entries, setEntries] = useState(dimonaEntries);
  const ready = entries.filter(e => e.status === 'prête');
  const missing = entries.filter(e => e.status === 'données-manquantes');
  const sent = entries.filter(e => e.status === 'envoyée');
  const criticalCount = entries.filter(e => e.urgency === 'critique' && e.status !== 'envoyée').length;

  const handleSend = (id: string) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, status: 'envoyée' as const } : e));
  };

  const handleSendAll = () => {
    setEntries(prev => prev.map(e => e.status === 'prête' ? { ...e, status: 'envoyée' as const } : e));
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 500, marginBottom: 2 }}>Déclarations Dimona</h1>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
            Envoyez les déclarations ONSS avant le début de chaque shift.
          </p>
        </div>
        {ready.length > 0 && (
          <button
            onClick={handleSendAll}
            className="rounded-md px-4 py-2 flex items-center gap-1.5 transition-colors"
            style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}
          >
            <Send size={13} />
            Envoyer toutes les prêtes ({ready.length})
          </button>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        <MiniKpi label="À envoyer" value={ready.length.toString()} color={criticalCount > 0 ? "var(--danger-text)" : undefined} />
        <MiniKpi label="Données manquantes" value={missing.length.toString()} color={missing.length > 0 ? "var(--warning-text)" : undefined} />
        <MiniKpi label="Envoyées ce mois" value={(sent.length + 42).toString()} />
        <MiniKpi label="Taux d'erreur" value="0%" sub="objectif" />
      </div>

      {/* Critical alert */}
      {criticalCount > 0 && (
        <div className="rounded-xl px-5 py-3 flex items-center gap-3 mb-5" style={{ backgroundColor: "var(--danger-bg)" }}>
          <AlertTriangle size={16} style={{ color: "var(--danger-text)" }} />
          <span style={{ fontSize: 12, fontWeight: 500, color: "var(--danger-text)" }}>
            {criticalCount} Dimona critique{criticalCount > 1 ? 's' : ''} — shifts dans moins de 24h sans déclaration
          </span>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
        <table className="w-full" style={{ fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "0.5px solid var(--border)" }}>
              {["Employé", "Shift", "Studio", "NISS", "Urgence", "Statut", ""].map(h => (
                <th key={h} className="text-left px-4 py-2.5" style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map(entry => (
              <DimonaRow key={entry.id} entry={entry} onSend={() => handleSend(entry.id)} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Info */}
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

function DimonaRow({ entry, onSend }: { entry: DimonaEntry; onSend: () => void }) {
  const urgencyColor = getUrgencyColor(entry.urgency);
  const roleColor = roleColors[entry.role];

  const statusStyles = {
    'prête': { bg: 'var(--success-bg)', text: 'var(--success-text)', label: 'Prête' },
    'données-manquantes': { bg: 'var(--warning-bg)', text: 'var(--warning-text)', label: 'Données manquantes' },
    'envoyée': { bg: 'var(--info-bg)', text: 'var(--info-text)', label: 'Envoyée' },
    'erreur': { bg: 'var(--danger-bg)', text: 'var(--danger-text)', label: 'Erreur' },
  };

  const s = statusStyles[entry.status];

  return (
    <tr style={{ borderBottom: "0.5px solid var(--border)" }}
      onMouseEnter={ev => { (ev.currentTarget as HTMLElement).style.backgroundColor = "var(--muted)"; }}
      onMouseLeave={ev => { (ev.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span style={{ fontWeight: 500 }}>{entry.employeeName}</span>
          <span className="rounded-full px-1.5 py-0.5" style={{ fontSize: 10, backgroundColor: roleColor.bg, color: roleColor.text }}>
            {entry.role}
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div style={{ fontSize: 12 }}>{entry.shiftDate}</div>
        <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{entry.shiftTime}</div>
      </td>
      <td className="px-4 py-3" style={{ fontSize: 12 }}>{entry.studio.replace('Skult ', '')}</td>
      <td className="px-4 py-3" style={{ fontSize: 12, fontFamily: "monospace" }}>
        {entry.niss || <span style={{ color: "var(--warning-text)" }}>{entry.missingData}</span>}
      </td>
      <td className="px-4 py-3">
        <span className="rounded-full px-2 py-0.5" style={{ fontSize: 10, fontWeight: 500, backgroundColor: urgencyColor.bg, color: urgencyColor.text }}>
          {urgencyColor.label}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className="rounded-full px-2 py-0.5" style={{ fontSize: 10, fontWeight: 500, backgroundColor: s.bg, color: s.text }}>
          {s.label}
        </span>
      </td>
      <td className="px-4 py-3">
        {entry.status === 'prête' && (
          <button onClick={onSend} className="rounded-md px-3 py-1.5 flex items-center gap-1 transition-colors" style={{ fontSize: 11, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
            <Send size={11} /> Envoyer
          </button>
        )}
        {entry.status === 'envoyée' && <Check size={16} style={{ color: "var(--success-text)" }} />}
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
