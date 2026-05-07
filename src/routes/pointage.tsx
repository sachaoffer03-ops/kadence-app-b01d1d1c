import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Clock, Check, BarChart3, AlertTriangle, Users, Sparkles, Calendar } from "lucide-react";
import { pointageEntries, roleColors, type PointageEntry } from "@/lib/mock-data";

export const Route = createFileRoute("/pointage")({
  component: PointagePage,
  head: () => ({ meta: [{ title: "Pointage — Shifty" }] }),
});

function PointagePage() {
  const onTime = pointageEntries.filter(e => e.status === 'à-temps').length;
  const late = pointageEntries.filter(e => e.status === 'retard').length;
  const inProgress = pointageEntries.filter(e => e.status === 'en-cours').length;
  const upcoming = pointageEntries.filter(e => e.status === 'à-venir').length;

  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 style={{ fontSize: 18, fontWeight: 500, marginBottom: 2 }}>Pointage</h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Suivi en temps réel des arrivées et départs.</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-5">
        <MiniKpi label="A l'heure" value={onTime.toString()} icon={<Check size={14} />} color="var(--success-text)" />
        <MiniKpi label="Retards" value={late.toString()} icon={<AlertTriangle size={14} />} color="var(--warning-text)" />
        <MiniKpi label="En cours" value={inProgress.toString()} icon={<Clock size={14} />} />
        <MiniKpi label="À venir" value={upcoming.toString()} icon={<Calendar size={14} />} />
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
        <table className="w-full" style={{ fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "0.5px solid var(--border)" }}>
              {["Employé", "Shift prévu", "Studio", "Pointage IN", "Pointage OUT", "Statut"].map(h => (
                <th key={h} className="text-left px-4 py-2.5" style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pointageEntries.map(entry => {
              const roleColor = roleColors[entry.role];
              const statusMap = {
                'à-temps': { bg: 'var(--success-bg)', text: 'var(--success-text)', label: 'A l\'heure' },
                'retard': { bg: 'var(--warning-bg)', text: 'var(--warning-text)', label: `Retard ${entry.delayMinutes}'` },
                'en-cours': { bg: 'var(--coral-light)', text: 'var(--coral-dark)', label: 'En cours' },
                'à-venir': { bg: 'var(--info-bg)', text: 'var(--info-text)', label: 'À venir' },
                'absent': { bg: 'var(--danger-bg)', text: 'var(--danger-text)', label: 'Absent' },
              };
              const s = statusMap[entry.status];
              return (
                <tr key={entry.id} style={{ borderBottom: "0.5px solid var(--border)" }}
                  onMouseEnter={ev => { (ev.currentTarget as HTMLElement).style.backgroundColor = "var(--muted)"; }}
                  onMouseLeave={ev => { (ev.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span style={{ fontWeight: 500 }}>{entry.employeeName}</span>
                      <span className="rounded-full px-1.5 py-0.5" style={{ fontSize: 10, backgroundColor: roleColor.bg, color: roleColor.text }}>{entry.role}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3" style={{ fontSize: 12 }}>{entry.shiftStart} — {entry.shiftEnd}</td>
                  <td className="px-4 py-3" style={{ fontSize: 12 }}>{entry.studio.replace('Skult ', '')}</td>
                  <td className="px-4 py-3" style={{ fontSize: 12, fontFamily: "monospace" }}>{entry.clockIn || '—'}</td>
                  <td className="px-4 py-3" style={{ fontSize: 12, fontFamily: "monospace" }}>{entry.clockOut || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full px-2 py-0.5" style={{ fontSize: 10, fontWeight: 500, backgroundColor: s.bg, color: s.text }}>{s.label}</span>
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

function MiniKpi({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color?: string }) {
  return (
    <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      <div className="flex items-center gap-1.5 mb-2" style={{ color: color || "var(--muted-foreground)" }}>{icon}<span style={{ fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span></div>
      <span style={{ fontSize: 22, fontWeight: 500, color: color || "var(--foreground)" }}>{value}</span>
    </div>
  );
}
