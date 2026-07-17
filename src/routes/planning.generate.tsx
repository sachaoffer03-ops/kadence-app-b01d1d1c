import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Sparkles, ArrowLeft, ArrowRight, AlertCircle, Loader2, Check, X, Eye, History,
  Send, Globe, Undo2, ShieldAlert, AlertTriangle, Info, ChevronDown, ChevronRight,
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
interface GenShift {
  user_id: string | null;
  studio_id: string;
  business_role: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  status: string;
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
  shifts?: GenShift[];
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

  const [state, setState] = useState<"idle" | "generating" | "preview" | "published" | "error" | "comparing">("idle");
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [lastParams, setLastParams] = useState<any>(null);
  const [scenarioA, setScenarioA] = useState<{ result: GenerateResult; params: any; label: string } | null>(null);
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

  const runGenerate = async (opts: { real?: boolean; scenarioLabel?: string } = {}) => {
    setState("generating");
    setErrorMsg("");
    try {
      const monthStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const params = {
        month_start_date: monthStart,
        studio_ids: Array.from(selected),
        preserve_manual: preserveManual,
        preserve_locked: preserveLocked,
        dry_run: !opts.real ? true : dryRun,
        silent: !opts.real,
        whitelist_user_ids: Array.from(whitelist),
      };
      const res = await generate({ data: params });
      const r = res as GenerateResult;
      setResult(r);
      setLastParams(params);
      if (opts.real) {
        setState("published");
        toast.success(`Publié — ${r.shifts_generated} shifts créés (${Math.round(r.coverage_rate * 100)}%)`);
      } else if (scenarioA) {
        setState("comparing");
      } else {
        setState("preview");
        toast.success(`Aperçu prêt — ${Math.round(r.coverage_rate * 100)}% de couverture`);
      }
    } catch (e: any) {
      setErrorMsg(e?.message || "Erreur lors de la génération");
      setState("error");
    }
  };

  const publishCurrent = async () => {
    await runGenerate({ real: true });
  };

  const startCompare = () => {
    if (!result) return;
    setScenarioA({ result, params: lastParams, label: describeParams(lastParams, studios, employees) });
    setResult(null);
    setState("idle");
    toast.info("Modifie les paramètres pour le scénario B, puis clique sur Prévisualiser.");
  };

