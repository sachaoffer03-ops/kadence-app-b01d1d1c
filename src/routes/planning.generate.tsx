import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Sparkles, ArrowLeft, AlertCircle, Loader2, Check, X, Eye, History,
  Send, Globe, Undo2, ShieldAlert, AlertTriangle, Info,
} from "lucide-react";
import { toast } from "sonner";
import { generatePlanning, listPlanningRuns, cancelPlanningRun } from "@/lib/generate-planning.functions";
import {
  markPlanningForReview, publishPlanning, unpublishPlanning, revertPlanningToDraft, getPlanningRun,
} from "@/lib/planning-workflow.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/planning/generate")({
  component: GeneratePlanningPage,
  head: () => ({ meta: [{ title: "Générer le planning — Kadence" }] }),
});

const MONTHS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

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

interface StudioInfo {
  id: string;
  name: string;
  employees: number;
  templates: number;
}

function GeneratePlanningPage() {
  const navigate = useNavigate();
  const generate = useServerFn(generatePlanning);

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [studios, setStudios] = useState<StudioInfo[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [employees, setEmployees] = useState<Array<{ id: string; first_name: string; last_name: string; studio_ids: string[] }>>([]);
  const [whitelist, setWhitelist] = useState<Set<string>>(new Set());
  const [whitelistOpen, setWhitelistOpen] = useState(false);

  // advanced
  const [advOpen, setAdvOpen] = useState(false);
  const [preserveManual, setPreserveManual] = useState(true);
  const [preserveLocked, setPreserveLocked] = useState(true);
  const [dryRun, setDryRun] = useState(false);

  const [state, setState] = useState<"idle" | "generating" | "done" | "error">("idle");
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: studiosRaw }, { data: links }, { data: tmpls }, { data: profs }] = await Promise.all([
        supabase.from("studios").select("id, name").order("name"),
        supabase.from("user_studios").select("user_id, studio_id"),
        supabase.from("staffing_templates").select("studio_id"),
        supabase.from("profiles").select("id, first_name, last_name").eq("status", "active").order("first_name"),
      ]);
      const empCount = new Map<string, number>();
      const studiosByUser = new Map<string, string[]>();
      (links ?? []).forEach((l: any) => {
        empCount.set(l.studio_id, (empCount.get(l.studio_id) ?? 0) + 1);
        (studiosByUser.get(l.user_id) ?? studiosByUser.set(l.user_id, []).get(l.user_id)!).push(l.studio_id);
      });
      const tmplCount = new Map<string, number>();
      (tmpls ?? []).forEach((t: any) => tmplCount.set(t.studio_id, (tmplCount.get(t.studio_id) ?? 0) + 1));
      const arr: StudioInfo[] = (studiosRaw ?? []).map((s: any) => ({
        id: s.id, name: s.name,
        employees: empCount.get(s.id) ?? 0,
        templates: tmplCount.get(s.id) ?? 0,
      }));
      setStudios(arr);
      setSelected(new Set(arr.filter((s) => s.templates > 0).map((s) => s.id)));
      setEmployees((profs ?? []).map((p: any) => ({
        id: p.id, first_name: p.first_name ?? "", last_name: p.last_name ?? "",
        studio_ids: studiosByUser.get(p.id) ?? [],
      })));
    })();
  }, []);

  const selectedWithTemplates = useMemo(
    () => Array.from(selected).filter((id) => (studios.find((s) => s.id === id)?.templates ?? 0) > 0),
    [selected, studios],
  );
  const canGenerate = selectedWithTemplates.length > 0;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const selectAll = () => setSelected(new Set(studios.filter((s) => s.templates > 0).map((s) => s.id)));
  const selectNone = () => setSelected(new Set());

  const start = async () => {
    setState("generating");
    setErrorMsg("");
    try {
      const monthStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const res = await generate({
        data: {
          month_start_date: monthStart,
          studio_ids: Array.from(selected),
          preserve_manual: preserveManual,
          preserve_locked: preserveLocked,
          dry_run: dryRun,
        },
      });
      const r = res as GenerateResult;
      setResult(r);
      setState("done");
      toast.success(`${r.shifts_generated} shifts générés (${Math.round(r.coverage_rate * 100)}% de couverture)`);
    } catch (e: any) {
      setErrorMsg(e?.message || "Erreur lors de la génération");
      setState("error");
    }
  };

  // ─── Loading state ────────────────────────────────────────────────────────
  if (state === "generating") {
    return (
      <div className="p-4 md:p-6 flex items-center justify-center" style={{ minHeight: "calc(100vh - 52px)" }}>
        <div className="text-center" style={{ maxWidth: 420 }}>
          <Loader2 size={36} className="animate-spin mx-auto mb-4" style={{ color: "var(--primary)" }} />
          <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 6 }}>Génération en cours…</h2>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Peut prendre 30 à 90 secondes.</p>
        </div>
      </div>
    );
  }

  // ─── Error state ──────────────────────────────────────────────────────────
  if (state === "error") {
    return (
      <div className="p-4 md:p-6 flex items-center justify-center" style={{ minHeight: "calc(100vh - 52px)" }}>
        <div className="text-center" style={{ maxWidth: 500 }}>
          <div className="rounded-full mx-auto flex items-center justify-center mb-4" style={{ width: 56, height: 56, backgroundColor: "var(--danger-bg)" }}>
            <AlertCircle size={28} style={{ color: "var(--danger-text)" }} />
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 500, marginBottom: 8 }}>Génération impossible</h1>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginBottom: 20 }}>{errorMsg}</p>
          <Button variant="outline" onClick={() => setState("idle")}>Retour</Button>
        </div>
      </div>
    );
  }

  // ─── Done state ───────────────────────────────────────────────────────────
  if (state === "done" && result) {
    return (
      <ResultView
        r={result}
        navigate={navigate}
        onReset={() => { setState("idle"); setResult(null); }}
      />
    );
  }

  // ─── Idle (form) ──────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto pb-16">
      {/* Header */}
      <Link to="/planning" className="inline-flex items-center gap-1" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
        <ArrowLeft size={12} /> Retour au planning
      </Link>
      <h1 style={{ fontSize: 28, fontWeight: 500, marginTop: 16 }}>Générer le planning</h1>
      <p style={{ fontSize: 14, color: "var(--muted-foreground)", marginTop: 6, marginBottom: 32 }}>
        Construis un planning complet pour le mois et les studios de ton choix. L'algorithme s'occupe du reste.
      </p>

      {/* How it works */}
      <Card className="p-6 mb-6 rounded-2xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <HowStep emoji="🎯" title="Filtrage"
            desc="Pour chaque créneau ouvert, l'algo identifie les employés qui ont le bon rôle, le bon studio et une disponibilité qui couvre l'horaire." />
          <HowStep emoji="⭐" title="Scoring"
            desc="Chaque candidat reçoit un score basé sur sa performance, sa fiabilité et son ancienneté. Les meilleurs profils sont placés en priorité sur les shifts clés." />
          <HowStep emoji="⚖️" title="Équité"
            desc="Plus un employé a déjà été choisi cette semaine, plus son score baisse. Le planning reste juste et évite les sur-sollicitations." />
        </div>
      </Card>

      {/* Période */}
      <Card className="p-6 mb-6 rounded-2xl">
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>Quelle période veux-tu générer ?</div>
        <div className="flex gap-3">
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS_FR.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger style={{ width: 120 }}><SelectValue /></SelectTrigger>
            <SelectContent>
              {[today.getFullYear(), today.getFullYear() + 1].map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 10 }}>
          Le planning couvrira les 4 ou 5 semaines du mois choisi.
        </p>
      </Card>

      {/* Studios */}
      <Card className="p-6 mb-6 rounded-2xl">
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>Pour quels studios ?</div>
        <div className="flex flex-col gap-1">
          {studios.length === 0 && (
            <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Chargement des studios…</div>
          )}
          {studios.map((s) => {
            const noTmpl = s.templates === 0;
            const checked = selected.has(s.id);
            return (
              <label
                key={s.id}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5"
                style={{
                  cursor: noTmpl ? "not-allowed" : "pointer",
                  opacity: noTmpl ? 0.6 : 1,
                  border: "0.5px solid var(--border)",
                  backgroundColor: checked && !noTmpl ? "var(--accent)" : "transparent",
                }}
              >
                <Checkbox
                  checked={checked}
                  disabled={noTmpl}
                  onCheckedChange={() => !noTmpl && toggle(s.id)}
                />
                <span style={{ fontSize: 14, flex: 1 }}>{s.name}</span>
                {noTmpl ? (
                  <Badge variant="outline" style={{ fontSize: 11, backgroundColor: "var(--warning-bg)", color: "var(--warning-text)", borderColor: "transparent" }}>
                    ⚠ Pas de besoins configurés
                  </Badge>
                ) : (
                  <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                    {s.employees} employé{s.employees > 1 ? "s" : ""} rattaché{s.employees > 1 ? "s" : ""}
                  </span>
                )}
              </label>
            );
          })}
        </div>
        <div className="flex gap-4 mt-3">
          <button onClick={selectAll} className="hover:underline" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
            Tout sélectionner
          </button>
          <button onClick={selectNone} className="hover:underline" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
            Tout désélectionner
          </button>
        </div>
      </Card>

      {/* Generate button */}
      <button
        onClick={start}
        disabled={!canGenerate}
        className="w-full rounded-2xl flex items-center justify-center gap-2 transition"
        style={{
          height: 56, fontSize: 16, fontWeight: 500,
          backgroundColor: "var(--primary)", color: "var(--primary-foreground)",
          border: "none",
          opacity: canGenerate ? 1 : 0.4,
          cursor: canGenerate ? "pointer" : "not-allowed",
        }}
      >
        <Sparkles size={18} /> Générer le planning
      </button>

      {/* Footer ghost links */}
      <div className="flex items-center justify-center gap-6 mt-8">
        <button onClick={() => setHistoryOpen(true)} className="hover:underline flex items-center gap-1.5"
          style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
          <History size={12} /> Voir l'historique
        </button>
        <Link to="/admin/diagnostic" className="hover:underline"
          style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
          Diagnostic des données
        </Link>
        <button onClick={() => setAdvOpen(true)} className="hover:underline"
          style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
          Paramètres avancés
        </button>
      </div>

      {/* Advanced settings dialog */}
      <Dialog open={advOpen} onOpenChange={setAdvOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Paramètres avancés</DialogTitle>
            <DialogDescription>À ne toucher que si tu sais ce que tu fais.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-5 py-2">
            <AdvancedToggle
              label="Préserver les shifts créés à la main"
              desc="Les shifts créés manuellement ne seront pas écrasés."
              checked={preserveManual} onChange={setPreserveManual}
            />
            <AdvancedToggle
              label="Préserver les shifts publiés"
              desc="Les shifts déjà envoyés aux employés ne seront pas modifiés."
              checked={preserveLocked} onChange={setPreserveLocked}
            />
            <AdvancedToggle
              label="Mode simulation (dry-run)"
              desc="Affiche le résultat sans rien enregistrer en base."
              checked={dryRun} onChange={setDryRun}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdvOpen(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {historyOpen && <HistoryModal onClose={() => setHistoryOpen(false)} />}
    </div>
  );
}

