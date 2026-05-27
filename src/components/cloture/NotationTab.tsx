import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, AlertTriangle, Leaf, Scale, Target, Info } from "lucide-react";
import {
  getScoringSettings,
  setScoringProfile,
  updateScoringRule,
  updateScoringWeights,
  simulateScoring,
  recalcAllScoresWithNewRules,
} from "@/lib/scoring-rules.functions";
import {
  applyScoringRules,
  type ScoringRules,
  type ShiftScenario,
} from "@/lib/scoring-shared";

type Settings = Awaited<ReturnType<typeof getScoringSettings>>;

const SCENARIOS: { key: string; label: string; sub: string; scenario: ShiftScenario }[] = [
  { key: "excellent", label: "Excellent shift", sub: "Pile à l'heure · checklist 100% · toutes photos validées",
    scenario: { lateMin: 0, checklistPct: 100, photosValidatedPct: 100 } },
  { key: "average", label: "Shift moyen", sub: "15 min de retard · checklist 80% · 2/3 photos validées",
    scenario: { lateMin: 15, checklistPct: 80, photosValidatedPct: 66, missedItems: 2, refusedPhotos: 1 } },
  { key: "bad", label: "Shift problématique", sub: "35 min de retard · checklist 50% · 1/3 photos validées",
    scenario: { lateMin: 35, checklistPct: 50, photosValidatedPct: 33, missedItems: 5, refusedPhotos: 2 } },
];

