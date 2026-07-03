import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { DevOnly } from "@/components/DevOnly";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, RefreshCw, Loader2, CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { runDataDiagnostic } from "@/lib/data-diagnostic.functions";
import { collectIntegrityStats } from "@/lib/integrity-report.functions";
import { getSystemHealthChecks, triggerAvailRemindersTick, getRecentEmailLogs } from "@/lib/system-health.functions";
import { diagnoseLastPlanningRun } from "@/lib/planning-diagnose.functions";
import { sendTestEmail } from "@/lib/email-test.functions";

export const Route = createFileRoute("/admin/diagnostic")({
  component: () => (
    <DevOnly label="Le diagnostic système">
      <DiagnosticPage />
    </DevOnly>
  ),
  head: () => ({ meta: [{ title: "Diagnostic — Kadence" }] }),
});

const DAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

function DiagnosticPage() {
  const sysFn = useServerFn(getSystemHealthChecks);
  const integFn = useServerFn(collectIntegrityStats);
  const dataFn = useServerFn(runDataDiagnostic);

  const [sys, setSys] = useState<any>(null);
  const [integ, setInteg] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errs, setErrs] = useState<Record<string, string>>({});

  const loadAll = useCallback(async () => {
    setLoading(true);
    setErrs({});
    const safe = async <T,>(key: string, p: Promise<T>): Promise<T | null> => {
      try { return await p; } catch (e: any) {
        setErrs((s) => ({ ...s, [key]: e?.message || "Erreur" }));
        return null;
      }
    };
    const [s, i, d] = await Promise.all([
      safe("sys", sysFn()),
      safe("integ", integFn()),
      safe("data", dataFn()),
    ]);
    setSys(s); setInteg(i); setData(d);
    setLoading(false);
  }, [sysFn, integFn, dataFn]);

  useEffect(() => { loadAll(); }, []);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto" style={{ fontSize: 13 }}>
      <Link to="/" className="flex items-center gap-1 mb-3" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
        <ArrowLeft size={12} /> Retour
      </Link>
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 500 }}>🩺 Diagnostic système</h1>
          <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 4 }}>
            Vue globale de la santé technique du SaaS
          </p>
        </div>
        <button onClick={loadAll} disabled={loading}
          className="rounded-md px-3 py-2 flex items-center gap-2 hover:opacity-90 disabled:opacity-50"
          style={{ fontSize: 12, fontWeight: 500, border: "0.5px solid var(--border)", backgroundColor: "var(--card)" }}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Tout recharger
        </button>
      </div>

      <EmailTestBox />

      <Tabs defaultValue="systeme" className="w-full">

        <TabsList className="mb-4">
          <TabsTrigger value="systeme">🔧 Système</TabsTrigger>
          <TabsTrigger value="donnees">📊 Données</TabsTrigger>
        </TabsList>

        <TabsContent value="systeme">
          <SystemTab sys={sys} integ={integ} loading={loading} err={errs.sys || errs.integ} />
        </TabsContent>
        <TabsContent value="donnees">
          <DataTab data={data} loading={loading} err={errs.data} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ============== TAB 1 — SYSTÈME ============== */
