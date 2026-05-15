import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Check, AlertTriangle, ArrowRight, AlertCircle, Info, History, X, Eye, Send, Undo2, Globe, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { generatePlanning, listPlanningRuns, cancelPlanningRun } from "@/lib/generate-planning.functions";
import { markPlanningForReview, publishPlanning, unpublishPlanning, revertPlanningToDraft, getPlanningRun } from "@/lib/planning-workflow.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/planning/generate")({
  component: GeneratePlanningPage,
  head: () => ({ meta: [{ title: "Générer le planning — Kadence" }] }),
});

const MONTHS_FR = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

interface Hole {
  studio_id: string; studio_name: string; date: string;
  start_time: string; end_time: string; business_role: string; reason: string;
}
interface Alert {
  type: string; severity: "info" | "warning" | "error";
  user_name?: string; message: string;
}
interface GenerateResult {
  planning_run_id: string;
  status: "success" | "partial" | "failed";
  coverage_rate: number;
  shifts_generated: number;
  total_slots_needed: number;
  total_slots_covered: number;
  holes: Hole[];
  alerts: Alert[];
  duration_ms: number;
  solver_logs?: any;
}

const LOADER_STEPS = [
  "Chargement des données…",
  "Analyse des disponibilités…",
  "Construction du planning…",
  "Optimisation locale…",
  "Finalisation…",
];

function todayISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }

