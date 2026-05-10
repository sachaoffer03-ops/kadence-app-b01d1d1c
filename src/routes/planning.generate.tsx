import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles, Check, AlertTriangle, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/planning/generate")({
  component: GeneratePlanningPage,
  head: () => ({ meta: [{ title: "Générer le planning — Shyft" }] }),
});

const steps = [
  { label: 'Chargement des disponibilités', duration: 800 },
  { label: 'Analyse des besoins studios', duration: 600 },
  { label: 'Vérification des quotas étudiants', duration: 700 },
  { label: 'Application des règles légales', duration: 500 },
  { label: 'Optimisation par score & équité', duration: 900 },
  { label: 'Résolution des conflits', duration: 600 },
  { label: 'Vérification des contraintes de repos', duration: 400 },
  { label: 'Finalisation du planning', duration: 500 },
];

function GeneratePlanningPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<'idle' | 'generating' | 'done'>('idle');
  const [currentStep, setCurrentStep] = useState(0);
  const [published, setPublished] = useState(false);

  const handlePublish = () => {
    setPublished(true);
    toast.success("Planning de juin publié — 28 employés notifiés");
    setTimeout(() => navigate({ to: "/planning" }), 800);
  };


  const startGeneration = async () => {
    setState('generating');
    for (let i = 0; i < steps.length; i++) {
      setCurrentStep(i);
      await new Promise(r => setTimeout(r, steps[i].duration));
    }
    setState('done');
  };

  if (state === 'idle') {
    return (
      <div className="p-6 flex items-center justify-center" style={{ minHeight: "calc(100vh - 52px)" }}>
        <div className="text-center" style={{ maxWidth: 500 }}>
          <div className="rounded-full mx-auto flex items-center justify-center mb-6" style={{ width: 64, height: 64, backgroundColor: "var(--coral-light)" }}>
            <Sparkles size={28} style={{ color: "var(--coral-dark)" }} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 8 }}>Générer le planning de juin 2026</h1>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.7, marginBottom: 24 }}>
            L'IA va créer le planning du mois en tenant compte des disponibilités, des besoins studios, des scores de performance et des contraintes légales belges.
          </p>
          <div className="flex flex-col gap-2 mb-8 text-left mx-auto" style={{ maxWidth: 360 }}>
            <CheckItem label="28 employés · 22 avec disponibilités" />
            <CheckItem label="2 studios configurés" />
            <CheckItem label="4 exceptions prises en compte" />
            <CheckItem label="Estimation : ~45 secondes" />
          </div>
          <button onClick={startGeneration} className="rounded-md px-6 py-3 flex items-center gap-2 mx-auto transition-colors" style={{ fontSize: 14, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
            <Sparkles size={16} /> Lancer la génération
          </button>
        </div>
      </div>
    );
  }

  if (state === 'generating') {
    return (
      <div className="p-6 flex items-center justify-center" style={{ minHeight: "calc(100vh - 52px)" }}>
        <div style={{ maxWidth: 500, width: "100%" }}>
          <div className="text-center mb-8">
            <div className="animate-pulse-dot rounded-full mx-auto flex items-center justify-center mb-4" style={{ width: 56, height: 56, backgroundColor: "var(--coral-light)" }}>
              <Sparkles size={24} style={{ color: "var(--coral-dark)" }} />
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 4 }}>Génération en cours...</h2>
            <p style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Ne fermez pas cette page</p>
          </div>

          <div className="flex flex-col gap-2">
            {steps.map((step, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg px-4 py-2.5" style={{
                backgroundColor: i === currentStep ? "var(--coral-light)" : i < currentStep ? "var(--success-bg)" : "var(--muted)",
                transition: "all 0.3s ease",
              }}>
                {i < currentStep ? (
                  <Check size={14} style={{ color: "var(--success-text)" }} />
                ) : i === currentStep ? (
                  <div className="animate-pulse-dot rounded-full" style={{ width: 8, height: 8, backgroundColor: "var(--coral)" }} />
                ) : (
                  <div className="rounded-full" style={{ width: 8, height: 8, backgroundColor: "var(--border)" }} />
                )}
                <span style={{
                  fontSize: 12,
                  fontWeight: i === currentStep ? 500 : 400,
                  color: i <= currentStep ? "var(--foreground)" : "var(--muted-foreground)",
                }}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <div style={{ width: "100%", height: 3, borderRadius: 2, backgroundColor: "var(--muted)" }}>
              <div style={{ width: `${((currentStep + 1) / steps.length) * 100}%`, height: "100%", borderRadius: 2, backgroundColor: "var(--coral)", transition: "width 0.5s ease" }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Done state
  return (
    <div className="p-6">
      <div className="text-center mb-8">
        <div className="rounded-full mx-auto flex items-center justify-center mb-4" style={{ width: 56, height: 56, backgroundColor: "var(--success-bg)" }}>
          <Check size={28} style={{ color: "var(--success-text)" }} />
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 4 }}>Planning généré avec succès</h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Juin 2026 · Skult Rhodes & Skult Châtelain</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <ResultKpi label="Taux de couverture" value="99%" sub="404 / 408 shifts" color="var(--success-text)" />
        <ResultKpi label="Score équité" value="8.7" sub="/10" />
        <ResultKpi label="Préférences respectées" value="94%" />
        <ResultKpi label="Quotas safe" value="100%" sub="aucun dépassement" color="var(--success-text)" />
      </div>

      {/* Unfilled shifts */}
      <div className="rounded-xl border p-5 mb-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle size={14} style={{ color: "var(--warning-text)" }} />
          <span style={{ fontSize: 13, fontWeight: 500 }}>4 shifts non attribués</span>
        </div>
        <div className="flex flex-col gap-2">
          {[
            { date: 'Lundi 1 juin', time: '17h — 23h', role: 'Host', studio: 'Rhodes', reason: 'Aucun Host disponible ce soir' },
            { date: 'Mercredi 10 juin', time: '07h — 12h', role: 'Cuisine', studio: 'Châtelain', reason: 'Thomas en congé, pas de remplacement possible' },
            { date: 'Samedi 20 juin', time: '14h — 19h', role: 'Barista', studio: 'Rhodes', reason: 'Tous les Baristas au quota max' },
            { date: 'Dimanche 28 juin', time: '10h — 15h', role: 'Accueil', studio: 'Châtelain', reason: 'Aucune dispo le dimanche' },
          ].map((s, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2" style={{ backgroundColor: "var(--warning-bg)" }}>
              <span style={{ fontSize: 12, fontWeight: 500, minWidth: 120 }}>{s.date}</span>
              <span style={{ fontSize: 12 }}>{s.time}</span>
              <span className="rounded-full px-1.5 py-0.5" style={{ fontSize: 10, fontWeight: 500, backgroundColor: "var(--muted)", color: "var(--foreground)" }}>{s.role}</span>
              <span style={{ fontSize: 11, color: "var(--warning-text)", marginLeft: "auto" }}>{s.reason}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Alerts */}
      <div className="rounded-xl border p-5 mb-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle size={14} style={{ color: "var(--coral-dark)" }} />
          <span style={{ fontSize: 13, fontWeight: 500 }}>Points d'attention</span>
        </div>
        <div className="flex flex-col gap-2">
          <AlertRow label="Léa Berger" detail="612h / 650h — 38h restantes seulement" level="danger" />
          <AlertRow label="Sofia De Smet" detail="487h / 650h — 6 shifts attribués ce mois" level="warning" />
          <AlertRow label="Axel De Vos" detail="0 shifts attribués — vérifier ses disponibilités" level="warning" />
        </div>
      </div>

      {/* Summary */}
      <div className="rounded-xl px-5 py-4 mb-6" style={{ backgroundColor: "var(--info-bg)" }}>
        <div style={{ fontSize: 12, color: "var(--info-text)", lineHeight: 1.6 }}>
          <span style={{ fontWeight: 500 }}>Résumé IA :</span> Planning optimisé pour 28 employés sur 30 jours. Distribution équitable avec une variation de 2 shifts max entre employés de même profil. 
          Les préférences de créneaux ont été respectées à 94%. Aucun conflit de repos 11h détecté. 2 étudiants proches du quota 650h ont été limités automatiquement.
        </div>
      </div>

      {/* CTA */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={handlePublish}
          disabled={published}
          className="rounded-md px-6 py-3 flex items-center gap-2 transition-colors"
          style={{
            fontSize: 14, fontWeight: 500,
            backgroundColor: published ? "var(--success-bg)" : "var(--foreground)",
            color: published ? "var(--success-text)" : "var(--card)",
            cursor: published ? "default" : "pointer",
          }}
        >
          {published ? <><Check size={16} /> Publié</> : <>Publier le planning <ArrowRight size={16} /></>}
        </button>
        <Link
          to="/planning"
          className="rounded-md px-6 py-3 flex items-center gap-2 transition-colors"
          style={{ fontSize: 14, fontWeight: 500, border: "0.5px solid var(--border)", textDecoration: "none", color: "var(--foreground)" }}
        >
          Voir dans le calendrier
        </Link>
      </div>
    </div>
  );
}

function CheckItem({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <Check size={14} style={{ color: "var(--success-text)" }} />
      <span style={{ fontSize: 12, color: "var(--foreground)" }}>{label}</span>
    </div>
  );
}

function ResultKpi({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      <div style={{ fontSize: 10, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{label}</div>
      <div className="flex items-baseline gap-1">
        <span style={{ fontSize: 22, fontWeight: 500, color: color || "var(--foreground)" }}>{value}</span>
        {sub && <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{sub}</span>}
      </div>
    </div>
  );
}

function AlertRow({ label, detail, level }: { label: string; detail: string; level: 'danger' | 'warning' }) {
  return (
    <div className="flex items-center gap-3 rounded-lg px-3 py-2" style={{ backgroundColor: level === 'danger' ? "var(--danger-bg)" : "var(--warning-bg)" }}>
      <span style={{ fontSize: 12, fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 11, color: level === 'danger' ? "var(--danger-text)" : "var(--warning-text)" }}>{detail}</span>
    </div>
  );
}
