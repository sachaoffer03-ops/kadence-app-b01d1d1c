import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Beaker, Check, X, Loader2, Play, Trash2, Sparkles, RotateCw, Download, ChevronRight, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  prepareTestDataset, cleanupTestDataset, resetTestDataset, cleanTomShift,
  runQATest, runAllQATests, listTests, type TestResult,
} from "@/lib/qa-test-suite.functions";

const LS_KEY = "kadence_qa_last_run";

export const Route = createFileRoute("/admin/qa-test-suite")({
  component: AdminGate,
  head: () => ({ meta: [{ title: "QA Test Suite — Kadence" }] }),
});

type Status = "idle" | "running" | "done" | "error";
type RunState = { status: Status; result?: TestResult; error?: string };

function AdminGate() {
  const { appRole, loading } = useAuth();
  if (loading) return <div className="p-8 text-sm" style={{ color: "var(--muted-foreground)" }}>Chargement…</div>;
  if (appRole !== "admin") {
    return (
      <div className="p-8 max-w-xl mx-auto">
        <div className="rounded-xl border p-6" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
          <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>Accès réservé</div>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.6 }}>
            Cette page est réservée aux administrateurs.
          </p>
          <Link to="/dashboard" className="inline-block mt-5" style={{ fontSize: 12, color: "var(--primary)" }}>← Retour au tableau de bord</Link>
        </div>
      </div>
    );
  }
  return <QAPage />;
}