function GeneratePlanningPage() {
  const navigate = useNavigate();
  const generate = useServerFn(generatePlanning);

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [studios, setStudios] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedStudios, setSelectedStudios] = useState<Set<string>>(new Set());
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [preserveManual, setPreserveManual] = useState(true);
  const [preserveLocked, setPreserveLocked] = useState(true);
  const [dryRun, setDryRun] = useState(false);
  const [state, setState] = useState<"idle" | "generating" | "done" | "error">("idle");
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [stepIdx, setStepIdx] = useState(0);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    supabase.from("studios").select("id, name").order("name").then(({ data }) => {
      const arr = (data ?? []) as Array<{ id: string; name: string }>;
      setStudios(arr);
      setSelectedStudios(new Set(arr.map((s) => s.id)));
    });
  }, []);

  useEffect(() => {
    if (state !== "generating") return;
    const id = setInterval(() => setStepIdx((i) => Math.min(i + 1, LOADER_STEPS.length - 1)), 4000);
    return () => clearInterval(id);
  }, [state]);

  const start = async () => {
    setState("generating");
    setStepIdx(0);
    setErrorMsg("");
    try {
      const monthStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const res = await generate({
        data: {
          month_start_date: monthStart,
          studio_ids: Array.from(selectedStudios),
          preserve_manual: preserveManual,
          preserve_locked: preserveLocked,
          dry_run: dryRun,
        },
      });
      setResult(res as GenerateResult);
      setState("done");
      const r = res as GenerateResult;
      toast.success(`${r.shifts_generated} shifts générés (${Math.round(r.coverage_rate * 100)}% de couverture)`);
    } catch (e: any) {
      setErrorMsg(e?.message || "Erreur lors de la génération");
      setState("error");
    }
  };

  const toggleStudio = (id: string) => {
    setSelectedStudios((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  if (state === "generating") {
    return (
      <div className="p-4 md:p-6 flex items-center justify-center" style={{ minHeight: "calc(100vh - 52px)" }}>
        <div className="text-center" style={{ maxWidth: 420 }}>
          <div className="rounded-full mx-auto flex items-center justify-center mb-4" style={{ width: 56, height: 56, backgroundColor: "var(--coral-light)" }}>
            <Sparkles size={24} style={{ color: "var(--coral-dark)" }} className="animate-pulse" />
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 6 }}>Génération en cours…</h2>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginBottom: 4 }}>{LOADER_STEPS[stepIdx]}</p>
          <p style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Peut prendre 30-90 secondes</p>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="p-4 md:p-6 flex items-center justify-center" style={{ minHeight: "calc(100vh - 52px)" }}>
        <div className="text-center" style={{ maxWidth: 500 }}>
          <div className="rounded-full mx-auto flex items-center justify-center mb-4" style={{ width: 56, height: 56, backgroundColor: "var(--danger-bg)" }}>
            <AlertCircle size={28} style={{ color: "var(--danger-text)" }} />
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 500, marginBottom: 8 }}>Génération impossible</h1>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginBottom: 16 }}>{errorMsg}</p>
          <button onClick={() => setState("idle")} className="rounded-md px-4 py-2"
            style={{ fontSize: 13, fontWeight: 500, border: "0.5px solid var(--border)" }}>
            Retour
          </button>
        </div>
      </div>
    );
  }

  if (state === "done" && result) {
    return <ResultView r={result} onClose={() => { setState("idle"); setResult(null); }} navigate={navigate} />;
  }

  // idle
  const monthStartPreview = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500 }}>Générer le planning</h1>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 2 }}>1 mois (4 semaines) à partir du 1er du mois choisi</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/admin/data-diagnostic"
            className="rounded-md px-3 py-2 flex items-center gap-2"
            style={{ fontSize: 12, fontWeight: 500, border: "0.5px solid var(--border)", backgroundColor: "var(--card)" }}>
            Diagnostic
          </Link>
          <button onClick={() => setShowHistory(true)}
            className="rounded-md px-3 py-2 flex items-center gap-2"
            style={{ fontSize: 12, fontWeight: 500, border: "0.5px solid var(--border)", backgroundColor: "var(--card)" }}>
            <History size={14} /> Historique
          </button>
        </div>
      </div>

      <div className="rounded-xl border p-6 mb-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", maxWidth: 640 }}>
        <div className="mb-5">
          <label style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Mois cible</label>
          <div className="flex gap-2 mt-2">
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
              className="rounded-md px-3 py-2 outline-none flex-1"
              style={{ fontSize: 13, border: "0.5px solid var(--border)", backgroundColor: "var(--background)" }}>
              {MONTHS_FR.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))}
              className="rounded-md px-3 py-2 outline-none"
              style={{ fontSize: 13, border: "0.5px solid var(--border)", backgroundColor: "var(--background)" }}>
              {[today.getFullYear(), today.getFullYear() + 1].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <p style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 6 }}>Période : du {monthStartPreview} au +27 jours</p>
        </div>

        <div className="mb-5">
          <label style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Studios</label>
          <div className="flex flex-col gap-2 mt-2">
            {studios.map((st) => (
              <label key={st.id} className="flex items-center gap-2 cursor-pointer rounded-md px-3 py-2"
                style={{ fontSize: 13, backgroundColor: selectedStudios.has(st.id) ? "var(--coral-light)" : "var(--muted)" }}>
                <input type="checkbox" checked={selectedStudios.has(st.id)} onChange={() => toggleStudio(st.id)} />
                {st.name}
              </label>
            ))}
          </div>
        </div>

        <div className="mb-5">
          <button onClick={() => setAdvancedOpen((v) => !v)}
            className="text-left flex items-center gap-1"
            style={{ fontSize: 12, fontWeight: 500, color: "var(--muted-foreground)" }}>
            {advancedOpen ? "▾" : "▸"} Options avancées
          </button>
          {advancedOpen && (
            <div className="flex flex-col gap-2 mt-3 pl-4">
              <label className="flex items-center gap-2 cursor-pointer" style={{ fontSize: 12 }}>
                <input type="checkbox" checked={preserveManual} onChange={(e) => setPreserveManual(e.target.checked)} />
                Préserver les shifts manuels
              </label>
              <label className="flex items-center gap-2 cursor-pointer" style={{ fontSize: 12 }}>
                <input type="checkbox" checked={preserveLocked} onChange={(e) => setPreserveLocked(e.target.checked)} />
                Préserver les shifts publiés (lockés)
              </label>
              <label className="flex items-center gap-2 cursor-pointer" style={{ fontSize: 12 }}>
                <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
                Simuler sans écrire (dry-run)
              </label>
            </div>
          )}
        </div>

        <button onClick={start}
          disabled={selectedStudios.size === 0}
          className="rounded-md px-6 py-3 flex items-center gap-2 transition-colors disabled:opacity-50"
          style={{ fontSize: 14, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
          <Sparkles size={16} /> Générer le planning
        </button>
      </div>

      <div className="rounded-lg p-3 flex items-start gap-2" style={{ backgroundColor: "var(--info-bg)", maxWidth: 640 }}>
        <Info size={14} style={{ color: "var(--info-text)", marginTop: 2, flexShrink: 0 }} />
        <div style={{ fontSize: 11, color: "var(--info-text)", lineHeight: 1.5 }}>
          Les besoins sont lus depuis <Link to="/reglages" style={{ textDecoration: "underline" }}>Réglages › Besoins par studio</Link>. L'algorithme respecte les plafonds hebdo, le repos 11h et privilégie les meilleurs scores. Tie-breaker équité quand les scores sont proches (&lt; 0.5 d'écart).
        </div>
      </div>

      {showHistory && <HistoryModal onClose={() => setShowHistory(false)} />}
    </div>
  );
}