function HowStep({ emoji, title, desc }: { emoji: string; title: string; desc: string }) {
  return (
    <div>
      <div style={{ fontSize: 28, marginBottom: 8 }}>{emoji}</div>
      <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.5 }}>{desc}</div>
    </div>
  );
}

function AdvancedToggle({
  label, desc, checked, onChange,
}: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>{desc}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

// ─── Result view ────────────────────────────────────────────────────────────
function ResultView({ r, navigate, onReset }: { r: GenerateResult; navigate: any; onReset: () => void }) {
  const cancel = useServerFn(cancelPlanningRun);
  const [cancelling, setCancelling] = useState(false);

  const pct = Math.round(r.coverage_rate * 100);
  const pctColor = pct >= 80 ? "var(--success-text, #16a34a)" : pct >= 50 ? "var(--warning-text, #d97706)" : "var(--danger-text, #dc2626)";

  // mini-stats
  const employeesUsed = useMemo(() => {
    const set = new Set<string>();
    (r.solver_logs?.assignments ?? []).forEach((a: any) => { if (a?.user_id) set.add(a.user_id); });
    return set.size;
  }, [r]);
  const hoursTotal = useMemo(() => {
    return (r.solver_logs?.assignments ?? []).reduce((sum: number, a: any) => {
      if (!a?.start_time || !a?.end_time) return sum;
      const [sh, sm] = String(a.start_time).split(":").map(Number);
      const [eh, em] = String(a.end_time).split(":").map(Number);
      return sum + Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60);
    }, 0);
  }, [r]);

  const doCancel = async () => {
    if (!confirm("Supprimer tous les shifts générés par ce run ? (les shifts manuels et publiés sont conservés)")) return;
    setCancelling(true);
    try {
      const res: any = await cancel({ data: { run_id: r.planning_run_id } });
      toast.success(`${res.deleted} shifts supprimés`);
      onReset();
    } catch (e: any) { toast.error(e?.message || "Erreur"); }
    finally { setCancelling(false); }
  };

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto pb-16">
      <Link to="/planning" className="inline-flex items-center gap-1" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
        <ArrowLeft size={12} /> Retour au planning
      </Link>
      <h1 style={{ fontSize: 28, fontWeight: 500, marginTop: 16, marginBottom: 32 }}>Résultat de la génération</h1>

      {/* Big stat */}
      <Card className="p-8 mb-6 rounded-2xl text-center">
        <div style={{ fontSize: 72, fontWeight: 300, color: pctColor, lineHeight: 1 }}>{pct}%</div>
        <div style={{ fontSize: 14, color: "var(--muted-foreground)", marginTop: 8 }}>
          {r.shifts_generated} shift{r.shifts_generated > 1 ? "s" : ""} généré{r.shifts_generated > 1 ? "s" : ""} sur {r.total_slots_needed} créneau{r.total_slots_needed > 1 ? "x" : ""} ouvert{r.total_slots_needed > 1 ? "s" : ""}
        </div>
      </Card>

      {/* Mini stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <MiniStat label="Employés utilisés" value={employeesUsed > 0 ? String(employeesUsed) : "—"} />
        <MiniStat label="Heures réparties" value={hoursTotal > 0 ? `${Math.round(hoursTotal)}h` : "—"} />
        <MiniStat label="Trous restants" value={String(r.holes.length)} />
      </div>

      {/* CTA buttons */}
      <div className="flex gap-3 mb-8">
        <button onClick={() => navigate({ to: "/planning" })}
          className="flex-1 rounded-2xl flex items-center justify-center gap-2"
          style={{ height: 48, fontSize: 14, fontWeight: 500, backgroundColor: "var(--primary)", color: "var(--primary-foreground)", border: "none" }}>
          Voir le planning
        </button>
        <button onClick={onReset}
          className="flex-1 rounded-2xl"
          style={{ height: 48, fontSize: 14, fontWeight: 500, backgroundColor: "var(--card)", color: "var(--foreground)", border: "0.5px solid var(--border)" }}>
          Régénérer
        </button>
      </div>

      {/* Holes (kept for ops, collapsed in a discreet card) */}
      {r.holes.length > 0 && (
        <Card className="p-5 mb-5 rounded-2xl">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={14} style={{ color: "var(--warning-text)" }} />
            <span style={{ fontSize: 13, fontWeight: 500 }}>{r.holes.length} trou{r.holes.length > 1 ? "s" : ""} non couvert{r.holes.length > 1 ? "s" : ""}</span>
          </div>
          <div className="flex flex-col gap-1.5 max-h-[320px] overflow-y-auto">
            {r.holes.slice(0, 50).map((h, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2 flex-wrap" style={{ backgroundColor: "var(--warning-bg)" }}>
                <span style={{ fontSize: 12, fontWeight: 500, minWidth: 110 }}>{new Date(h.date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}</span>
                <span style={{ fontSize: 12 }}>{h.start_time}–{h.end_time}</span>
                <span className="rounded-full px-1.5 py-0.5" style={{ fontSize: 10, fontWeight: 500, backgroundColor: "var(--muted)" }}>{h.business_role}</span>
                <span style={{ fontSize: 11 }}>{h.studio_name}</span>
                <span style={{ fontSize: 11, color: "var(--warning-text)", marginLeft: "auto" }}>{h.reason}</span>
              </div>
            ))}
            {r.holes.length > 50 && <div style={{ fontSize: 11, color: "var(--muted-foreground)", padding: 8 }}>+ {r.holes.length - 50} autres</div>}
          </div>
        </Card>
      )}

      {/* Alerts */}
      {r.alerts.length > 0 && (
        <Card className="p-5 mb-5 rounded-2xl">
          <div className="flex items-center gap-2 mb-3">
            <Info size={14} />
            <span style={{ fontSize: 13, fontWeight: 500 }}>Alertes ({r.alerts.length})</span>
          </div>
          <div className="flex flex-col gap-1.5 max-h-[280px] overflow-y-auto">
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
        </Card>
      )}

      <WorkflowPanel runId={r.planning_run_id} />

      <div className="flex justify-end mt-5">
        <button onClick={doCancel} disabled={cancelling}
          className="rounded-md px-4 py-2"
          style={{ fontSize: 12, fontWeight: 500, color: "var(--danger-text)", border: "0.5px solid var(--border)" }}>
          {cancelling ? "Suppression…" : "Annuler cette génération"}
        </button>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl p-4" style={{ border: "0.5px solid var(--border)", backgroundColor: "var(--card)" }}>
      <div style={{ fontSize: 11, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 500 }}>{value}</div>
    </div>
  );
}