function SystemTab({ sys, integ, loading, err }: any) {
  if (loading && !sys) return <Loading />;
  if (err && !sys) return <ErrBox msg={err} />;

  return (
    <div>
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        {/* Cron jobs */}
        <Card title="⏰ Cron jobs">
          {!sys?.crons ? <Empty>—</Empty> :
            sys.crons.error ? <ErrInline>{sys.crons.error}</ErrInline> :
            !Array.isArray(sys.crons) || sys.crons.length === 0 ? <Empty>Aucun cron job programmé</Empty> : (
              <div className="space-y-2">
                {sys.crons.map((c: any) => (
                  <div key={c.jobid} className="flex items-start justify-between gap-2 pb-2" style={{ borderBottom: "0.5px solid var(--border)" }}>
                    <div className="min-w-0 flex-1">
                      <div style={{ fontSize: 12, fontWeight: 500 }}>{c.jobname || `job ${c.jobid}`}</div>
                      <div style={{ fontSize: 11, color: "var(--muted-foreground)", fontFamily: "monospace" }}>{c.schedule}</div>
                      <div style={{ fontSize: 10, color: "var(--muted-foreground)", fontFamily: "monospace", marginTop: 2, wordBreak: "break-all" }}>
                        {String(c.command).slice(0, 100)}{String(c.command).length > 100 ? "…" : ""}
                      </div>
                    </div>
                    {c.active ? <BadgeOk label="actif" /> : <BadgeKo label="inactif" />}
                  </div>
                ))}
              </div>
            )}
        </Card>

        <AvailRemindersCard crons={sys?.crons} />

        <RecentEmailLogsCard />

        {/* Realtime */}
        <Card title="📡 Tables realtime">
          {!sys?.realtime ? <Empty>—</Empty> :
            !Array.isArray(sys.realtime) || sys.realtime.length === 0 ? <Empty>Aucune table publiée</Empty> : (
              <div className="flex flex-wrap gap-1.5">
                {sys.realtime.map((t: any, i: number) => (
                  <span key={i} className="rounded px-2 py-0.5" style={{ fontSize: 11, backgroundColor: "var(--muted)", color: "var(--foreground)" }}>
                    {t.schemaname}.{t.tablename}
                  </span>
                ))}
              </div>
            )}
        </Card>

        {/* Intégrité — fonctions SQL + admins + dernière gen */}
        <Card title="🧬 Intégrité SQL">
          {!integ ? <Empty>—</Empty> : (
            <div style={{ fontSize: 12, lineHeight: 1.8 }}>
              <div className="flex items-center gap-2">
                {integ.scoreFnOk ? <CheckCircle2 size={14} style={{ color: "#16a34a" }} /> : <XCircle size={14} style={{ color: "#b91c1c" }} />}
                <span>calculate_profile_score</span>
              </div>
              <KV k="Admins" v={integ.adminCount} />
              <KV k="Settings IA" v={integ.settingsPresent ? "présents" : "absents"} />
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 4 }}>Fonctions attendues</div>
                <div className="flex flex-wrap gap-1">
                  {integ.expectedFunctions.map((f: string) => (
                    <span key={f} className="rounded px-1.5 py-0.5" style={{ fontSize: 10, backgroundColor: "var(--muted)", fontFamily: "monospace" }}>{f}</span>
                  ))}
                </div>
              </div>
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 4 }}>Triggers attendus</div>
                <div className="flex flex-wrap gap-1">
                  {integ.expectedTriggers.map((t: any) => (
                    <span key={t.name} className="rounded px-1.5 py-0.5" style={{ fontSize: 10, backgroundColor: "var(--muted)", fontFamily: "monospace" }}>{t.name}</span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Card>

        <LastPlanningRunCard run={integ?.lastRun} />
        <FailedRunDiagnosisCard />
      </div>

      {integ?.tableCounts && (
        <Card title="📦 Compte par table" className="mt-4">
          <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
            {Object.entries(integ.tableCounts).map(([t, c]: any) => (
              <div key={t} className="flex items-center justify-between" style={{ fontSize: 11, padding: "3px 6px", borderBottom: "0.5px solid var(--border)" }}>
                <span style={{ fontFamily: "monospace", color: "var(--muted-foreground)" }}>{t}</span>
                <span style={{ fontWeight: 500, color: typeof c === "string" ? "#b91c1c" : "var(--foreground)" }}>{String(c)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ============== TAB 2 — DONNÉES ============== */
function DataTab({ data, loading, err }: any) {
  if (loading && !data) return <Loading />;
  if (err && !data) return <ErrBox msg={err} />;
  if (!data) return <Empty>Aucune donnée</Empty>;

  return (
    <div>
      <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 12 }}>
        Période analysée : {data.period.start} → {data.period.end}
      </div>
      <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        <Card title="Profils">
          <div style={{ fontSize: 13, lineHeight: 1.8 }}>
            <KV k="Total" v={data.counts.total_profiles} />
            <KV k="Actifs" v={data.counts.active_profiles} />
            <KV k="Avec contrat" v={data.counts.active_with_contract_row} />
            <KV k="Avec rôle métier" v={data.counts.active_with_business_role} />
            <KV k="Avec studio" v={data.counts.active_with_studio} />
            <KV k="Rôle Cuisine" v={data.cuisine_role_count} />
          </div>
        </Card>
        <Card title="Par contrat principal">
          <SimpleTable rows={Object.entries(data.by_contract).map(([k, v]: any) => [k, v])} />
        </Card>
      </div>

      <Card title="Capacité par studio (semaine)" className="mb-4">
        <Table headers={["Studio", "Demandé", "Dispo", "Ratio"]}
          rows={data.studio_capacity.map((s: any) => [
            s.studio, `${s.demanded_hours}h`, `${s.available_hours}h`,
            <span style={{ color: s.ratio != null && s.ratio > 90 ? "#b91c1c" : "var(--foreground)", fontWeight: 500 }}>
              {s.ratio === null ? "—" : `${s.ratio}%`}
            </span>,
          ])} />
      </Card>

      <Card title="Staffing templates par studio × jour" className="mb-4">
        {data.templates_by_studio_day.length === 0 ? <Empty>Aucun template</Empty> :
          <Table headers={["Studio", "Jour", "Slots"]}
            rows={data.templates_by_studio_day.map((r: any) => [r.studio, DAYS[r.day], r.count])} />}
      </Card>

      <Card title={`Employés sans aucune dispo (${data.employees_without_dispo.length})`} className="mb-4">
        {data.employees_without_dispo.length === 0
          ? <div style={{ fontSize: 12, color: "#16a34a" }}>✓ Tout le monde a au moins une dispo</div>
          : <div style={{ maxHeight: 240, overflowY: "auto" }}>
              {data.employees_without_dispo.map((e: any) => (
                <div key={e.user_id} style={{ fontSize: 12, padding: "4px 0", borderBottom: "0.5px solid var(--border)" }}>{e.name}</div>
              ))}
            </div>}
      </Card>

      <Card title="Dispos par employé">
        <div style={{ maxHeight: 360, overflowY: "auto" }}>
          <Table headers={["Employé", "Lignes"]}
            rows={data.dispo_per_employee.map((e: any) => [
              e.name,
              <span style={{ color: e.dispo_count === 0 ? "#b91c1c" : "var(--foreground)", fontWeight: 500 }}>{e.dispo_count}</span>,
            ])} />
        </div>
      </Card>
    </div>
  );
}

/* ============== Helpers ============== */
function Card({ title, children, className = "" }: any) {
  return (
    <div className={`rounded-xl border p-4 ${className}`} style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  );
}
function KV({ k, v, muted }: any) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span style={{ color: "var(--muted-foreground)", fontSize: 11 }}>{k}</span>
      <span style={{ fontWeight: muted ? 400 : 500, color: muted ? "var(--muted-foreground)" : "var(--foreground)", fontFamily: "monospace", fontSize: 11 }}>{String(v)}</span>
    </div>
  );
}
function Empty({ children }: any) { return <div style={{ color: "var(--muted-foreground)", fontSize: 12 }}>{children}</div>; }
function ErrInline({ children }: any) { return <div style={{ fontSize: 11, color: "#b91c1c", fontFamily: "monospace" }}>{children}</div>; }
function ErrBox({ msg }: { msg: string }) { return <div className="rounded border p-4" style={{ borderColor: "#fecaca", backgroundColor: "#fef2f2", color: "#b91c1c", fontSize: 12 }}><AlertTriangle size={14} className="inline mr-2" />{msg}</div>; }
function Loading() { return <div className="p-6 flex items-center gap-2" style={{ color: "var(--muted-foreground)" }}><Loader2 size={14} className="animate-spin" /> Chargement…</div>; }
function BadgeOk({ label }: { label: string }) { return <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5" style={{ fontSize: 10, color: "#15803d", backgroundColor: "#dcfce7" }}><CheckCircle2 size={10} /> {label}</span>; }
function BadgeKo({ label }: { label: string }) { return <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5" style={{ fontSize: 10, color: "#b91c1c", backgroundColor: "#fee2e2" }}><XCircle size={10} /> {label}</span>; }
function StatusDot({ status }: { status: string }) {
  const color = status === "ok" ? "#16a34a" : status === "partial" ? "#F0997B" : "#b91c1c";
  return <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 999, backgroundColor: color, marginTop: 5, flexShrink: 0 }} />;
}
function Table({ headers, rows }: { headers: string[]; rows: any[][] }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
        <thead><tr>{headers.map((h, i) => <th key={i} style={{ textAlign: "left", padding: "6px 8px", borderBottom: "0.5px solid var(--border)", fontWeight: 500, color: "var(--muted-foreground)", fontSize: 11 }}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} style={{ padding: "6px 8px", borderBottom: "0.5px solid var(--border)" }}>{c as any}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
function SimpleTable({ rows }: { rows: any[][] }) {
  return (
    <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
      <tbody>{rows.map((r, i) => (
        <tr key={i}>
          <td style={{ padding: "4px 6px", borderBottom: "0.5px solid var(--border)" }}>{r[0]}</td>
          <td style={{ padding: "4px 6px", borderBottom: "0.5px solid var(--border)", textAlign: "right", fontWeight: 500 }}>{r[1]}</td>
        </tr>
      ))}</tbody>
    </table>
  );
}

/* ============== Cards spécifiques rappels dispos ============== */
function AvailRemindersCard({ crons }: { crons: any }) {
  const triggerFn = useServerFn(triggerAvailRemindersTick);
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<any>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("diag_avail_reminders_last");
      if (raw) setLastRun(JSON.parse(raw));
    } catch {}
  }, []);

  const cron = Array.isArray(crons)
    ? crons.find((c: any) => c.jobname === "process-avail-reminders")
    : null;

  const handleTrigger = async () => {
    setRunning(true);
    try {
      const r = await triggerFn();
      setLastRun(r);
      try { localStorage.setItem("diag_avail_reminders_last", JSON.stringify(r)); } catch {}
    } catch (e: any) {
      const r = { ok: false, error: e?.message || "erreur", ranAt: new Date().toISOString() };
      setLastRun(r);
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card title="🚦 Rappels dispos (route + cron)">
      <div style={{ fontSize: 12, lineHeight: 1.7 }}>
        <div className="flex items-center gap-2 mb-2">
          {cron
            ? (cron.active ? <BadgeOk label={`cron actif (${cron.schedule})`} /> : <BadgeKo label="cron inactif" />)
            : <BadgeKo label="cron absent" />}
        </div>
        <div style={{ fontSize: 11, color: "var(--muted-foreground)", fontFamily: "monospace", wordBreak: "break-all" }}>
          POST /api/public/avail-reminders-tick
        </div>
        <button
          onClick={handleTrigger}
          disabled={running}
          className="mt-3 rounded-md px-3 py-2 flex items-center gap-2 hover:opacity-90 disabled:opacity-50"
          style={{ fontSize: 12, fontWeight: 500, border: "0.5px solid var(--border)", backgroundColor: "var(--card)" }}
        >
          {running ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          Déclencher maintenant
        </button>
        {lastRun && (
          <div className="mt-3 rounded p-2" style={{ backgroundColor: "var(--muted)", fontSize: 11 }}>
            <div className="flex items-center gap-2 mb-1">
              {lastRun.ok ? <BadgeOk label={`HTTP ${lastRun.status}`} /> : <BadgeKo label={`HTTP ${lastRun.status ?? "—"}`} />}
              <span style={{ color: "var(--muted-foreground)" }}>{new Date(lastRun.ranAt).toLocaleString("fr-FR")}</span>
            </div>
            <pre style={{ fontSize: 10, fontFamily: "monospace", whiteSpace: "pre-wrap", wordBreak: "break-all", margin: 0 }}>
              {JSON.stringify(lastRun.result ?? lastRun.error, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </Card>
  );
}

function RecentEmailLogsCard() {
  const fn = useServerFn(getRecentEmailLogs);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r: any = await fn();
      if (r.error) setErr(r.error);
      else { setErr(null); setLogs(r.logs || []); }
    } catch (e: any) {
      setErr(e?.message || "Erreur");
    } finally {
      setLoading(false);
    }
  }, [fn]);

  useEffect(() => { load(); }, [load]);

  const statusColor = (s: string) => {
    if (s === "sent" || s === "delivered") return { color: "#15803d", bg: "#dcfce7" };
    if (s === "failed" || s === "bounced" || s === "dlq" || s === "complained") return { color: "#b91c1c", bg: "#fee2e2" };
    if (s === "suppressed") return { color: "#92400e", bg: "#fef3c7" };
    return { color: "var(--muted-foreground)", bg: "var(--muted)" };
  };

  return (
    <Card title="📨 Logs envoi emails (10 derniers)">
      <div className="flex items-center justify-between mb-2">
        <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{logs.length} entrées</span>
        <button onClick={load} disabled={loading} className="rounded px-2 py-1 flex items-center gap-1" style={{ fontSize: 11, border: "0.5px solid var(--border)" }}>
          {loading ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />} Recharger
        </button>
      </div>
      {err ? <ErrInline>{err}</ErrInline> :
        logs.length === 0 ? <Empty>Aucun email récent</Empty> : (
          <div className="space-y-1.5" style={{ maxHeight: 320, overflowY: "auto" }}>
            {logs.map((l, i) => {
              const c = statusColor(l.status);
              return (
                <div key={i} className="pb-1.5" style={{ borderBottom: "0.5px solid var(--border)", fontSize: 11 }}>
                  <div className="flex items-center justify-between gap-2">
                    <span style={{ fontFamily: "monospace" }}>{l.template_name || "—"}</span>
                    <span className="rounded px-1.5 py-0.5" style={{ fontSize: 10, color: c.color, backgroundColor: c.bg }}>{l.status}</span>
                  </div>
                  <div style={{ color: "var(--muted-foreground)" }}>{l.recipient_email}</div>
                  <div style={{ color: "var(--muted-foreground)", fontSize: 10 }}>{new Date(l.created_at).toLocaleString("fr-FR")}</div>
                  {l.error_message && (
                    <div style={{ fontSize: 10, color: "#b91c1c", fontFamily: "monospace", marginTop: 2 }}>{l.error_message}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
    </Card>
  );
}

/* ============== Cards dernière génération + diagnostic ============== */
function statusBadge(status: string) {
  const s = (status || "").toLowerCase();
  if (s === "success" || s === "completed") return <BadgeOk label={status} />;
  if (s === "partial") return <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5" style={{ fontSize: 10, color: "#92400e", backgroundColor: "#fef3c7" }}>{status}</span>;
  if (s === "failed" || s === "error") return <BadgeKo label={status} />;
  return <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5" style={{ fontSize: 10, color: "var(--muted-foreground)", backgroundColor: "var(--muted)" }}>{status}</span>;
}

function LastPlanningRunCard({ run }: { run: any }) {
  const navigate = useNavigate();
  const [showLogs, setShowLogs] = useState(false);

  return (
    <Card title="🚀 Dernière génération planning">
      {!run ? <Empty>Aucune génération</Empty> : (
        <div style={{ fontSize: 12, lineHeight: 1.8 }}>
          <div className="flex items-center justify-between gap-2">
            <span style={{ color: "var(--muted-foreground)", fontSize: 11 }}>Statut</span>
            {statusBadge(run.status)}
          </div>
          <KV k="Démarrée" v={run.started_at ? new Date(run.started_at).toLocaleString("fr-FR") : "—"} />
          <KV k="Terminée" v={run.completed_at ? new Date(run.completed_at).toLocaleString("fr-FR") : "n/a"} />
          <KV k="Couverture" v={run.coverage_rate != null ? `${Math.round(run.coverage_rate * 100)}%` : "—"} />
          <KV k="Shifts" v={run.shifts_generated ?? "—"} />

          {run.error_message && (
            <div className="mt-3 rounded p-2" style={{ backgroundColor: "#fef2f2", border: "0.5px solid #fecaca" }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: "#b91c1c", marginBottom: 4 }}>🔴 Erreur</div>
              <pre style={{ fontSize: 10, fontFamily: "monospace", whiteSpace: "pre-wrap", wordBreak: "break-all", margin: 0, color: "#b91c1c" }}>
                {run.error_message}
              </pre>
            </div>
          )}

          {run.solver_logs && (
            <div className="mt-3">
              <button
                onClick={() => setShowLogs((v) => !v)}
                className="flex items-center gap-1 rounded px-2 py-1"
                style={{ fontSize: 11, border: "0.5px solid var(--border)", backgroundColor: "var(--card)" }}
              >
                {showLogs ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                {showLogs ? "Masquer les logs" : "Voir les logs solver"}
              </button>
              {showLogs && (
                <pre style={{ fontSize: 10, fontFamily: "monospace", whiteSpace: "pre-wrap", wordBreak: "break-all", marginTop: 8, padding: 8, backgroundColor: "var(--muted)", borderRadius: 6, maxHeight: 360, overflowY: "auto" }}>
                  {JSON.stringify(run.solver_logs, null, 2)}
                </pre>
              )}
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => navigate({ to: "/planning/generate" })}
              className="rounded-md px-3 py-2 hover:opacity-90"
              style={{ fontSize: 11, fontWeight: 500, border: "0.5px solid var(--border)", backgroundColor: "var(--card)" }}
            >
              🚀 Nouvelle génération
            </button>
            <button
              onClick={() => navigate({ to: "/planning" })}
              className="rounded-md px-3 py-2 hover:opacity-90"
              style={{ fontSize: 11, fontWeight: 500, border: "0.5px solid var(--border)", backgroundColor: "var(--card)" }}
            >
              📜 Voir l'historique
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

function FailedRunDiagnosisCard() {
  const fn = useServerFn(diagnoseLastPlanningRun);
  const [state, setState] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r: any = await fn();
      setState(r); setErr(null);
    } catch (e: any) {
      setErr(e?.message || "Erreur");
    } finally {
      setLoading(false);
    }
  }, [fn]);

  useEffect(() => { load(); }, [load]);

  return (
    <Card title="🔍 Diagnostic du dernier échec">
      {loading ? <Empty>Analyse…</Empty> :
        err ? <ErrInline>{err}</ErrInline> :
        !state?.hasFailed ? <div style={{ fontSize: 12, color: "#16a34a" }}>✓ Aucun run failed récent</div> : (
          <div style={{ fontSize: 12, lineHeight: 1.7 }}>
            <KV k="Run" v={state.run.id?.slice(0, 8)} />
            <KV k="Date" v={new Date(state.run.started_at).toLocaleString("fr-FR")} />
            <div className="mt-2 rounded p-2" style={{ backgroundColor: "var(--muted)" }}>
              <div style={{ fontSize: 11, fontWeight: 500, marginBottom: 4 }}>Hypothèse</div>
              <div style={{ fontSize: 12, color: "var(--foreground)" }}>{state.hypothesis}</div>
              <div style={{ fontSize: 11, fontWeight: 500, marginTop: 8, marginBottom: 4 }}>Action recommandée</div>
              <div style={{ fontSize: 12, color: "var(--foreground)" }}>{state.action}</div>
            </div>
          </div>
        )}
    </Card>
  );
}
