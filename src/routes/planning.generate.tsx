import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Check, AlertTriangle, ArrowRight, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { generatePlanning } from "@/lib/generate-planning.functions";

export const Route = createFileRoute("/planning/generate")({
  component: GeneratePlanningPage,
  head: () => ({ meta: [{ title: "Générer le planning — Kadence" }] }),
});

const MONTHS_FR = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

interface GenerateResult {
  ok: boolean;
  error?: string;
  created: number;
  holes: number;
  totalRequired: number;
  candidatesPool: number;
  kpis: { coverage: number; equity: number; fairness: number };
  unfilled: { date: string; time: string; role: string; studio: string; reason: string }[];
  alerts: { name: string; detail: string; level: "danger" | "warning" }[];
}

function GeneratePlanningPage() {
  const navigate = useNavigate();
  const generate = useServerFn(generatePlanning);

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [state, setState] = useState<"idle" | "generating" | "done" | "error">("idle");
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const start = async () => {
    setState("generating");
    setErrorMsg("");
    try {
      const res = await generate({ data: { year, month, replaceExisting } });
      const r = res as GenerateResult;
      setResult(r);
      if (!r.ok) {
        setErrorMsg(r.error || "Erreur inconnue");
        setState("error");
      } else {
        setState("done");
        toast.success(`${r.created} shifts générés`);
      }
    } catch (e: any) {
      setErrorMsg(e?.message || "Erreur lors de la génération");
      setState("error");
    }
  };

  if (state === "idle") {
    return (
      <div className="p-4 md:p-6 flex items-center justify-center" style={{ minHeight: "calc(100vh - 52px)" }}>
        <div className="text-center w-full" style={{ maxWidth: 500 }}>
          <div className="rounded-full mx-auto flex items-center justify-center mb-6" style={{ width: 64, height: 64, backgroundColor: "var(--coral-light)" }}>
            <Sparkles size={28} style={{ color: "var(--coral-dark)" }} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 8 }}>Générer le planning</h1>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.7, marginBottom: 24 }}>
            L'IA crée tous les shifts du mois selon les besoins définis dans Réglages, avec les pondérations actuelles de l'algorithme.
          </p>

          <div className="flex gap-2 mb-4 justify-center flex-wrap">
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
              className="rounded-md px-3 py-2 outline-none"
              style={{ fontSize: 13, border: "0.5px solid var(--border)", backgroundColor: "var(--card)" }}>
              {MONTHS_FR.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))}
              className="rounded-md px-3 py-2 outline-none"
              style={{ fontSize: 13, border: "0.5px solid var(--border)", backgroundColor: "var(--card)" }}>
              {[today.getFullYear(), today.getFullYear() + 1].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <label className="flex items-center justify-center gap-2 mb-6 cursor-pointer" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
            <input type="checkbox" checked={replaceExisting} onChange={(e) => setReplaceExisting(e.target.checked)} />
            Remplacer les shifts existants de ce mois
          </label>

          <button onClick={start} className="rounded-md px-6 py-3 flex items-center gap-2 mx-auto transition-colors"
            style={{ fontSize: 14, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
            <Sparkles size={16} /> Lancer la génération
          </button>

          <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 16 }}>
            Astuce : configurez les besoins dans <Link to="/reglages" style={{ color: "var(--coral-dark)", textDecoration: "underline" }}>Réglages › Besoins par studio</Link>.
          </div>
        </div>
      </div>
    );
  }

  if (state === "generating") {
    return (
      <div className="p-4 md:p-6 flex items-center justify-center" style={{ minHeight: "calc(100vh - 52px)" }}>
        <div className="text-center" style={{ maxWidth: 360 }}>
          <div className="animate-pulse-dot rounded-full mx-auto flex items-center justify-center mb-4" style={{ width: 56, height: 56, backgroundColor: "var(--coral-light)" }}>
            <Sparkles size={24} style={{ color: "var(--coral-dark)" }} />
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 4 }}>Génération en cours…</h2>
          <p style={{ fontSize: 12, color: "var(--muted-foreground)" }}>L'IA assigne les meilleurs employés à chaque créneau.</p>
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

  // Done
  const r = result!;
  return (
    <div className="p-4 md:p-6">
      <div className="text-center mb-8">
        <div className="rounded-full mx-auto flex items-center justify-center mb-4" style={{ width: 56, height: 56, backgroundColor: "var(--success-bg)" }}>
          <Check size={28} style={{ color: "var(--success-text)" }} />
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 4 }}>Planning généré avec succès</h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>{MONTHS_FR[month]} {year} · {r.created} shifts créés sur {r.totalRequired} requis</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <ResultKpi label="Taux de couverture" value={`${r.kpis.coverage}%`} sub={`${r.created} / ${r.totalRequired}`} color={r.kpis.coverage >= 95 ? "var(--success-text)" : "var(--warning-text)"} />
        <ResultKpi label="Score équité" value={String(r.kpis.equity)} sub="/10" />
        <ResultKpi label="Employés mobilisés" value={String(r.kpis.fairness)} sub={`/ ${r.candidatesPool}`} />
        <ResultKpi label="Trous restants" value={String(r.holes)} sub={r.holes === 0 ? "complet" : "à combler"} color={r.holes === 0 ? "var(--success-text)" : "var(--warning-text)"} />
      </div>

      {r.unfilled.length > 0 && (
        <div className="rounded-xl border p-5 mb-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={14} style={{ color: "var(--warning-text)" }} />
            <span style={{ fontSize: 13, fontWeight: 500 }}>{r.holes} shift{r.holes > 1 ? "s" : ""} non attribué{r.holes > 1 ? "s" : ""}</span>
          </div>
          <div className="flex flex-col gap-2">
            {r.unfilled.map((s, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2 flex-wrap" style={{ backgroundColor: "var(--warning-bg)" }}>
                <span style={{ fontSize: 12, fontWeight: 500, minWidth: 110 }}>{new Date(s.date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}</span>
                <span style={{ fontSize: 12 }}>{s.time}</span>
                <span className="rounded-full px-1.5 py-0.5" style={{ fontSize: 10, fontWeight: 500, backgroundColor: "var(--muted)" }}>{s.role}</span>
                <span style={{ fontSize: 11 }}>{s.studio}</span>
                <span style={{ fontSize: 11, color: "var(--warning-text)", marginLeft: "auto" }}>{s.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {r.alerts.length > 0 && (
        <div className="rounded-xl border p-5 mb-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={14} style={{ color: "var(--coral-dark)" }} />
            <span style={{ fontSize: 13, fontWeight: 500 }}>Points d'attention</span>
          </div>
          <div className="flex flex-col gap-2">
            {r.alerts.map((a, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2 flex-wrap" style={{ backgroundColor: a.level === "danger" ? "var(--danger-bg)" : "var(--warning-bg)" }}>
                <span style={{ fontSize: 12, fontWeight: 500 }}>{a.name}</span>
                <span style={{ fontSize: 11, color: a.level === "danger" ? "var(--danger-text)" : "var(--warning-text)" }}>{a.detail}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-center gap-3 flex-wrap">
        <button onClick={() => navigate({ to: "/planning" })}
          className="rounded-md px-6 py-3 flex items-center gap-2 transition-colors"
          style={{ fontSize: 14, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
          Voir dans le planning <ArrowRight size={16} />
        </button>
        <button onClick={() => { setState("idle"); setResult(null); }}
          className="rounded-md px-6 py-3 flex items-center gap-2 transition-colors"
          style={{ fontSize: 14, fontWeight: 500, border: "0.5px solid var(--border)" }}>
          Relancer
        </button>
      </div>
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