export function NotationTab() {
  const qc = useQueryClient();
  const fetchSettings = useServerFn(getScoringSettings);
  const fetchSim = useServerFn(simulateScoring);
  const callSetProfile = useServerFn(setScoringProfile);
  const callUpdateRule = useServerFn(updateScoringRule);
  const callUpdateWeights = useServerFn(updateScoringWeights);
  const callRecalc = useServerFn(recalcAllScoresWithNewRules);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["scoring_settings"],
    queryFn: () => fetchSettings(),
  });
  const { data: sim } = useQuery({
    queryKey: ["scoring_sim"],
    queryFn: () => fetchSim(),
  });

  const [local, setLocal] = useState<Settings | null>(null);
  useEffect(() => { if (settings) setLocal(settings as any); }, [settings]);

  const recalcTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueRecalc = () => {
    if (recalcTimer.current) clearTimeout(recalcTimer.current);
    recalcTimer.current = setTimeout(async () => {
      const id = toast.loading("Recalcul des scores…");
      try {
        await callRecalc();
        toast.success("Scores mis à jour", { id });
        qc.invalidateQueries({ queryKey: ["scoring_sim"] });
      } catch (e: any) {
        toast.error(e.message ?? "Erreur recalcul", { id });
      }
    }, 1500);
  };

  if (isLoading || !local) {
    return <div className="p-6" style={{ color: "var(--muted-foreground)", fontSize: 13 }}>Chargement…</div>;
  }

  const rules: ScoringRules = local as any;

  const applyProfile = async (profile: "bienveillant" | "equilibre" | "exigeant") => {
    try {
      await callSetProfile({ data: { profile } });
      await qc.invalidateQueries({ queryKey: ["scoring_settings"] });
      queueRecalc();
    } catch (e: any) { toast.error(e.message); }
  };

  const updateField = async (field: string, value: any) => {
    setLocal((prev) => prev ? { ...prev, [field]: value, profile_name: "personnalise" } as any : prev);
    try {
      await callUpdateRule({ data: { field, value } });
      await qc.invalidateQueries({ queryKey: ["scoring_settings"] });
      queueRecalc();
    } catch (e: any) { toast.error(e.message); }
  };

  const updateWeights = async (next: { weight_punctuality: number; weight_checklist: number; weight_photos: number }) => {
    setLocal((prev) => prev ? { ...prev, ...next, profile_name: "personnalise" } as any : prev);
    try {
      await callUpdateWeights({ data: next });
      await qc.invalidateQueries({ queryKey: ["scoring_settings"] });
      queueRecalc();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleWeightChange = (axis: "weight_punctuality"|"weight_checklist"|"weight_photos", value: number) => {
    const v = Math.max(0, Math.min(100, Math.round(value)));
    const others = (["weight_punctuality","weight_checklist","weight_photos"] as const).filter(k => k !== axis);
    const currentOthersSum = (rules as any)[others[0]] + (rules as any)[others[1]];
    const remain = 100 - v;
    let a: number, b: number;
    if (currentOthersSum === 0) { a = Math.floor(remain / 2); b = remain - a; }
    else {
      a = Math.round((rules as any)[others[0]] / currentOthersSum * remain);
      b = remain - a;
    }
    const next: any = { weight_punctuality: rules.weight_punctuality, weight_checklist: rules.weight_checklist, weight_photos: rules.weight_photos };
    next[axis] = v;
    next[others[0]] = a;
    next[others[1]] = b;
    updateWeights(next);
  };

  return (
    <div>
      <div
        className="mb-5 rounded-md px-4 py-3 flex gap-2 items-start"
        style={{ backgroundColor: "color-mix(in oklab, #60a5fa 10%, white)", borderLeft: "3px solid #60a5fa", fontSize: 12, lineHeight: 1.6 }}
      >
        <Info size={14} style={{ marginTop: 2, flexShrink: 0, color: "#60a5fa" }} />
        <span>
          Ces règles déterminent comment les actions de clôture (ponctualité, checklist, photos) sont notées.
          Un changement met à jour le score de toute l'équipe en temps réel.
        </span>
      </div>

      <div className="grid gap-6" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,420px)" }}>
        <div className="space-y-6 min-w-0">
          <Card title="Style de management" subtitle="Choisis un profil ou personnalise selon ton équipe.">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <ProfileCard
                icon={<Leaf size={18} strokeWidth={1.8} />}
                title="Bienveillant"
                desc="Tolérance élevée, pas de pénalité"
                active={local.profile_name === "bienveillant"}
                onClick={() => applyProfile("bienveillant")}
              />
              <ProfileCard
                icon={<Scale size={18} strokeWidth={1.8} />}
                title="Équilibré"
                desc="Équilibre exigence / bienveillance"
                active={local.profile_name === "equilibre"}
                onClick={() => applyProfile("equilibre")}
              />
              <ProfileCard
                icon={<Target size={18} strokeWidth={1.8} />}
                title="Exigeant"
                desc="Standards élevés, écarts pénalisés"
                active={local.profile_name === "exigeant"}
                onClick={() => applyProfile("exigeant")}
              />
            </div>
            {local.profile_name === "personnalise" && (
              <div className="mt-3" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                Configuration personnalisée active.
              </div>
            )}
          </Card>

          <Card title="Ajuster en détail" subtitle="Optionnel — affine selon ton contexte.">
            <RadioRow
              label="Tolérance aux retards"
              value={local.punctuality_tolerance}
              options={[
                { v: "forte", l: "Forte" },
                { v: "moyenne", l: "Moyenne" },
                { v: "faible", l: "Faible" },
              ]}
              onChange={(v) => updateField("punctuality_tolerance", v)}
            />
            <RadioRow
              label="Strictesse sur les checklists"
              value={local.checklist_strictness}
              options={[
                { v: "faible", l: "Faible" },
                { v: "moyenne", l: "Moyenne" },
                { v: "forte", l: "Forte" },
              ]}
              onChange={(v) => updateField("checklist_strictness", v)}
            />
            <RadioRow
              label="Importance des photos"
              value={local.photos_importance}
              options={[
                { v: "facultatif", l: "Facultatif" },
                { v: "important", l: "Important" },
                { v: "critique", l: "Critique" },
              ]}
              onChange={(v) => updateField("photos_importance", v)}
            />
          </Card>

          <Card title="Quelle dimension compte le plus ?" subtitle="Les 3 axes s'auto-équilibrent à 100%.">
            <WeightSlider label="Ponctualité" value={rules.weight_punctuality}
              onChange={(v) => handleWeightChange("weight_punctuality", v)} />
            <WeightSlider label="Checklist" value={rules.weight_checklist}
              onChange={(v) => handleWeightChange("weight_checklist", v)} />
            <WeightSlider label="Note manager" value={rules.weight_photos}
              onChange={(v) => handleWeightChange("weight_photos", v)} />
          </Card>

          <ExpertMode
            unlocked={local.expert_mode_unlocked}
            rules={rules}
            onToggle={(v) => updateField("expert_mode_unlocked", v)}
            onChange={(field, value) => updateField(field, value)}
          />
        </div>

        <div className="space-y-4 min-w-0">
          <Card title="Aperçu avec ces règles" subtitle="Calculé en direct depuis ta configuration.">
            {SCENARIOS.map((s) => {
              const pts = applyScoringRules(rules, s.scenario);
              const pct = Math.max(0, Math.min(10, pts)) * 10;
              const tone = pts >= 8 ? "excellent" : pts >= 5 ? "correct" : "à améliorer";
              const color = pts >= 8 ? "var(--coral)" : pts >= 5 ? "var(--muted-foreground)" : "var(--danger-text, #b94c4c)";
              return (
                <div key={s.key} className="mb-4 last:mb-0">
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{s.label}</div>
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 6 }}>{s.sub}</div>
                  <div style={{ fontSize: 18, fontWeight: 500, color }}>
                    +{pts.toFixed(1)} <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>pts ({tone})</span>
                  </div>
                  <div style={{ height: 6, background: "var(--muted)", borderRadius: 999, marginTop: 6, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: color, transition: "width .25s" }} />
                  </div>
                </div>
              );
            })}
          </Card>

          <Card title="Impact sur ton équipe" subtitle="Calculé sur les 30 derniers jours.">
            {sim?.teamAvg !== null && sim?.teamAvg !== undefined ? (
              <>
                <div style={{ fontSize: 24, fontWeight: 500 }}>
                  {sim.teamAvg.toFixed(1)} <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>/ 10</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                  Score moyen ({sim.teamCount} employé{sim.teamCount > 1 ? "s" : ""})
                </div>
                {sim.below5.length > 0 && (
                  <div className="mt-3 p-2 rounded" style={{ background: "color-mix(in oklab, var(--coral) 10%, transparent)", fontSize: 12 }}>
                    <AlertTriangle size={13} className="inline mr-1" />
                    {sim.below5.length} employé{sim.below5.length > 1 ? "s passeraient" : " passerait"} sous 5/10
                    {" "}({sim.below5.slice(0, 3).join(", ")}{sim.below5.length > 3 ? "…" : ""})
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Pas encore de données.</div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 2 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 14 }}>{subtitle}</div>}
      {children}
    </div>
  );
}

