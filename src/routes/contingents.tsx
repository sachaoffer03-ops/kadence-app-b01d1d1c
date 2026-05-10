import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { employees, getQuotaStatus, roleColors, getInitials, type Studio } from "@/lib/mock-data";
import { AlertTriangle, Info, Search, X, Send } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/contingents")({
  component: ContingentsPage,
  head: () => ({ meta: [{ title: "Quotas étudiants — Kadence" }] }),
});

type StatusFilter = "tous" | "danger" | "warning" | "safe";

function ContingentsPage() {
  const [search, setSearch] = useState("");
  const [studio, setStudio] = useState<Studio | "tous">("tous");
  const [status, setStatus] = useState<StatusFilter>("tous");

  const students = employees.filter((e) => e.contract === "Étudiant");
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((e) => {
      if (studio !== "tous" && e.studio !== studio) return false;
      const st = getQuotaStatus(e.quotaUsed, e.quotaMax);
      if (status !== "tous" && st !== status) return false;
      if (q && !`${e.firstName} ${e.lastName}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [search, studio, status, students]);

  const atRisk = students.filter((e) => getQuotaStatus(e.quotaUsed, e.quotaMax) === "danger");
  const warning = students.filter((e) => getQuotaStatus(e.quotaUsed, e.quotaMax) === "warning");
  const totalUsed = students.reduce((s, e) => s + (e.quotaUsed || 0), 0);
  const totalMax = students.length * 650;

  const notifyAll = () => {
    if (atRisk.length === 0) { toast.info("Aucun étudiant en zone critique"); return; }
    toast.success(`Alerte envoyée à ${atRisk.length} étudiant${atRisk.length > 1 ? "s" : ""}`);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 500, marginBottom: 2 }}>Quotas étudiants</h1>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Suivi du plafond légal de 650h par étudiant jobiste.</p>
        </div>
        {atRisk.length > 0 && (
          <button onClick={notifyAll} className="rounded-md px-3 py-2 flex items-center gap-1.5"
            style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
            <Send size={13} /> Alerter les {atRisk.length} étudiant{atRisk.length > 1 ? "s" : ""} en risque
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <MiniKpi label="Étudiants actifs" value={students.length.toString()} />
        <MiniKpi label="Heures totales" value={`${totalUsed.toLocaleString("fr-BE")}`} sub={`/ ${totalMax.toLocaleString("fr-BE")}h`} />
        <MiniKpi label="Quota critique" value={atRisk.length.toString()} color={atRisk.length > 0 ? "var(--danger-text)" : undefined} sub="(>90%)" />
        <MiniKpi label="À surveiller" value={warning.length.toString()} color={warning.length > 0 ? "var(--warning-text)" : undefined} sub="(>50%)" />
      </div>

      {atRisk.length > 0 && (
        <div className="rounded-xl px-5 py-3 flex items-center gap-3 mb-5" style={{ backgroundColor: "var(--danger-bg)" }}>
          <AlertTriangle size={16} style={{ color: "var(--danger-text)" }} />
          <span style={{ fontSize: 12, fontWeight: 500, color: "var(--danger-text)" }}>
            {atRisk.length} étudiant{atRisk.length > 1 ? "s" : ""} à plus de 90% du quota — risque de dépassement
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="flex items-center gap-2 rounded-md px-2.5 py-1.5" style={{ border: "0.5px solid var(--border)", backgroundColor: "var(--card)" }}>
          <Search size={13} style={{ color: "var(--muted-foreground)" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…"
            style={{ fontSize: 12, background: "transparent", outline: "none", border: "none", width: 180 }} />
          {search && <X size={12} style={{ cursor: "pointer" }} onClick={() => setSearch("")} />}
        </div>
        <Chips value={studio} onChange={(v) => setStudio(v as Studio | "tous")}
          options={[{ value: "tous", label: "Tous" }, { value: "Skult Rhodes", label: "Rhodes" }, { value: "Skult Châtelain", label: "Châtelain" }]} />
        <Chips value={status} onChange={(v) => setStatus(v as StatusFilter)}
          options={[{ value: "tous", label: "Tous statuts" }, { value: "danger", label: "Critique" }, { value: "warning", label: "Surveiller" }, { value: "safe", label: "OK" }]} />
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
        <table className="w-full" style={{ fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "0.5px solid var(--border)" }}>
              {["Étudiant", "Postes", "Heures prestées", "Quota", "Progression", "Statut"].map((h) => (
                <th key={h} className="text-left px-4 py-2.5" style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Aucun étudiant ne correspond.</td></tr>
            ) : filtered.sort((a, b) => ((b.quotaUsed || 0) / (b.quotaMax || 1)) - ((a.quotaUsed || 0) / (a.quotaMax || 1))).map((emp) => {
              const pct = Math.round(((emp.quotaUsed || 0) / (emp.quotaMax || 1)) * 100);
              const st = getQuotaStatus(emp.quotaUsed, emp.quotaMax);
              const barColor = st === "danger" ? "var(--danger-text)" : st === "warning" ? "var(--warning-text)" : "var(--success-text)";
              const statusLabel = st === "danger" ? "Critique" : st === "warning" ? "À surveiller" : "OK";
              const statusBg = st === "danger" ? "var(--danger-bg)" : st === "warning" ? "var(--warning-bg)" : "var(--success-bg)";

              return (
                <tr key={emp.id} style={{ borderBottom: "0.5px solid var(--border)", cursor: "pointer" }}>
                  <td className="px-4 py-3">
                    <Link to="/staff/$id" params={{ id: emp.id }} className="flex items-center gap-2.5 hover:underline">
                      <div className="flex items-center justify-center rounded-full shrink-0" style={{ width: 28, height: 28, backgroundColor: roleColors[emp.roles[0]].bg, color: roleColors[emp.roles[0]].text, fontSize: 10, fontWeight: 500 }}>
                        {getInitials(emp.firstName, emp.lastName)}
                      </div>
                      <span style={{ fontWeight: 500 }}>{emp.firstName} {emp.lastName}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {emp.roles.map((r) => (
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
              border: active ? "none" : "0.5px solid var(--border)" }}>{o.label}</button>
        );
      })}
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
