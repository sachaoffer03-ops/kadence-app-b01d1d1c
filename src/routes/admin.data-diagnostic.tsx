import { createFileRoute, Link } from "@tanstack/react-router";
import { DevOnly } from "@/components/DevOnly";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { runDataDiagnostic } from "@/lib/data-diagnostic.functions";

export const Route = createFileRoute("/admin/data-diagnostic")({
  component: () => (<DevOnly label="Le diagnostic de données"><DataDiagnosticPage /></DevOnly>),
  head: () => ({ meta: [{ title: "Diagnostic données — Kadence" }] }),
});

const DAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

function DataDiagnosticPage() {
  const run = useServerFn(runDataDiagnostic);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = async () => {
    setLoading(true); setErr("");
    try { setData(await run()); } catch (e: any) { setErr(e?.message || "Erreur"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  if (loading) return <div className="p-6" style={{ fontSize: 13 }}>Chargement du diagnostic…</div>;
  if (err) return <div className="p-6" style={{ fontSize: 13, color: "var(--danger-text)" }}>{err}</div>;
  if (!data) return null;

  const Card = ({ title, children }: any) => (
    <div className="rounded-xl border p-4 mb-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );

  const tableStyle: React.CSSProperties = { width: "100%", fontSize: 12, borderCollapse: "collapse" };
  const th: React.CSSProperties = { textAlign: "left", padding: "6px 8px", borderBottom: "1px solid var(--border)", fontWeight: 500, color: "var(--muted-foreground)" };
  const td: React.CSSProperties = { padding: "6px 8px", borderBottom: "0.5px solid var(--border)" };

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <Link to="/planning" className="flex items-center gap-1" style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 4 }}>
            <ArrowLeft size={12} /> Retour
          </Link>
          <h1 style={{ fontSize: 22, fontWeight: 500 }}>Diagnostic données</h1>
          <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>Période analysée : {data.period.start} → {data.period.end}</p>
        </div>
        <button onClick={load} className="rounded-md px-3 py-2 flex items-center gap-2"
          style={{ fontSize: 12, fontWeight: 500, border: "0.5px solid var(--border)", backgroundColor: "var(--card)" }}>
          <RefreshCw size={14} /> Rafraîchir
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }} className="mb-4">
        <Card title="Profils">
          <div style={{ fontSize: 13, lineHeight: 1.8 }}>
            <div>Total : <strong>{data.counts.total_profiles}</strong></div>
            <div>Actifs : <strong>{data.counts.active_profiles}</strong></div>
            <div>Avec ligne user_contracts : <strong>{data.counts.active_with_contract_row}</strong></div>
            <div>Avec rôle métier : <strong>{data.counts.active_with_business_role}</strong></div>
            <div>Avec studio assigné : <strong>{data.counts.active_with_studio}</strong></div>
            <div>Rôle "Cuisine" (actifs) : <strong>{data.cuisine_role_count}</strong></div>
          </div>
        </Card>

        <Card title="Profils actifs par contrat principal">
          <table style={tableStyle}>
            <tbody>
              {Object.entries(data.by_contract).map(([k, v]: any) => (
                <tr key={k}><td style={td}>{k}</td><td style={{ ...td, textAlign: "right", fontWeight: 500 }}>{v}</td></tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <Card title="Capacité par studio (semaine)">
        <table style={tableStyle}>
          <thead><tr><th style={th}>Studio</th><th style={{ ...th, textAlign: "right" }}>Heures demandées</th><th style={{ ...th, textAlign: "right" }}>Heures dispo (max contractuels)</th><th style={{ ...th, textAlign: "right" }}>Ratio</th></tr></thead>
          <tbody>
            {data.studio_capacity.map((s: any) => {
              const danger = s.ratio !== null && s.ratio > 90;
              return (
                <tr key={s.studio}>
                  <td style={td}>{s.studio}</td>
                  <td style={{ ...td, textAlign: "right" }}>{s.demanded_hours} h</td>
                  <td style={{ ...td, textAlign: "right" }}>{s.available_hours} h</td>
                  <td style={{ ...td, textAlign: "right", color: danger ? "var(--danger-text)" : s.ratio === null ? "var(--muted-foreground)" : "var(--foreground)", fontWeight: 500 }}>
                    {s.ratio === null ? "—" : `${s.ratio}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card title="Staffing templates par studio × jour">
        <table style={tableStyle}>
          <thead><tr><th style={th}>Studio</th><th style={th}>Jour</th><th style={{ ...th, textAlign: "right" }}>Slots requis</th></tr></thead>
          <tbody>
            {data.templates_by_studio_day.map((r: any, i: number) => (
              <tr key={i}><td style={td}>{r.studio}</td><td style={td}>{DAYS[r.day]}</td><td style={{ ...td, textAlign: "right" }}>{r.count}</td></tr>
            ))}
            {data.templates_by_studio_day.length === 0 && <tr><td colSpan={3} style={{ ...td, color: "var(--muted-foreground)" }}>Aucun template</td></tr>}
          </tbody>
        </table>
      </Card>

      <Card title={`Employés sans aucune dispo sur la période (${data.employees_without_dispo.length})`}>
        {data.employees_without_dispo.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--success-text)" }}>Tout le monde a au moins une dispo ✓</div>
        ) : (
          <div style={{ maxHeight: 240, overflowY: "auto" }}>
            {data.employees_without_dispo.map((e: any) => (
              <div key={e.user_id} style={{ fontSize: 12, padding: "4px 0", borderBottom: "0.5px solid var(--border)" }}>{e.name}</div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Dispos par employé (mois prochain)">
        <div style={{ maxHeight: 360, overflowY: "auto" }}>
          <table style={tableStyle}>
            <thead><tr><th style={th}>Employé</th><th style={{ ...th, textAlign: "right" }}>Lignes de dispo</th></tr></thead>
            <tbody>
              {data.dispo_per_employee.map((e: any) => (
                <tr key={e.user_id}>
                  <td style={td}>{e.name}</td>
                  <td style={{ ...td, textAlign: "right", color: e.dispo_count === 0 ? "var(--danger-text)" : "var(--foreground)", fontWeight: 500 }}>{e.dispo_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="ai_planning_settings (toutes colonnes)">
        <table style={tableStyle}>
          <tbody>
            {Object.entries(data.ai_settings).map(([k, v]: any) => (
              <tr key={k}>
                <td style={{ ...td, color: "var(--muted-foreground)" }}>{k}</td>
                <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{v === null ? "null" : String(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