function ProfileCard({ icon, title, desc, active, onClick }: { icon: React.ReactNode; title: string; desc: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-left rounded-lg border p-3 transition-colors"
      style={{
        borderColor: active ? "var(--coral)" : "var(--border)",
        background: active ? "color-mix(in oklab, var(--coral) 6%, var(--card))" : "transparent",
      }}
    >
      <div className="flex items-center gap-2 mb-1" style={{ color: active ? "var(--coral)" : "var(--foreground)" }}>
        {icon}
        <span style={{ fontSize: 13, fontWeight: 500 }}>{title}</span>
        {active && <span style={{ fontSize: 10, color: "var(--muted-foreground)", marginLeft: "auto" }}>actuel</span>}
      </div>
      <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{desc}</div>
    </button>
  );
}

function RadioRow({ label, value, options, onChange }: { label: string; value: string; options: { v: string; l: string }[]; onChange: (v: string) => void }) {
  return (
    <div className="mb-4 last:mb-0">
      <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 6 }}>{label}</div>
      <div className="flex gap-2 flex-wrap">
        {options.map((o) => {
          const active = value === o.v;
          return (
            <button key={o.v} onClick={() => onChange(o.v)}
              className="px-3 py-1.5 rounded-md border transition-colors"
              style={{
                fontSize: 12,
                fontWeight: active ? 500 : 400,
                borderColor: active ? "var(--coral)" : "var(--border)",
                background: active ? "color-mix(in oklab, var(--coral) 8%, var(--card))" : "transparent",
                color: active ? "var(--coral)" : "var(--foreground)",
              }}
            >{o.l}</button>
          );
        })}
      </div>
    </div>
  );
}

