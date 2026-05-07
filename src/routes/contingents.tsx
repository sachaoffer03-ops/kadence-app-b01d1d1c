import { createFileRoute } from "@tanstack/react-router";
import { employees, getQuotaStatus, roleColors, getInitials } from "@/lib/mock-data";
import { AlertTriangle, Info } from "lucide-react";

export const Route = createFileRoute("/contingents")({
  component: ContingentsPage,
  head: () => ({ meta: [{ title: "Contingents — Shifty" }] }),
});

function ContingentsPage() {
  const students = employees.filter(e => e.contract === 'Étudiant');
  const atRisk = students.filter(e => getQuotaStatus(e.quotaUsed, e.quotaMax) === 'danger');
  const warning = students.filter(e => getQuotaStatus(e.quotaUsed, e.quotaMax) === 'warning');
  const totalUsed = students.reduce((s, e) => s + (e.quotaUsed || 0), 0);
  const totalMax = students.length * 650;

  return (
    <div className="p-6" style={{ maxWidth: 1200 }}>
      <div className="mb-5">
        <h1 style={{ fontSize: 18, fontWeight: 500, marginBottom: 2 }}>Contingents étudiants</h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
          Suivi du plafond légal de 650h par étudiant jobiste.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-5">
        <MiniKpi label="Étudiants actifs" value={students.length.toString()} />
        <MiniKpi label="Heures totales" value={`${totalUsed.toLocaleString('fr-BE')}`} sub={`/ ${totalMax.toLocaleString('fr-BE')}h`} />
        <MiniKpi label="Quota critique" value={atRisk.length.toString()} color={atRisk.length > 0 ? "var(--danger-text)" : undefined} sub="(>90%)" />
        <MiniKpi label="À surveiller" value={warning.length.toString()} color={warning.length > 0 ? "var(--warning-text)" : undefined} sub="(>50%)" />
      </div>

      {atRisk.length > 0 && (
        <div className="rounded-xl px-5 py-3 flex items-center gap-3 mb-5" style={{ backgroundColor: "var(--danger-bg)" }}>
          <AlertTriangle size={16} style={{ color: "var(--danger-text)" }} />
          <span style={{ fontSize: 12, fontWeight: 500, color: "var(--danger-text)" }}>
            {atRisk.length} étudiant{atRisk.length > 1 ? 's' : ''} à plus de 90% du quota — risque de dépassement
          </span>
        </div>
      )}

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
        <table className="w-full" style={{ fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "0.5px solid var(--border)" }}>
              {["Étudiant", "Postes", "Heures prestées", "Quota", "Progression", "Statut"].map(h => (
                <th key={h} className="text-left px-4 py-2.5" style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.sort((a, b) => ((b.quotaUsed || 0) / (b.quotaMax || 1)) - ((a.quotaUsed || 0) / (a.quotaMax || 1))).map(emp => {
              const pct = Math.round(((emp.quotaUsed || 0) / (emp.quotaMax || 1)) * 100);
              const status = getQuotaStatus(emp.quotaUsed, emp.quotaMax);
              const barColor = status === 'danger' ? "var(--danger-text)" : status === 'warning' ? "var(--warning-text)" : "var(--success-text)";
              const statusLabel = status === 'danger' ? 'Critique' : status === 'warning' ? 'À surveiller' : 'OK';
              const statusBg = status === 'danger' ? 'var(--danger-bg)' : status === 'warning' ? 'var(--warning-bg)' : 'var(--success-bg)';

              return (
                <tr key={emp.id} style={{ borderBottom: "0.5px solid var(--border)" }}
                  onMouseEnter={ev => { (ev.currentTarget as HTMLElement).style.backgroundColor = "var(--muted)"; }}
                  onMouseLeave={ev => { (ev.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex items-center justify-center rounded-full shrink-0" style={{ width: 28, height: 28, backgroundColor: roleColors[emp.roles[0]].bg, color: roleColors[emp.roles[0]].text, fontSize: 10, fontWeight: 500 }}>
                        {getInitials(emp.firstName, emp.lastName)}
                      </div>
                      <span style={{ fontWeight: 500 }}>{emp.firstName} {emp.lastName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {emp.roles.map(r => (
                        <span key={r} className="rounded-full px-1.5 py-0.5" style={{ fontSize: 10, backgroundColor: roleColors[r].bg, color: roleColors[r].text }}>{r}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3" style={{ fontWeight: 500 }}>{emp.quotaUsed}h</td>
                  <td className="px-4 py-3" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{emp.quotaMax}h</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div style={{ width: 80, height: 4, borderRadius: 2, backgroundColor: "var(--muted)" }}>
                        <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", borderRadius: 2, backgroundColor: barColor }} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 500, color: barColor }}>{pct}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full px-2 py-0.5" style={{ fontSize: 10, fontWeight: 500, backgroundColor: statusBg, color: barColor }}>{statusLabel}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl px-5 py-4 flex items-start gap-3 mt-5" style={{ backgroundColor: "var(--info-bg)" }}>
        <Info size={16} style={{ color: "var(--info-text)", marginTop: 1, flexShrink: 0 }} />
        <div style={{ fontSize: 12, color: "var(--info-text)", lineHeight: 1.6 }}>
          <span style={{ fontWeight: 500 }}>Plafond légal belge :</span> Un étudiant jobiste peut prester maximum 650 heures par année civile sous le régime de cotisations sociales réduites. Au-delà, les cotisations normales s'appliquent.
        </div>
      </div>
    </div>
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