export function QAPage() {
  const prepare = useServerFn(prepareTestDataset);
  const cleanup = useServerFn(cleanupTestDataset);
  const reset = useServerFn(resetTestDataset);
  const cleanTom = useServerFn(cleanTomShift);
  const list = useServerFn(listTests);
  const runOne = useServerFn(runQATest);
  const runAll = useServerFn(runAllQATests);

  const [setupState, setSetupState] = useState<Status>("idle");
  const [setupInfo, setSetupInfo] = useState<any>(null);
  const [setupErr, setSetupErr] = useState<string>("");

  const [tests, setTests] = useState<Array<{ id: number; name: string; description: string }>>([]);
  const [runs, setRuns] = useState<Record<number, RunState>>({});
  const [allRunningId, setAllRunningId] = useState<number | null>(null);
  const [lastRunAt, setLastRunAt] = useState<string>("");
  const [drawerTest, setDrawerTest] = useState<TestResult | null>(null);

  useEffect(() => {
    list({}).then((r: any) => setTests(r.tests)).catch(() => {});
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setRuns(parsed.runs ?? {});
        setLastRunAt(parsed.ran_at ?? "");
      } catch {}
    }
  }, []);

  const persist = (next: Record<number, RunState>, ranAt?: string) => {
    try {
      const onlyDone = Object.fromEntries(
        Object.entries(next).filter(([, v]) => v.status === "done" || v.status === "error"),
      );
      localStorage.setItem(LS_KEY, JSON.stringify({ runs: onlyDone, ran_at: ranAt ?? new Date().toISOString() }));
    } catch {}
  };

  // ─── Setup actions ──────────────────────────────────────────────────────
  const handlePrepare = async () => {
    setSetupState("running"); setSetupErr(""); setSetupInfo(null);
    try {
      const r = await prepare({});
      setSetupInfo(r); setSetupState("done");
      toast.success(`Dataset créé en ${(r.durationMs / 1000).toFixed(1)}s`);
    } catch (e: any) {
      setSetupErr(e?.message ?? "Erreur"); setSetupState("error");
      toast.error(e?.message ?? "Erreur");
    }
  };
  const handleCleanup = async () => {
    if (!confirm("Supprimer tous les profils is_test=true et les studios 'Test Studio %' ?")) return;
    setSetupState("running"); setSetupErr(""); setSetupInfo(null);
    try {
      const r = await cleanup({});
      setSetupInfo(r); setSetupState("done");
      toast.success(`${r.deletedProfiles} profils, ${r.deletedStudios} studios supprimés`);
    } catch (e: any) {
      setSetupErr(e?.message ?? "Erreur"); setSetupState("error");
      toast.error(e?.message ?? "Erreur");
    }
  };
  const handleReset = async () => {
    if (!confirm("Nettoyer puis re-créer le dataset de test ?")) return;
    setSetupState("running"); setSetupErr(""); setSetupInfo(null);
    try {
      const r = await reset({});
      setSetupInfo(r); setSetupState("done");
      toast.success(`Reset effectué en ${(r.durationMs / 1000).toFixed(1)}s`);
    } catch (e: any) {
      setSetupErr(e?.message ?? "Erreur"); setSetupState("error");
      toast.error(e?.message ?? "Erreur");
    }
  };
  const handleCleanTom = async () => {
    if (!confirm("Supprimer le shift du jour, le template test et les notifs récentes de Tom Cruise ?")) return;
    setSetupState("running"); setSetupErr(""); setSetupInfo(null);
    try {
      const r = await cleanTom({});
      setSetupInfo(r); setSetupState("done");
      toast.success("✅ Données test Tom supprimées");
    } catch (e: any) {
      setSetupErr(e?.message ?? "Erreur"); setSetupState("error");
      toast.error(e?.message ?? "Erreur");
    }
  };

  // ─── Test actions ───────────────────────────────────────────────────────
  const runSingle = async (id: number) => {
    setRuns((p) => ({ ...p, [id]: { status: "running" } }));
    try {
      const r: TestResult = await runOne({ data: { test_id: id } });
      setRuns((p) => {
        const next = { ...p, [id]: { status: "done" as Status, result: r } };
        persist(next);
        return next;
      });
    } catch (e: any) {
      setRuns((p) => {
        const next = { ...p, [id]: { status: "error" as Status, error: e?.message ?? String(e) } };
        persist(next);
        return next;
      });
    }
  };

  const runEverything = async () => {
    const empty: Record<number, RunState> = {};
    for (const t of tests) empty[t.id] = { status: "running" };
    setRuns(empty);
    setAllRunningId(0);
    // Lancer séquentiellement côté serveur (1 seul call)
    try {
      const r: any = await runAll({});
      const next: Record<number, RunState> = {};
      for (const res of r.results as TestResult[]) {
        const id = parseInt(res.testName.split(".")[0]) || 0;
        next[id] = { status: "done", result: res };
      }
      setRuns(next);
      setLastRunAt(r.ran_at);
      persist(next, r.ran_at);
      const pass = (r.results as TestResult[]).filter((x) => x.status === "passed").length;
      toast.success(`${pass}/${r.results.length} tests passés en ${(r.total_duration_ms / 1000).toFixed(1)}s`);
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur lors du run");
    } finally {
      setAllRunningId(null);
    }
  };

  const summary = useMemo(() => {
    const done = Object.values(runs).filter((r) => r.status === "done" && r.result);
    const passed = done.filter((r) => r.result?.status === "passed").length;
    const failed = done.filter((r) => r.result?.status === "failed").length;
    const errored = done.filter((r) => r.result?.status === "error").length;
    const totalMs = done.reduce((a, r) => a + (r.result?.durationMs ?? 0), 0);
    return { done: done.length, passed, failed, errored, totalMs };
  }, [runs]);

  const exportReport = (format: "json" | "md") => {
    const lines: string[] = [];
    const results: TestResult[] = tests
      .map((t) => runs[t.id]?.result)
      .filter((x): x is TestResult => !!x);
    if (format === "json") {
      const data = JSON.stringify({ ran_at: lastRunAt, summary, results }, null, 2);
      download(`qa-report-${Date.now()}.json`, data, "application/json");
    } else {
      lines.push(`# QA Report — ${lastRunAt}`);
      lines.push("");
      lines.push(`**${summary.passed}/${summary.done} tests passés** · ${(summary.totalMs / 1000).toFixed(1)}s`);
      lines.push("");
      for (const r of results) {
        const ico = r.status === "passed" ? "✅" : r.status === "failed" ? "❌" : "💥";
        lines.push(`## ${ico} ${r.testName} (${(r.durationMs / 1000).toFixed(2)}s)`);
        lines.push("");
        lines.push(r.message);
        if (r.details) {
          lines.push("```json"); lines.push(JSON.stringify(r.details, null, 2)); lines.push("```");
        }
        if (r.error) {
          lines.push("```"); lines.push(r.error); lines.push("```");
        }
        lines.push("");
      }
      download(`qa-report-${Date.now()}.md`, lines.join("\n"), "text/markdown");
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto" style={{ color: "var(--foreground)" }}>
      <Link to="/dashboard" className="flex items-center gap-1 mb-4" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
        <ArrowLeft size={12} /> Retour
      </Link>

      <div className="flex items-center gap-3 mb-2">
        <Beaker size={22} />
        <h1 style={{ fontSize: 26, fontWeight: 500 }}>QA Test Suite</h1>
      </div>
      <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginBottom: 28 }}>
        Suite de tests automatisés du moteur de génération de planning. Dataset isolé (Test Studio Alpha/Beta + 30 employés <code>is_test=true</code>).
      </p>

      {/* SECTION 1 — Setup */}
      <Section title="1. Setup">
        <div className="grid md:grid-cols-3 gap-3">
          <ActionButton
            icon={<Sparkles size={16} />} label="Préparer le dataset"
            description="Crée studios + 30 employés + dispos 4 semaines"
            onClick={handlePrepare} running={setupState === "running"} variant="primary"
          />
          <ActionButton
            icon={<Trash2 size={16} />} label="Nettoyer tout"
            description="Supprime tout is_test=true et 'Test Studio %'"
            onClick={handleCleanup} running={setupState === "running"} variant="danger"
          />
          <ActionButton
            icon={<RotateCw size={16} />} label="Reset complet"
            description="Cleanup + Préparer en une étape"
            onClick={handleReset} running={setupState === "running"} variant="secondary"
          />
        </div>
        <div className="mt-3">
          <ActionButton
            icon={<Trash2 size={16} />} label="🗑️ Nettoyer shift Tom"
            description="Supprime shift du jour, template test et notifs récentes de Tom Cruise"
            onClick={handleCleanTom} running={setupState === "running"} variant="secondary"
          />
        </div>
        {setupInfo && (
          <div className="mt-4 rounded-lg p-4" style={{ background: "var(--muted)", fontSize: 13 }}>
            <pre style={{ whiteSpace: "pre-wrap", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 }}>
              {JSON.stringify(setupInfo, null, 2)}
            </pre>
          </div>
        )}
        {setupErr && (
          <div className="mt-4 rounded-lg p-4 flex items-start gap-2" style={{ background: "var(--destructive-bg, #fef2f2)", color: "var(--destructive, #991b1b)", fontSize: 13 }}>
            <AlertTriangle size={16} /> {setupErr}
          </div>
        )}
      </Section>

      {/* SECTION 2 — Suite */}
      <Section title="2. Suite de tests">
        <button
          onClick={runEverything}
          disabled={allRunningId !== null}
          className="w-full rounded-xl px-6 py-4 mb-4 flex items-center justify-center gap-3 transition"
          style={{
            background: allRunningId !== null ? "var(--muted)" : "var(--primary)",
            color: "var(--primary-foreground, #fff)",
            fontSize: 15, fontWeight: 500,
            cursor: allRunningId !== null ? "wait" : "pointer",
          }}
        >
          {allRunningId !== null ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
          {allRunningId !== null ? "Tests en cours..." : "Lancer TOUS les tests"}
        </button>

        <div className="space-y-2">
          {tests.map((t) => {
            const state = runs[t.id];
            return (
              <div key={t.id} className="rounded-lg border p-3 flex items-center gap-3" style={{ borderColor: "var(--border)" }}>
                <StatusBadge status={state?.status} result={state?.result?.status} />
                <div className="flex-1 min-w-0">
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                    {state?.result?.message ?? t.description}
                  </div>
                </div>
                {state?.result && (
                  <span style={{ fontSize: 11, color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>
                    {(state.result.durationMs / 1000).toFixed(2)}s
                  </span>
                )}
                {state?.result && state.result.status !== "passed" && (
                  <button onClick={() => setDrawerTest(state.result!)}
                    className="rounded px-2 py-1 inline-flex items-center gap-1"
                    style={{ fontSize: 11, color: "var(--primary)", background: "var(--muted)" }}>
                    Détails <ChevronRight size={12} />
                  </button>
                )}
                <button
                  onClick={() => runSingle(t.id)}
                  disabled={state?.status === "running" || allRunningId !== null}
                  className="rounded px-3 py-1.5 inline-flex items-center gap-1"
                  style={{ fontSize: 12, border: "1px solid var(--border)", background: "var(--background)" }}
                >
                  {state?.status === "running" ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                  Lancer
                </button>
              </div>
            );
          })}
        </div>
      </Section>

      {/* SECTION 3 — Résultats */}
      <Section title="3. Résultats">
        {summary.done === 0 ? (
          <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
            Aucun test exécuté. Lance un test ou la suite complète ci-dessus.
          </div>
        ) : (
          <>
            <div className="flex items-center gap-4 mb-4 flex-wrap">
              <Pill color="green" label={`${summary.passed} passés`} />
              <Pill color="red" label={`${summary.failed} échoués`} />
              {summary.errored > 0 && <Pill color="orange" label={`${summary.errored} erreurs`} />}
              <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                Total : {(summary.totalMs / 1000).toFixed(1)}s
                {lastRunAt && ` · ${new Date(lastRunAt).toLocaleString("fr-FR")}`}
              </span>
              <div className="ml-auto flex gap-2">
                <button onClick={() => exportReport("json")} className="rounded px-3 py-1.5 inline-flex items-center gap-1"
                  style={{ fontSize: 12, border: "1px solid var(--border)" }}>
                  <Download size={12} /> JSON
                </button>
                <button onClick={() => exportReport("md")} className="rounded px-3 py-1.5 inline-flex items-center gap-1"
                  style={{ fontSize: 12, border: "1px solid var(--border)" }}>
                  <Download size={12} /> Markdown
                </button>
              </div>
            </div>
            <div className="space-y-2">
              {tests.map((t) => {
                const r = runs[t.id]?.result;
                if (!r) return null;
                return (
                  <div key={t.id} className="rounded-lg border p-3 flex items-start gap-3" style={{ borderColor: "var(--border)" }}>
                    <ResultIcon status={r.status} />
                    <div className="flex-1 min-w-0">
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{r.testName}</div>
                      <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>{r.message}</div>
                    </div>
                    <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{(r.durationMs / 1000).toFixed(2)}s</span>
                    <button onClick={() => setDrawerTest(r)} className="rounded px-2 py-1" style={{ fontSize: 11, background: "var(--muted)" }}>
                      Détails
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Section>

      {drawerTest && <Drawer onClose={() => setDrawerTest(null)} result={drawerTest} />}
    </div>
  );
}

// ─── UI helpers ────────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 style={{ fontSize: 16, fontWeight: 500, marginBottom: 12 }}>{title}</h2>
      {children}
    </section>
  );
}

function ActionButton({ icon, label, description, onClick, running, variant }: {
  icon: React.ReactNode; label: string; description: string;
  onClick: () => void; running?: boolean; variant: "primary" | "secondary" | "danger";
}) {
  const colors = {
    primary: { bg: "var(--primary)", fg: "var(--primary-foreground, #fff)" },
    secondary: { bg: "var(--secondary)", fg: "var(--secondary-foreground)" },
    danger: { bg: "var(--destructive, #ef4444)", fg: "#fff" },
  }[variant];
  return (
    <button onClick={onClick} disabled={running}
      className="rounded-lg p-4 text-left transition"
      style={{ background: colors.bg, color: colors.fg, opacity: running ? 0.6 : 1, cursor: running ? "wait" : "pointer" }}>
      <div className="flex items-center gap-2 mb-1" style={{ fontSize: 13, fontWeight: 500 }}>
        {running ? <Loader2 size={14} className="animate-spin" /> : icon} {label}
      </div>
      <div style={{ fontSize: 11, opacity: 0.85 }}>{description}</div>
    </button>
  );
}

function StatusBadge({ status, result }: { status?: Status; result?: TestResult["status"] }) {
  if (status === "running") {
    return <Loader2 size={16} className="animate-spin" style={{ color: "var(--muted-foreground)" }} />;
  }
  if (status === "done" && result) return <ResultIcon status={result} />;
  return <span style={{ width: 16, height: 16, borderRadius: 999, background: "var(--muted)" }} />;
}

function ResultIcon({ status }: { status: TestResult["status"] }) {
  if (status === "passed") return <span className="inline-flex items-center justify-center" style={{ width: 18, height: 18, borderRadius: 999, background: "#10b981", color: "#fff" }}><Check size={12} /></span>;
  if (status === "failed") return <span className="inline-flex items-center justify-center" style={{ width: 18, height: 18, borderRadius: 999, background: "#ef4444", color: "#fff" }}><X size={12} /></span>;
  return <span className="inline-flex items-center justify-center" style={{ width: 18, height: 18, borderRadius: 999, background: "#f59e0b", color: "#fff" }}><AlertTriangle size={12} /></span>;
}

function Pill({ color, label }: { color: "green" | "red" | "orange"; label: string }) {
  const bg = color === "green" ? "#d1fae5" : color === "red" ? "#fee2e2" : "#fef3c7";
  const fg = color === "green" ? "#065f46" : color === "red" ? "#991b1b" : "#92400e";
  return <span style={{ background: bg, color: fg, padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 500 }}>{label}</span>;
}

function Drawer({ result, onClose }: { result: TestResult; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1" style={{ background: "rgba(0,0,0,0.4)" }} />
      <div className="w-full max-w-xl h-full overflow-auto p-6" style={{ background: "var(--background)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 style={{ fontSize: 16, fontWeight: 500 }}>{result.testName}</h3>
          <button onClick={onClose} className="p-1"><X size={18} /></button>
        </div>
        <div className="mb-4 flex items-center gap-2">
          <ResultIcon status={result.status} />
          <span style={{ fontSize: 13 }}>{result.message}</span>
        </div>
        <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 8 }}>Durée : {(result.durationMs / 1000).toFixed(2)}s</div>
        {result.details && (
          <>
            <div style={{ fontSize: 12, fontWeight: 500, marginTop: 16, marginBottom: 6 }}>Détails</div>
            <pre className="rounded p-3" style={{ background: "var(--muted)", fontSize: 11, whiteSpace: "pre-wrap", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
              {JSON.stringify(result.details, null, 2)}
            </pre>
          </>
        )}
        {result.error && (
          <>
            <div style={{ fontSize: 12, fontWeight: 500, marginTop: 16, marginBottom: 6 }}>Stack</div>
            <pre className="rounded p-3" style={{ background: "#fef2f2", color: "#991b1b", fontSize: 11, whiteSpace: "pre-wrap", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
              {result.error}
            </pre>
          </>
        )}
      </div>
    </div>
  );
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