function WeightSlider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex justify-between mb-1" style={{ fontSize: 12 }}>
        <span style={{ color: "var(--muted-foreground)" }}>{label}</span>
        <span style={{ fontWeight: 500 }}>{value}%</span>
      </div>
      <input
        type="range" min={0} max={100} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: "var(--coral)" }}
      />
    </div>
  );
}

function ExpertMode({ unlocked, rules, onToggle, onChange }: {
  unlocked: boolean;
  rules: ScoringRules;
  onToggle: (v: boolean) => void;
  onChange: (field: string, value: number) => void;
}) {
  return (
    <div className="rounded-xl border" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      <button onClick={() => onToggle(!unlocked)}
        className="w-full flex items-center justify-between p-4"
        style={{ fontSize: 13, fontWeight: 500 }}>
        <span>Mode expert — barèmes bruts</span>
        {unlocked ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {unlocked && (
        <div className="px-5 pb-5 border-t" style={{ borderColor: "var(--border)" }}>
          <div className="mt-3 mb-4 p-2 rounded flex gap-2" style={{ background: "color-mix(in oklab, var(--coral) 10%, transparent)", fontSize: 12 }}>
            <AlertTriangle size={14} />
            <span>Mode avancé. Les chiffres directs influencent le score brut. Vérifie le simulateur à droite avant de sauvegarder.</span>
          </div>
          <Section title="Ponctualité">
            <NumRow label="0 min de retard" value={rules.punct_0min} onChange={(v) => onChange("punct_0min", v)} />
            <NumRow label="≤ 5 min" value={rules.punct_5min} onChange={(v) => onChange("punct_5min", v)} />
            <NumRow label="≤ 15 min" value={rules.punct_15min} onChange={(v) => onChange("punct_15min", v)} />
            <NumRow label="≤ 30 min" value={rules.punct_30min} onChange={(v) => onChange("punct_30min", v)} />
            <NumRow label="> 30 min" value={rules.punct_over} onChange={(v) => onChange("punct_over", v)} />
            <NumRow label="No-show" value={rules.punct_noshow} onChange={(v) => onChange("punct_noshow", v)} />
          </Section>
          <Section title="Checklist">
            <NumRow label="Complète à 100%" value={rules.checklist_complete} onChange={(v) => onChange("checklist_complete", v)} />
            <NumRow label="Bonus par item photo OK" value={rules.checklist_bonus_per_photo_item} step={0.5} onChange={(v) => onChange("checklist_bonus_per_photo_item", v)} />
            <NumRow label="Pénalité par item manqué" value={rules.checklist_penalty_per_missed} onChange={(v) => onChange("checklist_penalty_per_missed", v)} />
          </Section>
          <Section title="Photos">
            <NumRow label="Toutes photos validées" value={rules.photos_all_validated} onChange={(v) => onChange("photos_all_validated", v)} />
            <NumRow label="Pénalité par photo refusée" value={rules.photos_penalty_per_refused} onChange={(v) => onChange("photos_penalty_per_refused", v)} />
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 last:mb-0">
      <div style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted-foreground)", marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

function NumRow({ label, value, step, onChange }: { label: string; value: number; step?: number; onChange: (v: number) => void }) {
  const [v, setV] = useState(String(value));
  useEffect(() => { setV(String(value)); }, [value]);
  return (
    <div className="flex items-center justify-between mb-2">
      <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{label}</span>
      <input
        type="number" step={step ?? 1} value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => { const n = Number(v); if (!Number.isNaN(n) && n !== value) onChange(n); }}
        style={{
          width: 70, fontSize: 13, padding: "4px 8px", borderRadius: 6,
          border: "1px solid var(--border)", background: "var(--background)", textAlign: "right",
        }}
      />
    </div>
  );
}
