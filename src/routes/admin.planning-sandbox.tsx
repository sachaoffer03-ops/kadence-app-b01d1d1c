import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, FlaskConical, Loader2, AlertCircle, Check } from "lucide-react";
import { toast } from "sonner";
import { generatePlanning } from "@/lib/generate-planning.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/planning-sandbox")({
  component: SandboxPage,
  head: () => ({ meta: [{ title: "Simulation planning — Kadence" }] }),
});

const MONTHS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

interface StudioRow { id: string; name: string; }
interface EmpRow { id: string; first_name: string; last_name: string; }
interface Hole { studio_name: string; date: string; start_time: string; end_time: string; business_role: string; reason: string; }
interface Alert { severity: "info"|"warning"|"error"; user_name?: string; message: string; }
interface SimResult {
  planning_run_id: string | null;
  silent: boolean;
  status: "success"|"partial"|"failed";
  coverage_rate: number;
  shifts_generated: number;
  total_slots_needed: number;
  total_slots_covered: number;
  duration_ms: number;
  holes: Hole[];
  alerts: Alert[];
  solver_logs?: any;
}

function SandboxPage() {
  const generate = useServerFn(generatePlanning);
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [studios, setStudios] = useState<StudioRow[]>([]);
  const [studioId, setStudioId] = useState<string>("");
  const [employees, setEmployees] = useState<EmpRow[]>([]);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SimResult | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    (async () => {
      const [{ data: st }, { data: pr }] = await Promise.all([
        supabase.from("studios").select("id, name").order("name"),
        supabase.from("profiles").select("id, first_name, last_name").eq("status", "active").order("first_name"),
      ]);
      setStudios((st ?? []) as StudioRow[]);
      setEmployees((pr ?? []) as EmpRow[]);
      const rhode = (st ?? []).find((s: any) => /rhode/i.test(s.name));
      if (rhode) setStudioId(rhode.id);
      else if (st?.[0]) setStudioId(st[0].id);
    })();
  }, []);

  const toggle = (id: string) =>
    setExcluded((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });

  const monthStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;

  const run = async () => {
    setRunning(true);
    setError("");
    setResult(null);
    try {
      const res: any = await generate({
        data: {
          month_start_date: monthStart,
          studio_ids: studioId ? [studioId] : undefined,
          preserve_manual: false,
          preserve_locked: false,
          dry_run: true,
          silent: true,
          exclude_user_ids: Array.from(excluded),
        },
      });
      setResult(res as SimResult);
      toast.success(`Simulation OK — ${res.shifts_generated} shifts, ${Math.round(res.coverage_rate * 100)}% de couverture`);
    } catch (e: any) {
      setError(e?.message ?? "Erreur");
      toast.error(e?.message ?? "Erreur");
    } finally {
      setRunning(false);
    }
  };

  const holesByRole = useMemo(() => {
    if (!result) return [];
    const m = new Map<string, number>();
    for (const h of result.holes) m.set(h.business_role, (m.get(h.business_role) ?? 0) + 1);
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [result]);

  return (
    <div className="p-4 md:p-6" style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div className="flex items-center gap-3 mb-6">
        <Link to="/planning" className="flex items-center gap-1" style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
          <ArrowLeft size={14} /> Retour
        </Link>
      </div>

      <div className="flex items-center gap-3 mb-2">
        <FlaskConical size={22} style={{ color: "var(--coral, #F0997B)" }} />
        <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>Simulation planning</h1>
      </div>
      <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginBottom: 24, maxWidth: 640 }}>
        Lance une génération en mémoire uniquement. Rien n'est écrit dans l'app, rien n'apparaît dans l'historique,
        aucun employé ne voit quoi que ce soit. Idéal pour tester l'impact d'un employé absent ou d'un changement d'équipe.
      </p>

      <div className="grid gap-6" style={{ gridTemplateColumns: "minmax(0,320px) minmax(0,1fr)" }}>
        {/* Config */}
        <div className="space-y-4">
          <Card title="Studio">
            <select
              value={studioId}
              onChange={(e) => setStudioId(e.target.value)}
              style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--background)", fontSize: 13 }}
            >
              {studios.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Card>

          <Card title="Mois">
            <div className="flex gap-2">
              <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
                style={{ flex: 1, padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--background)", fontSize: 13 }}>
                {MONTHS_FR.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
              <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))}
                style={{ width: 90, padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--background)", fontSize: 13 }} />
            </div>
          </Card>

          <Card title={`Employés à ignorer (${excluded.size})`} subtitle="Comme s'ils n'existaient pas.">
            <div style={{ maxHeight: 320, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 6 }}>
              {employees.map((e) => {
                const on = excluded.has(e.id);
                return (
                  <label key={e.id} className="flex items-center gap-2 px-2 py-1.5 cursor-pointer"
                    style={{ fontSize: 13, borderBottom: "1px solid var(--border)", background: on ? "color-mix(in oklab, var(--coral, #F0997B) 8%, transparent)" : "transparent" }}>
                    <input type="checkbox" checked={on} onChange={() => toggle(e.id)} />
                    <span>{e.first_name} {e.last_name}</span>
                  </label>
                );
              })}
            </div>
          </Card>

          <button
            onClick={run}
            disabled={running || !studioId}
            style={{
              width: "100%", padding: "10px 14px", borderRadius: 8,
              background: "var(--coral, #F0997B)", color: "white", border: "none",
              fontSize: 14, fontWeight: 500, cursor: running ? "wait" : "pointer",
              opacity: running || !studioId ? 0.6 : 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            {running ? <><Loader2 size={16} className="animate-spin" /> Simulation…</> : <>Lancer la simulation</>}
          </button>
        </div>

        {/* Result */}
        <div>
          {error && (
            <div className="p-3 rounded flex gap-2 mb-4" style={{ background: "color-mix(in oklab, #dc2626 10%, transparent)", fontSize: 13 }}>
              <AlertCircle size={16} style={{ color: "#dc2626" }} /> {error}
            </div>
          )}
          {!result && !error && !running && (
            <div className="rounded-xl border p-8 text-center" style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--muted-foreground)", fontSize: 13 }}>
              Configure à gauche puis lance la simulation. Le résultat s'affichera ici sans rien enregistrer.
            </div>
          )}
          {result && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Couverture" value={`${Math.round(result.coverage_rate * 100)}%`} tone={result.coverage_rate >= 0.95 ? "good" : result.coverage_rate >= 0.5 ? "warn" : "bad"} />
                <Stat label="Shifts générés" value={result.shifts_generated.toString()} />
                <Stat label="Trous" value={result.holes.length.toString()} tone={result.holes.length === 0 ? "good" : result.holes.length < 5 ? "warn" : "bad"} />
              </div>

              <Card title="Statut" >
                <div className="flex items-center gap-2" style={{ fontSize: 13 }}>
                  <Check size={14} style={{ color: result.status === "success" ? "#16a34a" : result.status === "partial" ? "#d97706" : "#dc2626" }} />
                  <span>
                    {result.status === "success" ? "Succès" : result.status === "partial" ? "Partiel" : "Échec"} — {result.total_slots_covered}/{result.total_slots_needed} créneaux couverts en {Math.round(result.duration_ms / 100) / 10}s
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 6 }}>
                  Aucune trace enregistrée. Fermer la page = tout disparaît.
                </div>
              </Card>

              {holesByRole.length > 0 && (
                <Card title="Trous par rôle">
                  <div className="space-y-1">
                    {holesByRole.map(([role, n]) => (
                      <div key={role} className="flex justify-between" style={{ fontSize: 13 }}>
                        <span>{role}</span>
                        <span style={{ color: "var(--muted-foreground)" }}>{n} créneau{n > 1 ? "x" : ""}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {result.holes.length > 0 && (
                <Card title={`Détail des trous (${result.holes.length})`}>
                  <div style={{ maxHeight: 320, overflowY: "auto", fontSize: 12 }}>
                    {result.holes.slice(0, 100).map((h, i) => (
                      <div key={i} className="py-1.5" style={{ borderBottom: "1px solid var(--border)" }}>
                        <div style={{ fontWeight: 500 }}>{h.date} · {h.start_time}–{h.end_time} · {h.business_role}</div>
                        <div style={{ color: "var(--muted-foreground)" }}>{h.reason}</div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {result.alerts && result.alerts.length > 0 && (
                <Card title={`Alertes (${result.alerts.length})`}>
                  <div style={{ maxHeight: 260, overflowY: "auto" }}>
                    {result.alerts.map((a, i) => (
                      <div key={i} className="py-1.5" style={{ fontSize: 12, borderBottom: "1px solid var(--border)" }}>
                        <span style={{
                          fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em",
                          color: a.severity === "error" ? "#dc2626" : a.severity === "warning" ? "#d97706" : "#64748b",
                          marginRight: 6,
                        }}>{a.severity}</span>
                        {a.user_name && <span style={{ fontWeight: 500 }}>{a.user_name} · </span>}
                        {a.message}
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: subtitle ? 2 : 10 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 10 }}>{subtitle}</div>}
      {children}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good"|"warn"|"bad" }) {
  const color = tone === "good" ? "#16a34a" : tone === "warn" ? "#d97706" : tone === "bad" ? "#dc2626" : "var(--foreground)";
  return (
    <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
      <div style={{ fontSize: 11, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 500, color }}>{value}</div>
    </div>
  );
}
