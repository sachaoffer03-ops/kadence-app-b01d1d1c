import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Check, AlertTriangle, ArrowRight, AlertCircle, Info } from "lucide-react";
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

type Mode = "month" | "range";

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function plusDaysISO(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function GeneratePlanningPage() {
  const navigate = useNavigate();
  const generate = useServerFn(generatePlanning);

  const today = new Date();
  const [mode, setMode] = useState<Mode>("month");
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState(plusDaysISO(13));
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [state, setState] = useState<"idle" | "generating" | "done" | "error">("idle");
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const start = async () => {
    setState("generating");
    setErrorMsg("");
    try {
      const payload =
        mode === "month"
          ? { year, month, replaceExisting }
          : { startDate, endDate, replaceExisting };
      const res = await generate({ data: payload });
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
        <div className="text-center w-full" style={{ maxWidth: 520 }}>
          <div className="rounded-full mx-auto flex items-center justify-center mb-6" style={{ width: 64, height: 64, backgroundColor: "var(--coral-light)" }}>
            <Sparkles size={28} style={{ color: "var(--coral-dark)" }} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 8 }}>Générer le planning</h1>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.7, marginBottom: 16 }}>
            L'IA crée tous les shifts selon les besoins définis dans Réglages, avec les pondérations actuelles de l'algorithme.
          </p>

          <div className="rounded-lg p-3 mb-5 flex items-start gap-2 text-left" style={{ backgroundColor: "var(--info-bg)" }}>
            <Info size={14} style={{ color: "var(--info-text)", marginTop: 2, flexShrink: 0 }} />
            <div style={{ fontSize: 11, color: "var(--info-text)", lineHeight: 1.5 }}>
              Les besoins sont lus en direct au moment de la génération. Si tu modifies un créneau dans <Link to="/reglages" style={{ textDecoration: "underline" }}>Réglages › Besoins par studio</Link>, relance la génération sur la période concernée.
            </div>
          </div>

          {/* Toggle mode */}
          <div className="inline-flex rounded-md p-0.5 mb-4" style={{ border: "0.5px solid var(--border)", backgroundColor: "var(--muted)" }}>
            <button
              onClick={() => setMode("month")}
              className="rounded-[5px] px-4 py-1.5 transition-colors"
              style={{
                fontSize: 12,
                fontWeight: 500,
                backgroundColor: mode === "month" ? "var(--card)" : "transparent",
                color: mode === "month" ? "var(--foreground)" : "var(--muted-foreground)",
              }}
            >
              Mois entier
            </button>
            <button
              onClick={() => setMode("range")}
              className="rounded-[5px] px-4 py-1.5 transition-colors"
              style={{
                fontSize: 12,
                fontWeight: 500,
                backgroundColor: mode === "range" ? "var(--card)" : "transparent",
                color: mode === "range" ? "var(--foreground)" : "var(--muted-foreground)",
              }}
            >
              Période personnalisée
            </button>
          </div>

          {mode === "month" ? (
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
          ) : (
            <div className="flex gap-2 mb-4 justify-center flex-wrap items-center">
              <div className="flex flex-col items-start gap-1">
                <label style={{ fontSize: 10, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Du</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                  className="rounded-md px-3 py-2 outline-none"
                  style={{ fontSize: 13, border: "0.5px solid var(--border)", backgroundColor: "var(--card)" }} />
              </div>
              <div className="flex flex-col items-start gap-1">
                <label style={{ fontSize: 10, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Au</label>
                <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)}
                  className="rounded-md px-3 py-2 outline-none"
                  style={{ fontSize: 13, border: "0.5px solid var(--border)", backgroundColor: "var(--card)" }} />
              </div>
            </div>
          )}

          <label className="flex items-center justify-center gap-2 mb-6 cursor-pointer" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
            <input type="checkbox" checked={replaceExisting} onChange={(e) => setReplaceExisting(e.target.checked)} />
            Remplacer les shifts existants sur cette période
          </label>

          <button onClick={start} className="rounded-md px-6 py-3 flex items-center gap-2 mx-auto transition-colors"
            style={{ fontSize: 14, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
            <Sparkles size={16} /> Lancer la génération
          </button>
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
  const periodLabel = mode === "month" ? `${MONTHS_FR[month]} ${year}` : `${startDate} → ${endDate}`;
  return (
    <div className="p-4 md:p-6">
      <div className="text-center mb-8">
        <div className="rounded-full mx-auto flex items-center justify-center mb-4" style={{ width: 56, height: 56, backgroundColor: "var(--success-bg)" }}>
          <Check size={28} style={{ color: "var(--success-text)" }} />
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 4 }}>Planning généré avec succès</h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>{periodLabel} · {r.created} shifts créés sur {r.totalRequired} requis</p>
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