// ─── Workflow publication panel (preserved business logic) ──────────────────
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

  return (
    <Card className="p-5 mb-5 rounded-2xl">
      <div className="flex items-center gap-2 mb-3">
        <span style={{ fontSize: 13, fontWeight: 500 }}>Statut publication</span>
        <WorkflowBadge status={ws} />
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
          <Button variant="secondary" size="sm" disabled={busy}
            onClick={() => wrap(() => markReview({ data: { planning_run_id: runId } }), "Marqué pour validation")}>
            <Send size={14} /> Marquer pour validation
          </Button>
        )}
        {ws === "review" && (
          <>
            <Button size="sm" disabled={busy}
              onClick={() => wrap(() => publish({ data: { planning_run_id: runId } }), "Planning publié")}
              style={{ backgroundColor: "var(--success-text)", color: "#fff" }}>
              <Globe size={14} /> Publier
            </Button>
            <Button variant="outline" size="sm" disabled={busy}
              onClick={() => wrap(() => revert({ data: { planning_run_id: runId } }), "Retour en brouillon")}>
              <Undo2 size={14} /> Retour en brouillon
            </Button>
          </>
        )}
        {ws === "published" && (
          <Button variant="outline" size="sm" disabled={busy} onClick={() => setShowUnpub(true)}
            style={{ color: "var(--danger-text)", borderColor: "var(--danger-text)" }}>
            <ShieldAlert size={14} /> Dépublier
          </Button>
        )}
        {ws === "unpublished" && (
          <>
            <Button variant="secondary" size="sm" disabled={busy}
              onClick={() => wrap(() => markReview({ data: { planning_run_id: runId } }), "Re-soumis à validation")}>
              <Send size={14} /> Re-soumettre à validation
            </Button>
            <Button variant="outline" size="sm" disabled={busy}
              onClick={() => wrap(() => revert({ data: { planning_run_id: runId } }), "Retour en brouillon")}>
              <Undo2 size={14} /> Retour brouillon
            </Button>
          </>
        )}
      </div>

      <Dialog open={showUnpub} onOpenChange={setShowUnpub}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dépublier le planning</DialogTitle>
            <DialogDescription>
              Les shifts seront déverrouillés et repasseront en brouillon. L'historique de publication est conservé.
            </DialogDescription>
          </DialogHeader>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Raison de la dépublication (obligatoire)"
            className="w-full rounded-md p-2" style={{ fontSize: 13, border: "0.5px solid var(--border)", minHeight: 80 }} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUnpub(false)}>Annuler</Button>
            <Button disabled={busy || reason.trim().length < 3}
              onClick={async () => {
                await wrap(() => unpublish({ data: { planning_run_id: runId, reason: reason.trim() } }), "Planning dépublié");
                setShowUnpub(false); setReason("");
              }}
              style={{ backgroundColor: "var(--danger-text)", color: "#fff" }}>
              Confirmer la dépublication
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
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

// ─── History modal ──────────────────────────────────────────────────────────
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
      <div className="rounded-2xl bg-white w-full" style={{ maxWidth: 800, maxHeight: "85vh", overflow: "hidden", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
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