  const cancelCompare = () => {
    setScenarioA(null);
    setResult(null);
    setState("idle");
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

  // ─── Preview state (dry_run silent) ──────────────────────────────────────
  if (state === "preview" && result) {
    return (
      <PreviewView
        r={result}
        employees={employees}
        studios={studios}
        onPublish={publishCurrent}
        onReset={() => { setState("idle"); setResult(null); setLastParams(null); }}
        onCompare={startCompare}
      />
    );
  }

  // ─── Comparing state (scenario A vs scenario B) ──────────────────────────
  if (state === "comparing" && result && scenarioA) {
    return (
      <CompareView
        a={scenarioA}
        b={{ result, params: lastParams, label: describeParams(lastParams, studios, employees) }}
        onPublishA={async () => {
          setResult(scenarioA.result);
          setLastParams(scenarioA.params);
          await runGenerate({ real: true });
        }}
        onPublishB={publishCurrent}
        onCancel={cancelCompare}
      />
    );
  }

  // ─── Published state (real run) ──────────────────────────────────────────
  if (state === "published" && result) {
    return (
      <ResultView
        r={result}
        navigate={navigate}
        onReset={() => { setState("idle"); setResult(null); setScenarioA(null); setLastParams(null); }}
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

      {/* Employés prioritaires (whitelist) */}
      <Card className="p-6 mb-6 rounded-2xl">
        <button
          onClick={() => setWhitelistOpen((v) => !v)}
          className="w-full flex items-center justify-between"
          style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
        >
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 14, fontWeight: 500 }}>
              Employés prioritaires {whitelist.size > 0 && <span style={{ color: "var(--muted-foreground)", fontWeight: 400 }}>· {whitelist.size} sélectionné{whitelist.size > 1 ? "s" : ""}</span>}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>
              Optionnel — leurs dispos sont servies en premier, puis l'algo comble le reste.
            </div>
          </div>
          <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{whitelistOpen ? "Masquer" : "Configurer"}</span>
        </button>
        {whitelistOpen && (
          <div style={{ marginTop: 12, maxHeight: 320, overflowY: "auto", border: "0.5px solid var(--border)", borderRadius: 8 }}>
            {employees.length === 0 && (
              <div style={{ fontSize: 13, color: "var(--muted-foreground)", padding: 12 }}>Aucun employé.</div>
            )}
            {employees
              .filter((e) => selected.size === 0 || e.studio_ids.some((sid) => selected.has(sid)))
              .map((e) => {
                const on = whitelist.has(e.id);
                return (
                  <label key={e.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer"
                    style={{ fontSize: 13, borderBottom: "0.5px solid var(--border)", background: on ? "color-mix(in oklab, #16a34a 10%, transparent)" : "transparent" }}>
                    <Checkbox
                      checked={on}
                      onCheckedChange={() => setWhitelist((prev) => {
                        const n = new Set(prev);
                        if (n.has(e.id)) n.delete(e.id); else n.add(e.id);
                        return n;
                      })}
                    />
                    <span>{e.first_name} {e.last_name}</span>
                  </label>
                );
              })}
          </div>
        )}
      </Card>


      {/* Banner when building scenario B */}
      {scenarioA && (
        <div className="rounded-xl p-4 mb-4 flex items-center justify-between gap-3" style={{ backgroundColor: "var(--info-bg)", color: "var(--info-text)" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>Scénario B en préparation</div>
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>Scénario A : {scenarioA.label}</div>
          </div>
          <button onClick={cancelCompare} className="rounded-md px-3 py-1.5" style={{ fontSize: 12, backgroundColor: "var(--card)", color: "var(--foreground)", border: "0.5px solid var(--border)" }}>
            Annuler
          </button>
        </div>
      )}

      {/* Preview button */}
      <button
        onClick={() => runGenerate()}
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
        <Eye size={18} /> {scenarioA ? "Prévisualiser le scénario B" : "Prévisualiser"}
      </button>
      <p style={{ fontSize: 12, color: "var(--muted-foreground)", textAlign: "center", marginTop: 10 }}>
        Aucun shift n'est écrit tant que tu n'as pas cliqué sur « Publier ».
      </p>

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

// ─── Preview + Compare helpers ──────────────────────────────────────────────
function describeParams(
  params: any,
  studios: StudioInfo[],
  employees: Array<{ id: string; first_name: string; last_name: string }>,
): string {
  if (!params) return "—";
  const studioNames = (params.studio_ids ?? [])
    .map((id: string) => studios.find((s) => s.id === id)?.name)
    .filter(Boolean);
  const wl = (params.whitelist_user_ids ?? [])
    .map((id: string) => {
      const e = employees.find((x) => x.id === id);
      return e ? e.first_name : null;
    })
    .filter(Boolean);
  const bits: string[] = [];
  if (studioNames.length) bits.push(studioNames.join(" + "));
  if (wl.length) bits.push(`prioritaires : ${wl.join(", ")}`);
  return bits.length ? bits.join(" · ") : "config par défaut";
}

function summarizeResult(r: GenerateResult) {
  const pct = Math.round(r.coverage_rate * 100);
  const hours = (r.solver_logs?.assignments ?? []).reduce((sum: number, a: any) => {
    if (!a?.start_time || !a?.end_time) return sum;
    const [sh, sm] = String(a.start_time).split(":").map(Number);
    const [eh, em] = String(a.end_time).split(":").map(Number);
    return sum + Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60);
  }, 0);
  const employees = new Set<string>();
  (r.solver_logs?.assignments ?? []).forEach((a: any) => { if (a?.user_id) employees.add(a.user_id); });
  return { pct, holes: r.holes.length, hours: Math.round(hours), employees: employees.size };
}

function PreviewView({
  r, employees, studios, onPublish, onReset, onCompare,
}: {
  r: GenerateResult;
  employees: Array<{ id: string; first_name: string; last_name: string; studio_ids: string[] }>;
  studios: StudioInfo[];
  onPublish: () => void; onReset: () => void; onCompare: () => void;
}) {
  const s = summarizeResult(r);
  const pctColor = s.pct >= 80 ? "var(--success-text)" : s.pct >= 50 ? "var(--warning-text)" : "var(--danger-text)";
  const [publishing, setPublishing] = useState(false);

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto pb-16">
      <button onClick={onReset} className="inline-flex items-center gap-1" style={{ fontSize: 12, color: "var(--muted-foreground)", background: "transparent", border: "none", cursor: "pointer" }}>
        <ArrowLeft size={12} /> Modifier la config
      </button>
      <div className="flex items-center gap-2 mt-4">
        <Badge variant="outline" style={{ fontSize: 11, backgroundColor: "var(--info-bg)", color: "var(--info-text)", borderColor: "transparent" }}>
          <Eye size={11} style={{ marginRight: 4 }} /> Aperçu
        </Badge>
        <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Rien n'est enregistré pour l'instant</span>
      </div>
      <h1 style={{ fontSize: 28, fontWeight: 500, marginTop: 12, marginBottom: 24 }}>Voilà ce que ça donne</h1>

      <Card className="p-8 mb-5 rounded-2xl text-center">
        <div style={{ fontSize: 72, fontWeight: 300, color: pctColor, lineHeight: 1 }}>{s.pct}%</div>
        <div style={{ fontSize: 14, color: "var(--muted-foreground)", marginTop: 8 }}>
          {r.shifts_generated} shift{r.shifts_generated > 1 ? "s" : ""} placés sur {r.total_slots_needed} créneaux · {s.holes} trou{s.holes > 1 ? "s" : ""} restant{s.holes > 1 ? "s" : ""}
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <MiniStat label="Employés utilisés" value={s.employees > 0 ? String(s.employees) : "—"} />
        <MiniStat label="Heures réparties" value={s.hours > 0 ? `${s.hours}h` : "—"} />
        <MiniStat label="Trous restants" value={String(s.holes)} />
      </div>

      {/* Primary actions */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <button
          onClick={async () => { setPublishing(true); try { await onPublish(); } finally { setPublishing(false); } }}
          disabled={publishing}
          className="flex-1 rounded-2xl flex items-center justify-center gap-2"
          style={{ height: 52, fontSize: 15, fontWeight: 500, backgroundColor: "var(--primary)", color: "var(--primary-foreground)", border: "none", cursor: publishing ? "wait" : "pointer" }}
        >
          {publishing ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Publier ce plan
        </button>
        <button
          onClick={onReset}
          className="flex-1 rounded-2xl"
          style={{ height: 52, fontSize: 15, fontWeight: 500, backgroundColor: "var(--card)", color: "var(--foreground)", border: "0.5px solid var(--border)" }}
        >
          Refaire
        </button>
      </div>

      {/* Compare CTA */}
      <button
        onClick={onCompare}
        className="w-full rounded-xl mb-6 hover:underline"
        style={{ fontSize: 13, color: "var(--muted-foreground)", background: "transparent", border: "0.5px dashed var(--border)", padding: "12px 16px", cursor: "pointer" }}
      >
        Comparer avec une autre config →
      </button>

      {/* Aperçu visuel des shifts */}
      {r.shifts && r.shifts.length > 0 && (
        <PreviewWeekGrid shifts={r.shifts} employees={employees} studios={studios} />
      )}


      {/* Trous à combler */}
      {r.holes.length > 0 && (
        <Card className="p-5 mb-5 rounded-2xl">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={14} style={{ color: "var(--warning-text)" }} />
            <span style={{ fontSize: 13, fontWeight: 500 }}>{r.holes.length} trou{r.holes.length > 1 ? "s" : ""} à combler</span>
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
    </div>
  );
}

const DAYS_FR = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const ROLE_COLORS_PREVIEW: Record<string, string> = {
  Barista: "#F0997B",
  Accueil: "#3BAFA3",
  Host: "#A78BC7",
  Cuisine: "#E8A0BF",
};

function isoWeekKey(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = (d.getUTCDay() + 6) % 7;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - day);
  return monday.toISOString().slice(0, 10);
}

function PreviewWeekGrid({
  shifts, employees, studios,
}: {
  shifts: GenShift[];
  employees: Array<{ id: string; first_name: string; last_name: string }>;
  studios: StudioInfo[];
}) {
  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of employees) m.set(e.id, `${e.first_name} ${e.last_name[0] ?? ""}.`);
    return m;
  }, [employees]);
  const studioById = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of studios) m.set(s.id, s.name);
    return m;
  }, [studios]);

