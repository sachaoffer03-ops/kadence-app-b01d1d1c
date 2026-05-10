import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles, Puzzle, CreditCard, ScrollText, AlertTriangle, Lock } from "lucide-react";

export const Route = createFileRoute("/reglages")({
  component: ReglagesPage,
  head: () => ({ meta: [{ title: "Réglages — Shyft" }] }),
});

const tabs = [
  { id: 'ai', label: 'Algorithme IA', icon: Sparkles },
  { id: 'integrations', label: 'Intégrations', icon: Puzzle },
  { id: 'billing', label: 'Facturation', icon: CreditCard },
  { id: 'logs', label: 'Logs', icon: ScrollText },
  { id: 'danger', label: 'Zone dangereuse', icon: AlertTriangle },
] as const;

function ReglagesPage() {
  const [activeTab, setActiveTab] = useState<string>('ai');

  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 style={{ fontSize: 18, fontWeight: 500, marginBottom: 2 }}>Réglages</h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Configuration générale de Shyft.</p>
      </div>

      <div className="flex gap-6">
        {/* Vertical tabs */}
        <div className="flex flex-col gap-1 shrink-0" style={{ width: 200 }}>
          {tabs.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-md text-left transition-colors"
                style={{
                  fontSize: 13,
                  fontWeight: isActive ? 500 : 400,
                  backgroundColor: isActive ? "var(--muted)" : "transparent",
                  color: tab.id === 'danger' ? "var(--danger-text)" : isActive ? "var(--foreground)" : "var(--muted-foreground)",
                }}
              >
                <tab.icon size={15} strokeWidth={1.8} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1">
          {activeTab === 'ai' ? <AISettings /> : (
            <div className="rounded-xl border p-8 text-center" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>
                {tabs.find(t => t.id === activeTab)?.label}
              </div>
              <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Bientôt disponible</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AISettings() {
  const [weights, setWeights] = useState({ performance: 40, fairness: 30, preference: 20, random: 10 });

  const updateWeight = (key: keyof typeof weights, val: number) => {
    const clamped = Math.max(0, Math.min(100, val));
    setWeights(prev => ({ ...prev, [key]: clamped }));
  };

  const total = Object.values(weights).reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-col gap-5">
      {/* Weights */}
      <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Pondération de l'algorithme</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Ajustez l'importance relative de chaque critère</div>
          </div>
          <span className="rounded-full px-2.5 py-1" style={{
            fontSize: 11, fontWeight: 500,
            backgroundColor: total === 100 ? "var(--success-bg)" : "var(--danger-bg)",
            color: total === 100 ? "var(--success-text)" : "var(--danger-text)",
          }}>
            Total : {total}%
          </span>
        </div>

        <div className="flex flex-col gap-4">
          <WeightSlider label="Score de performance" value={weights.performance} onChange={v => updateWeight('performance', v)} description="Privilégie les employés les mieux notés" />
          <WeightSlider label="Équité de distribution" value={weights.fairness} onChange={v => updateWeight('fairness', v)} description="Répartit les shifts de manière équitable" />
          <WeightSlider label="Respect des préférences" value={weights.preference} onChange={v => updateWeight('preference', v)} description="Respecte les créneaux préférés" />
          <WeightSlider label="Variation aléatoire" value={weights.random} onChange={v => updateWeight('random', v)} description="Introduit de la diversité dans les attributions" />
        </div>
      </div>

      {/* Hard rules */}
      <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Règles strictes</div>
        <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 16 }}>Contraintes légales et opérationnelles non négociables</div>

        <div className="flex flex-col gap-3">
          <RuleToggle label="Quota 650h étudiants" description="Ne jamais dépasser le plafond légal" locked enabled />
          <RuleToggle label="Repos minimum 11h" description="11h de repos entre deux shifts (législation belge)" locked enabled />
          <RuleToggle label="Maximum 38h/semaine (CDI)" description="Limite légale pour les contrats à durée indéterminée" enabled />
          <RuleToggle label="Préférences strictes" description="Ne jamais assigner en dehors des préférences déclarées" />
        </div>
      </div>
    </div>
  );
}

function WeightSlider({ label, value, onChange, description }: { label: string; value: number; onChange: (v: number) => void; description: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div>
          <span style={{ fontSize: 13, fontWeight: 500 }}>{label}</span>
          <span style={{ fontSize: 11, color: "var(--muted-foreground)", marginLeft: 8 }}>{description}</span>
        </div>
        <span style={{ fontSize: 14, fontWeight: 500, color: "var(--coral-dark)", minWidth: 40, textAlign: "right" }}>{value}%</span>
      </div>
      <input type="range" min={0} max={100} step={5} value={value} onChange={e => onChange(Number(e.target.value))}
        className="w-full" style={{ accentColor: "var(--coral)", height: 4 }}
      />
    </div>
  );
}

function RuleToggle({ label, description, locked, enabled: initialEnabled }: { label: string; description: string; locked?: boolean; enabled?: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled ?? false);

  return (
    <div className="flex items-center justify-between rounded-lg px-3 py-2.5" style={{ backgroundColor: "var(--muted)" }}>
      <div className="flex items-center gap-2">
        {locked && <Lock size={12} style={{ color: "var(--muted-foreground)" }} />}
        <div>
          <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{description}</div>
        </div>
      </div>
      <button
        onClick={() => !locked && setEnabled(!enabled)}
        className="rounded-full transition-colors"
        style={{
          width: 36, height: 20,
          backgroundColor: enabled ? "var(--coral)" : "var(--border)",
          opacity: locked ? 0.6 : 1,
          cursor: locked ? "not-allowed" : "pointer",
          position: "relative",
        }}
      >
        <span className="rounded-full absolute transition-all" style={{
          width: 16, height: 16, top: 2,
          left: enabled ? 18 : 2,
          backgroundColor: "#fff",
        }} />
      </button>
    </div>
  );
}
