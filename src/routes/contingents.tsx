import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Info, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getRoleStyle, fullName, initials } from "@/lib/staff-helpers";

export const Route = createFileRoute("/contingents")({
  component: ContingentsPage,
  head: () => ({ meta: [{ title: "Quotas étudiants — Kadence" }] }),
});

interface Student {
  id: string; first_name: string; last_name: string;
  quota_used: number | null; quota_max: number | null;
  studio_id: string | null;
  allow_extended_hours: boolean | null;
  weekly_hours_cap: number | null;
}

type StatusFilter = "tous" | "danger" | "warning" | "safe";

function getQuotaStatus(used: number, max: number): "danger" | "warning" | "safe" {
  if (max === 0) return "safe";
  const pct = used / max;
  if (pct >= 0.9) return "danger";
  if (pct >= 0.5) return "warning";
  return "safe";
}

function ContingentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [roles, setRoles] = useState<Map<string, string[]>>(new Map());
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("tous");

  useEffect(() => {
    const load = async () => {
      const [{ data: profs }, { data: ubr }] = await Promise.all([
        supabase.from("profiles").select("id,first_name,last_name,quota_used,quota_max,studio_id,allow_extended_hours,weekly_hours_cap").eq("contract", "Étudiant"),
        supabase.from("user_business_roles").select("user_id,role"),
      ]);
      setStudents((profs || []) as Student[]);
      const m = new Map<string, string[]>();
      (ubr || []).forEach((r) => { const arr = m.get(r.user_id) || []; arr.push(r.role); m.set(r.user_id, arr); });
      setRoles(m);
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((e) => {
      const used = e.quota_used || 0, max = e.quota_max || 650;
      const st = getQuotaStatus(used, max);
      if (status !== "tous" && st !== status) return false;
      if (q && !`${e.first_name} ${e.last_name}`.toLowerCase().includes(q)) return false;
      return true;
    }).sort((a, b) => ((b.quota_used || 0) / (b.quota_max || 1)) - ((a.quota_used || 0) / (a.quota_max || 1)));
  }, [students, search, status]);

  const atRisk = students.filter((e) => getQuotaStatus(e.quota_used || 0, e.quota_max || 650) === "danger").length;
  const warning = students.filter((e) => getQuotaStatus(e.quota_used || 0, e.quota_max || 650) === "warning").length;
  const totalUsed = students.reduce((s, e) => s + (e.quota_used || 0), 0);
  const totalMax = students.length * 650;
  const extendedCount = students.filter((e) => e.allow_extended_hours).length;

  return (
    <div className="p-4 md:p-6">
      <div className="mb-5">
        <h1 style={{ fontSize: 18, fontWeight: 500, marginBottom: 2 }}>Quotas étudiants</h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Suivi du plafond légal de 650h par étudiant jobiste.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-5">
        <Kpi label="Étudiants actifs" value={students.length.toString()} />
        <Kpi label="Heures totales" value={`${totalUsed.toLocaleString("fr-BE")}`} sub={`/ ${totalMax.toLocaleString("fr-BE")}h`} />
        <Kpi label="Quota critique" value={atRisk.toString()} color={atRisk > 0 ? "var(--danger-text)" : undefined} sub="(>90%)" />
        <Kpi label="À surveiller" value={warning.toString()} color={warning > 0 ? "var(--warning-text)" : undefined} sub="(>50%)" />
        <Kpi label="Avec heures étendues" value={extendedCount.toString()} color={extendedCount > 0 ? "var(--coral)" : undefined} sub="plafond perso" />
      </div>

      {atRisk > 0 && (
        <div className="rounded-xl px-5 py-3 flex items-center gap-3 mb-5" style={{ backgroundColor: "var(--danger-bg)" }}>
          <AlertTriangle size={16} style={{ color: "var(--danger-text)" }} />
          <span style={{ fontSize: 12, fontWeight: 500, color: "var(--danger-text)" }}>
            {atRisk} étudiant{atRisk > 1 ? "s" : ""} à plus de 90% du quota — risque de dépassement
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="flex items-center gap-2 rounded-md px-2.5 py-1.5" style={{ border: "0.5px solid var(--border)", backgroundColor: "var(--card)" }}>
          <Search size={13} style={{ color: "var(--muted-foreground)" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…" style={{ fontSize: 12, background: "transparent", outline: "none", border: "none", width: 180 }} />
          {search && <X size={12} style={{ cursor: "pointer" }} onClick={() => setSearch("")} />}
        </div>
        {[{ value: "tous", label: "Tous" }, { value: "danger", label: "Critique" }, { value: "warning", label: "Surveiller" }, { value: "safe", label: "OK" }].map((o) => {
          const a = status === o.value;
          return (
            <button key={o.value} onClick={() => setStatus(o.value as StatusFilter)} className="rounded-full px-2.5 py-1"
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
              {["Étudiant", "Postes", "Plafond hebdo", "Heures", "Quota", "Progression", "Statut"].map((h) => (
                <th key={h} className="text-left px-4 py-2.5" style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Aucun étudiant.</td></tr>
            ) : filtered.map((emp) => {
              const used = emp.quota_used || 0, max = emp.quota_max || 650;
              const pct = Math.round((used / max) * 100);
              const st = getQuotaStatus(used, max);
              const barColor = st === "danger" ? "var(--danger-text)" : st === "warning" ? "var(--warning-text)" : "var(--success-text)";
              const statusLabel = st === "danger" ? "Critique" : st === "warning" ? "À surveiller" : "OK";
              const statusBg = st === "danger" ? "var(--danger-bg)" : st === "warning" ? "var(--warning-bg)" : "var(--success-bg)";
              const empRoles = roles.get(emp.id) || [];
              const firstRole = empRoles[0];
              const rc = getRoleStyle(firstRole);
              

              return (
                <tr key={emp.id} style={{ borderBottom: "0.5px solid var(--border)" }}>
                  <td className="px-4 py-3">
                    <Link to="/staff/$id" params={{ id: emp.id }} className="flex items-center gap-2.5 hover:underline">
                      <div className="flex items-center justify-center rounded-full shrink-0" style={{ width: 28, height: 28, backgroundColor: rc.bg, color: rc.text, fontSize: 10, fontWeight: 500 }}>
                        {initials(emp.first_name, emp.last_name)}
                      </div>
                      <span style={{ fontWeight: 500 }}>{fullName(emp)}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {empRoles.length === 0 ? <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>—</span> : empRoles.map((r) => {
                        const c = getRoleStyle(r);
                        return <span key={r} className="rounded-full px-1.5 py-0.5" style={{ fontSize: 10, backgroundColor: c.bg, color: c.text }}>{r}</span>;
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {emp.allow_extended_hours ? (
                      <div className="flex items-center gap-1.5">
                        <span style={{ fontSize: 12, fontWeight: 500 }}>{weeklyCap}h</span>
                        <span className="rounded-full px-1.5 py-0.5" style={{ fontSize: 9, fontWeight: 500, backgroundColor: "var(--coral)", color: "var(--coral-text, #fff)" }}>étendu</span>
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>15h</span>
                    )}
                  </td>
                  <td className="px-4 py-3" style={{ fontWeight: 500 }}>{used}h</td>
                  <td className="px-4 py-3" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{max}h</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div style={{ width: 80, height: 4, borderRadius: 2, backgroundColor: "var(--muted)" }}>
                        <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", borderRadius: 2, backgroundColor: barColor }} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 500, color: barColor }}>{pct}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3"><span className="rounded-full px-2 py-0.5" style={{ fontSize: 10, fontWeight: 500, backgroundColor: statusBg, color: barColor }}>{statusLabel}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl px-5 py-4 flex items-start gap-3 mt-5" style={{ backgroundColor: "var(--info-bg)" }}>
        <Info size={16} style={{ color: "var(--info-text)", marginTop: 1, flexShrink: 0 }} />
        <div style={{ fontSize: 12, color: "var(--info-text)", lineHeight: 1.6 }}>
          <span style={{ fontWeight: 500 }}>Plafond légal belge :</span> Un étudiant jobiste peut prester maximum 650 heures par année civile sous le régime de cotisations sociales réduites.
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
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