  const studioIds = useMemo(() => Array.from(new Set(shifts.map((s) => s.studio_id))), [shifts]);
  const [studioFilter, setStudioFilter] = useState<string>("all");

  const filtered = useMemo(
    () => (studioFilter === "all" ? shifts : shifts.filter((s) => s.studio_id === studioFilter)),
    [shifts, studioFilter],
  );

  const weeks = useMemo(() => {
    const byWeek = new Map<string, Map<string, GenShift[]>>();
    for (const sh of filtered) {
      const wk = isoWeekKey(sh.shift_date);
      if (!byWeek.has(wk)) byWeek.set(wk, new Map());
      const byDay = byWeek.get(wk)!;
      if (!byDay.has(sh.shift_date)) byDay.set(sh.shift_date, []);
      byDay.get(sh.shift_date)!.push(sh);
    }
    return Array.from(byWeek.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([wk, byDay]) => ({
        wk,
        days: Array.from(byDay.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, list]) => ({
            date,
            shifts: list.slice().sort((a, b) =>
              a.start_time.localeCompare(b.start_time) ||
              a.business_role.localeCompare(b.business_role),
            ),
          })),
      }));
  }, [filtered]);

  const [openWeeks, setOpenWeeks] = useState<Record<string, boolean>>({});
  useEffect(() => {
    setOpenWeeks((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      const next: Record<string, boolean> = {};
      weeks.slice(0, 1).forEach(({ wk }) => { next[wk] = true; });
      return next;
    });
  }, [weeks.length]);

  const fmtD = (d: Date) =>
    `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

  return (
    <Card className="p-5 mb-5 rounded-2xl">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <div style={{ fontSize: 13, fontWeight: 500 }}>Aperçu du planning</div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>
            {filtered.length} shift{filtered.length > 1 ? "s" : ""} · vue rapide, semaine par semaine
          </div>
        </div>
        <Link
          to="/planning"
          className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5"
          style={{ fontSize: 12, fontWeight: 500, color: "var(--primary)", border: "0.5px solid var(--border)", backgroundColor: "var(--card)" }}
        >
          Ouvrir Planning <ArrowRight size={12} />
        </Link>
      </div>

      {studioIds.length > 1 && (
        <div className="flex items-center gap-1 mb-4 rounded-lg p-1 self-start" style={{ backgroundColor: "var(--muted)", width: "fit-content" }}>
          <button
            onClick={() => setStudioFilter("all")}
            className="rounded-md px-3 py-1"
            style={{
              fontSize: 11, fontWeight: 500,
              backgroundColor: studioFilter === "all" ? "var(--card)" : "transparent",
              color: studioFilter === "all" ? "var(--foreground)" : "var(--muted-foreground)",
            }}
          >
            Tous
          </button>
          {studioIds.map((sid) => (
            <button
              key={sid}
              onClick={() => setStudioFilter(sid)}
              className="rounded-md px-3 py-1"
              style={{
                fontSize: 11, fontWeight: 500,
                backgroundColor: studioFilter === sid ? "var(--card)" : "transparent",
                color: studioFilter === sid ? "var(--foreground)" : "var(--muted-foreground)",
              }}
            >
              {studioById.get(sid) ?? "—"}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {weeks.map(({ wk, days }) => {
          const wkDate = new Date(wk + "T00:00:00");
          const end = new Date(wkDate);
          end.setUTCDate(wkDate.getUTCDate() + 6);
          const isOpen = !!openWeeks[wk];
          const totalShifts = days.reduce((sum, d) => sum + d.shifts.length, 0);
          const holes = days.reduce((sum, d) => sum + d.shifts.filter((s) => s.user_id === null).length, 0);
          return (
            <div key={wk} className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
              <button
                onClick={() => setOpenWeeks((p) => ({ ...p, [wk]: !p[wk] }))}
                className="w-full flex items-center justify-between px-4 py-2.5"
                style={{ backgroundColor: "transparent", border: "none", cursor: "pointer", borderBottom: isOpen ? "0.5px solid var(--border)" : "none" }}
              >
                <div className="flex items-center gap-2">
                  {isOpen ? <ChevronDown size={13} style={{ color: "var(--muted-foreground)" }} /> : <ChevronRight size={13} style={{ color: "var(--muted-foreground)" }} />}
                  <span style={{ fontSize: 12, fontWeight: 500 }}>Sem. du {fmtD(wkDate)} au {fmtD(end)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{totalShifts} shifts</span>
                  {holes > 0 && (
                    <span className="rounded-full px-1.5 py-0.5" style={{ fontSize: 10, fontWeight: 500, backgroundColor: "var(--warning-bg)", color: "var(--warning-text)" }}>
                      {holes} trou{holes > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </button>
              {isOpen && (
                <div>
                  {days.map(({ date, shifts: dayShifts }, di) => {
                    const d = new Date(date + "T00:00:00");
                    return (
                      <div key={date} style={{ display: "grid", gridTemplateColumns: "72px 1fr", borderTop: di === 0 ? "none" : "0.5px solid var(--border)" }}>
                        <div style={{ padding: "8px 10px", backgroundColor: "var(--background)", fontSize: 11 }}>
                          <div style={{ fontWeight: 500 }}>{DAYS_FR[d.getUTCDay()]}</div>
                          <div style={{ color: "var(--muted-foreground)" }}>{fmtD(d)}</div>
                        </div>
                        <div style={{ padding: "6px 8px", display: "flex", flexDirection: "column", gap: 3 }}>
                          {dayShifts.map((sh, i) => {
                            const hole = sh.user_id === null;
                            const color = ROLE_COLORS_PREVIEW[sh.business_role] ?? "#64748b";
                            const name = hole
                              ? "Trou"
                              : (sh.user_id && nameById.get(sh.user_id)) || "?";
                            const studioName = studioFilter === "all" && studioIds.length > 1 ? studioById.get(sh.studio_id) : null;
                            return (
                              <div key={i} style={{
                                display: "flex", alignItems: "center", gap: 8, fontSize: 12,
                                padding: "3px 6px", borderRadius: 4,
                                backgroundColor: hole ? "var(--warning-bg)" : "transparent",
                              }}>
                                <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                                <span style={{ fontFamily: "ui-monospace, monospace", color: "var(--muted-foreground)", minWidth: 92 }}>
                                  {sh.start_time.slice(0, 5)}–{sh.end_time.slice(0, 5)}
                                </span>
                                <span style={{ minWidth: 62, color: "var(--muted-foreground)" }}>{sh.business_role}</span>
                                <span style={{ fontWeight: hole ? 500 : 400, color: hole ? "var(--warning-text)" : "var(--foreground)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {name}
                                </span>
                                {studioName && (
                                  <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>{studioName}</span>
                                )}
                              </div>
                            );
                          })}
                          {dayShifts.length === 0 && (
                            <span style={{ fontSize: 11, color: "var(--muted-foreground)", padding: "3px 6px" }}>—</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}



function CompareView({
  a, b, onPublishA, onPublishB, onCancel,
}: {
  a: { result: GenerateResult; params: any; label: string };
  b: { result: GenerateResult; params: any; label: string };
  onPublishA: () => Promise<void>;
  onPublishB: () => Promise<void>;
  onCancel: () => void;
}) {
  const sa = summarizeResult(a.result);
  const sb = summarizeResult(b.result);
  // recommended: fewer holes wins; ties → higher coverage → more employees used
  const scoreA = -sa.holes * 1000 + sa.pct * 10 + sa.employees;
  const scoreB = -sb.holes * 1000 + sb.pct * 10 + sb.employees;
  const winner: "A" | "B" | null = scoreA === scoreB ? null : scoreA > scoreB ? "A" : "B";

  const [publishing, setPublishing] = useState<"A" | "B" | null>(null);

  const doPublish = async (which: "A" | "B") => {
    setPublishing(which);
    try {
      if (which === "A") await onPublishA(); else await onPublishB();
    } finally {
      setPublishing(null);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto pb-16">
      <button onClick={onCancel} className="inline-flex items-center gap-1" style={{ fontSize: 12, color: "var(--muted-foreground)", background: "transparent", border: "none", cursor: "pointer" }}>
        <ArrowLeft size={12} /> Recommencer
      </button>
      <h1 style={{ fontSize: 28, fontWeight: 500, marginTop: 16, marginBottom: 8 }}>Comparaison</h1>
      <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginBottom: 24 }}>
        Choisis le scénario que tu veux publier. L'autre sera oublié.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ScenarioCard
          title="Scénario A" label={a.label} s={sa} recommended={winner === "A"}
          onPublish={() => doPublish("A")} publishing={publishing === "A"} disabled={publishing !== null}
          holes={a.result.holes}
        />
        <ScenarioCard
          title="Scénario B" label={b.label} s={sb} recommended={winner === "B"}
          onPublish={() => doPublish("B")} publishing={publishing === "B"} disabled={publishing !== null}
          holes={b.result.holes}
        />
      </div>
    </div>
  );
}

function ScenarioCard({
  title, label, s, recommended, onPublish, publishing, disabled, holes,
}: {
  title: string; label: string;
  s: { pct: number; holes: number; hours: number; employees: number };
  recommended: boolean; onPublish: () => void; publishing: boolean; disabled: boolean;
  holes: Hole[];
}) {
  const pctColor = s.pct >= 80 ? "var(--success-text)" : s.pct >= 50 ? "var(--warning-text)" : "var(--danger-text)";
  return (
    <Card className="p-5 rounded-2xl" style={{ border: recommended ? "1.5px solid var(--success-text)" : "0.5px solid var(--border)" }}>
      <div className="flex items-center justify-between mb-1">
        <div style={{ fontSize: 14, fontWeight: 500 }}>{title}</div>
        {recommended && (
          <Badge style={{ fontSize: 10, backgroundColor: "var(--success-bg)", color: "var(--success-text)", borderColor: "transparent" }}>
            ★ Recommandé
          </Badge>
        )}
      </div>
      <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 16 }}>{label}</div>

      <div className="text-center mb-4">
        <div style={{ fontSize: 56, fontWeight: 300, color: pctColor, lineHeight: 1 }}>{s.pct}%</div>
        <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 4 }}>de couverture</div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="text-center rounded-lg p-2" style={{ backgroundColor: "var(--muted)" }}>
          <div style={{ fontSize: 18, fontWeight: 500, color: s.holes === 0 ? "var(--success-text)" : "var(--warning-text)" }}>{s.holes}</div>
          <div style={{ fontSize: 10, color: "var(--muted-foreground)" }}>Trous</div>
        </div>
        <div className="text-center rounded-lg p-2" style={{ backgroundColor: "var(--muted)" }}>
          <div style={{ fontSize: 18, fontWeight: 500 }}>{s.hours}h</div>
          <div style={{ fontSize: 10, color: "var(--muted-foreground)" }}>Heures</div>
        </div>
        <div className="text-center rounded-lg p-2" style={{ backgroundColor: "var(--muted)" }}>
          <div style={{ fontSize: 18, fontWeight: 500 }}>{s.employees}</div>
          <div style={{ fontSize: 10, color: "var(--muted-foreground)" }}>Employés</div>
        </div>
      </div>

      {holes.length > 0 && (
        <details style={{ marginBottom: 12 }}>
          <summary style={{ fontSize: 12, color: "var(--muted-foreground)", cursor: "pointer" }}>Voir les {holes.length} trou{holes.length > 1 ? "s" : ""}</summary>
          <div className="flex flex-col gap-1 mt-2 max-h-[200px] overflow-y-auto">
            {holes.slice(0, 20).map((h, i) => (
              <div key={i} style={{ fontSize: 11, padding: "4px 8px", backgroundColor: "var(--warning-bg)", borderRadius: 4 }}>
                {new Date(h.date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })} {h.start_time}–{h.end_time} · {h.business_role} · {h.studio_name}
              </div>
            ))}
            {holes.length > 20 && <div style={{ fontSize: 10, color: "var(--muted-foreground)" }}>+ {holes.length - 20} autres</div>}
          </div>
        </details>
      )}

      <button
        onClick={onPublish}
        disabled={disabled}
        className="w-full rounded-xl flex items-center justify-center gap-2"
        style={{
          height: 44, fontSize: 14, fontWeight: 500,
          backgroundColor: recommended ? "var(--success-text)" : "var(--primary)",
          color: "#fff", border: "none",
          cursor: disabled ? "wait" : "pointer",
          opacity: disabled && !publishing ? 0.5 : 1,
        }}
      >
        {publishing ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Publier ce scénario
      </button>
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