// ─── Vue résultat ───────────────────────────────────────────────────────────
function ResultView({ r, onClose, navigate }: { r: GenerateResult; onClose: () => void; navigate: any }) {
  const cancel = useServerFn(cancelPlanningRun);
  const [cancelling, setCancelling] = useState(false);
  const coveragePct = Math.round(r.coverage_rate * 100);
  const statusColor = r.status === "success" ? "var(--success-text)" : r.status === "partial" ? "var(--warning-text)" : "var(--danger-text)";
  const statusBg = r.status === "success" ? "var(--success-bg)" : r.status === "partial" ? "var(--warning-bg)" : "var(--danger-bg)";

  const doCancel = async () => {
    if (!confirm("Supprimer tous les shifts générés par ce run ? (les shifts manuels et publiés sont conservés)")) return;
    setCancelling(true);
    try {
      const res: any = await cancel({ data: { run_id: r.planning_run_id } });
      toast.success(`${res.deleted} shifts supprimés`);
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Erreur");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="p-4 md:p-6">
      <div className="rounded-xl p-5 mb-5 flex items-center gap-4" style={{ backgroundColor: statusBg }}>
        <div className="rounded-full flex items-center justify-center" style={{ width: 48, height: 48, backgroundColor: "var(--card)" }}>
          {r.status === "success" ? <Check size={24} style={{ color: statusColor }} /> : <AlertTriangle size={24} style={{ color: statusColor }} />}
        </div>
        <div className="flex-1">
          <div style={{ fontSize: 24, fontWeight: 500, color: statusColor }}>
            {coveragePct}% couvert
          </div>
          <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
            {r.total_slots_covered} / {r.total_slots_needed} créneaux · {r.shifts_generated} shifts générés · {(r.duration_ms / 1000).toFixed(1)}s
          </div>
        </div>
      </div>

      {r.holes.length > 0 && (
        <div className="rounded-xl border p-5 mb-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={14} style={{ color: "var(--warning-text)" }} />
            <span style={{ fontSize: 13, fontWeight: 500 }}>{r.holes.length} trou{r.holes.length > 1 ? "s" : ""}</span>
          </div>
          <div className="flex flex-col gap-1.5 max-h-[400px] overflow-y-auto">
            {r.holes.slice(0, 50).map((h, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2 flex-wrap" style={{ backgroundColor: "var(--warning-bg)" }}>
                <span style={{ fontSize: 12, fontWeight: 500, minWidth: 110 }}>{new Date(h.date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}</span>
                <span style={{ fontSize: 12 }}>{h.start_time}–{h.end_time}</span>
                <span className="rounded-full px-1.5 py-0.5" style={{ fontSize: 10, fontWeight: 500, backgroundColor: "var(--muted)" }}>{h.business_role}</span>
                <span style={{ fontSize: 11 }}>{h.studio_name}</span>
                <span style={{ fontSize: 11, color: "var(--warning-text)", marginLeft: "auto" }}>{h.reason}</span>
              </div>
            ))}
            {r.holes.length > 50 && <div style={{ fontSize: 11, color: "var(--muted-foreground)", padding: 8 }}>+ {r.holes.length - 50} autres trous</div>}
          </div>
        </div>
      )}

      {r.alerts.length > 0 && (
        <div className="rounded-xl border p-5 mb-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2 mb-3">
            <Info size={14} />
            <span style={{ fontSize: 13, fontWeight: 500 }}>Alertes ({r.alerts.length})</span>
          </div>
          <div className="flex flex-col gap-1.5 max-h-[300px] overflow-y-auto">
            {r.alerts.map((a, i) => {
              const bg = a.severity === "error" ? "var(--danger-bg)" : a.severity === "warning" ? "var(--warning-bg)" : "var(--info-bg)";
              const fg = a.severity === "error" ? "var(--danger-text)" : a.severity === "warning" ? "var(--warning-text)" : "var(--info-text)";
              return (
                <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2 flex-wrap" style={{ backgroundColor: bg }}>
                  <span className="rounded-full px-1.5 py-0.5" style={{ fontSize: 10, fontWeight: 500, backgroundColor: "var(--card)", color: fg }}>{a.type}</span>
                  {a.user_name && <span style={{ fontSize: 12, fontWeight: 500 }}>{a.user_name}</span>}
                  <span style={{ fontSize: 12 }}>{a.message}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <WorkflowPanel runId={r.planning_run_id} />

      <div className="flex items-center gap-3 flex-wrap mt-5">
        <button onClick={() => navigate({ to: "/planning" })}
          className="rounded-md px-6 py-3 flex items-center gap-2"
          style={{ fontSize: 14, fontWeight: 500, backgroundColor: "var(--coral)", color: "#fff" }}>
          Voir le planning <ArrowRight size={16} />
        </button>
        <button onClick={onClose}
          className="rounded-md px-6 py-3"
          style={{ fontSize: 14, fontWeight: 500, border: "0.5px solid var(--border)" }}>
          Relancer
        </button>
        <button onClick={doCancel} disabled={cancelling}
          className="rounded-md px-6 py-3 ml-auto"
          style={{ fontSize: 13, fontWeight: 500, color: "var(--danger-text)", border: "0.5px solid var(--border)" }}>
          {cancelling ? "Suppression…" : "Annuler cette génération"}
        </button>
      </div>
    </div>
  );
}

// ─── Panneau workflow publication ──────────────────────────────────────────
function WorkflowPanel({ runId }: { runId: string }) {
  const fetchRun = useServerFn(getPlanningRun);
  const markReview = useServerFn(markPlanningForReview);
  const publish = useServerFn(publishPlanning);
  const unpublish = useServerFn(unpublishPlanning);
  const revert = useServerFn(revertPlanningToDraft);

  const [data, setData] = useState<{ run: any; names: Record<string, string> } | null>(null);
  const [busy, setBusy] = useState(false);
  const [showUnpub, setShowUnpub] = useState(false);
  const [reason, setReason] = useState("");

  const reload = async () => {
    try {
      const res: any = await fetchRun({ data: { planning_run_id: runId } });
      setData(res);
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
  };
  useEffect(() => { reload(); }, [runId]);

  if (!data) return null;
  const ws = (data.run.workflow_status ?? "draft") as "draft" | "review" | "published" | "unpublished";
  const fmtDate = (iso?: string | null) => iso ? new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";

  const wrap = async (fn: () => Promise<any>, okMsg: string) => {
    setBusy(true);
    try { await fn(); toast.success(okMsg); await reload(); }
    catch (e: any) { toast.error(e?.message ?? "Erreur"); }
    finally { setBusy(false); }
  };

  const badge = (
    <WorkflowBadge status={ws} />
  );

  return (
    <div className="rounded-xl border p-5 mb-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      <div className="flex items-center gap-2 mb-3">
        <span style={{ fontSize: 13, fontWeight: 500 }}>Statut publication</span>
        {badge}
      </div>

      {ws === "published" && (
        <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 10 }}>
          Publié le {fmtDate(data.run.published_at)}{data.names[data.run.published_by] ? ` par ${data.names[data.run.published_by]}` : ""}.
        </div>
      )}
      {ws === "unpublished" && (
        <div className="rounded-lg p-3 mb-3" style={{ backgroundColor: "var(--warning-bg)", color: "var(--warning-text)", fontSize: 12 }}>
          Dépublié le {fmtDate(data.run.unpublished_at)}. Raison : {data.run.unpublished_reason || "—"}
        </div>
      )}
      {ws === "review" && data.run.marked_review_at && (
        <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 10 }}>
          Marqué pour validation le {fmtDate(data.run.marked_review_at)}.
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {ws === "draft" && (
          <button disabled={busy} onClick={() => wrap(() => markReview({ data: { planning_run_id: runId } }), "Marqué pour validation")}
            className="rounded-md px-4 py-2 flex items-center gap-2"
            style={{ fontSize: 13, fontWeight: 500, border: "0.5px solid var(--border)", backgroundColor: "var(--muted)" }}>
            <Send size={14} /> Marquer pour validation
          </button>
        )}
        {ws === "review" && (
          <>
            <button disabled={busy} onClick={() => wrap(() => publish({ data: { planning_run_id: runId } }), "Planning publié")}
              className="rounded-md px-4 py-2 flex items-center gap-2"
              style={{ fontSize: 13, fontWeight: 500, backgroundColor: "var(--success-text)", color: "#fff" }}>
              <Globe size={14} /> Publier
            </button>
            <button disabled={busy} onClick={() => wrap(() => revert({ data: { planning_run_id: runId } }), "Retour en brouillon")}
              className="rounded-md px-4 py-2 flex items-center gap-2"
              style={{ fontSize: 13, fontWeight: 500, border: "0.5px solid var(--border)" }}>
              <Undo2 size={14} /> Retour en brouillon
            </button>
          </>
        )}
        {ws === "published" && (
          <button disabled={busy} onClick={() => setShowUnpub(true)}
            className="rounded-md px-4 py-2 flex items-center gap-2"
            style={{ fontSize: 13, fontWeight: 500, color: "var(--danger-text)", border: "0.5px solid var(--danger-text)" }}>
            <ShieldAlert size={14} /> Dépublier
          </button>
        )}
        {ws === "unpublished" && (
          <>
            <button disabled={busy} onClick={() => wrap(() => markReview({ data: { planning_run_id: runId } }), "Re-soumis à validation")}
              className="rounded-md px-4 py-2 flex items-center gap-2"
              style={{ fontSize: 13, fontWeight: 500, border: "0.5px solid var(--border)", backgroundColor: "var(--muted)" }}>
              <Send size={14} /> Re-soumettre à validation
            </button>
            <button disabled={busy} onClick={() => wrap(() => revert({ data: { planning_run_id: runId } }), "Retour en brouillon")}
              className="rounded-md px-4 py-2 flex items-center gap-2"
              style={{ fontSize: 13, fontWeight: 500, border: "0.5px solid var(--border)" }}>
              <Undo2 size={14} /> Retour brouillon
            </button>
          </>
        )}
      </div>

      {showUnpub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={() => setShowUnpub(false)}>
          <div className="rounded-xl bg-white p-5 w-full" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 8 }}>Dépublier le planning</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 12 }}>
              Les shifts seront déverrouillés et repasseront en brouillon. L'historique de publication est conservé.
            </div>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Raison de la dépublication (obligatoire)"
              className="w-full rounded-md p-2" style={{ fontSize: 13, border: "0.5px solid var(--border)", minHeight: 80 }} />
            <div className="flex gap-2 mt-3 justify-end">
              <button onClick={() => setShowUnpub(false)} className="rounded-md px-3 py-2" style={{ fontSize: 13, border: "0.5px solid var(--border)" }}>Annuler</button>
              <button disabled={busy || reason.trim().length < 3}
                onClick={async () => {
                  await wrap(() => unpublish({ data: { planning_run_id: runId, reason: reason.trim() } }), "Planning dépublié");
                  setShowUnpub(false); setReason("");
                }}
                className="rounded-md px-3 py-2 disabled:opacity-50"
                style={{ fontSize: 13, fontWeight: 500, backgroundColor: "var(--danger-text)", color: "#fff" }}>
                Confirmer la dépublication
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WorkflowBadge({ status }: { status: "draft" | "review" | "published" | "unpublished" }) {
  const map = {
    draft:        { label: "Brouillon",   bg: "var(--muted)",      fg: "var(--muted-foreground)" },
    review:       { label: "À valider",   bg: "var(--info-bg)",    fg: "var(--info-text)" },
    published:    { label: "Publié",      bg: "var(--success-bg)", fg: "var(--success-text)" },
    unpublished:  { label: "Dépublié",    bg: "var(--warning-bg)", fg: "var(--warning-text)" },
  } as const;
  const { label, bg, fg } = map[status];
  return <span className="rounded-full px-2 py-0.5" style={{ fontSize: 11, fontWeight: 500, backgroundColor: bg, color: fg }}>{label}</span>;
}

// ─── Modal historique ───────────────────────────────────────────────────────
function HistoryModal({ onClose }: { onClose: () => void }) {
  const list = useServerFn(listPlanningRuns);
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);

  useEffect(() => {
    list().then((res: any) => { setRuns(res.runs ?? []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={onClose}>
      <div className="rounded-xl bg-white w-full" style={{ maxWidth: 800, maxHeight: "85vh", overflow: "hidden", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div style={{ fontSize: 15, fontWeight: 500 }}>Historique des générations</div>
          <button onClick={onClose} className="rounded-full p-1.5" style={{ backgroundColor: "var(--muted)" }}><X size={14} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Chargement…</div> :
           runs.length === 0 ? <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Aucune génération encore</div> :
           <div className="flex flex-col gap-2">
            {runs.map((r) => {
              const cov = r.coverage_rate ? Math.round(r.coverage_rate * 100) : 0;
              const colorMap: Record<string, string> = { success: "var(--success-text)", partial: "var(--warning-text)", failed: "var(--danger-text)", running: "var(--info-text)" };
              return (
                <div key={r.id} className="rounded-lg border p-3 flex items-center gap-3" style={{ borderColor: "var(--border)" }}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap" style={{ fontSize: 13, fontWeight: 500 }}>
                      {r.month_start_date} → {r.month_end_date}
                      <WorkflowBadge status={(r.workflow_status ?? "draft") as any} />
                      {r.dry_run && <span className="rounded-full px-1.5 py-0.5" style={{ fontSize: 10, backgroundColor: "var(--muted)" }}>dry-run</span>}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                      {new Date(r.started_at).toLocaleString("fr-FR")} · {r.studios_included?.length ?? 0} studios · {r.duration_ms ? `${(r.duration_ms / 1000).toFixed(1)}s` : "—"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div style={{ fontSize: 16, fontWeight: 500, color: colorMap[r.status] ?? "var(--foreground)" }}>{cov}%</div>
                    <div style={{ fontSize: 10, color: "var(--muted-foreground)" }}>{r.shifts_generated} shifts</div>
                  </div>
                  <button onClick={() => setSelected(r)} className="rounded-md p-2" style={{ border: "0.5px solid var(--border)" }}>
                    <Eye size={14} />
                  </button>
                </div>
              );
            })}
           </div>}
        </div>
      </div>
      {selected && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} onClick={() => setSelected(null)}>
          <div className="rounded-xl bg-white p-5 w-full" style={{ maxWidth: 720, maxHeight: "85vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div style={{ fontSize: 15, fontWeight: 500 }}>Détails du run</div>
              <button onClick={() => setSelected(null)} className="rounded-full p-1.5" style={{ backgroundColor: "var(--muted)" }}><X size={14} /></button>
            </div>
            {selected.error_message && (
              <div className="rounded-lg p-3 mb-3" style={{ backgroundColor: "var(--danger-bg)", color: "var(--danger-text)", fontSize: 12 }}>
                {selected.error_message}
              </div>
            )}
            <pre style={{ fontSize: 11, backgroundColor: "var(--muted)", padding: 12, borderRadius: 8, overflow: "auto", maxHeight: 400 }}>
              {JSON.stringify(selected.solver_logs, null, 2)}
            </pre>
            {selected.alerts && (
              <>
                <div style={{ fontSize: 12, fontWeight: 500, marginTop: 12, marginBottom: 6 }}>Alertes</div>
                <pre style={{ fontSize: 11, backgroundColor: "var(--muted)", padding: 12, borderRadius: 8, overflow: "auto", maxHeight: 200 }}>
                  {JSON.stringify(selected.alerts, null, 2)}
                </pre>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
