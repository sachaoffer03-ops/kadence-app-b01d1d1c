import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { DevOnly } from "@/components/DevOnly";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, ArrowLeft, Check, AlertTriangle, ArrowRight, Loader2, ChefHat } from "lucide-react";
import { seedFakeData, addKitchenWeekendStaff } from "@/lib/seed.functions";
import { linkAllEmployeesToAllStudios } from "@/lib/data-repair.functions";
import { Link2 } from "lucide-react";

export const Route = createFileRoute("/admin/seeder")({
  component: () => (<DevOnly label="Le seeder de données fictives"><SeederPage /></DevOnly>),
  head: () => ({ meta: [{ title: "Seeder données fictives — Kadence" }] }),
});

function SeederPage() {
  const navigate = useNavigate();
  const seed = useServerFn(seedFakeData);
  const addKitchen = useServerFn(addKitchenWeekendStaff);
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState("");

  const [kitchenState, setKitchenState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [kitchenResult, setKitchenResult] = useState<any>(null);
  const [kitchenErr, setKitchenErr] = useState("");

  const linkAll = useServerFn(linkAllEmployeesToAllStudios);
  const [linkState, setLinkState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [linkResult, setLinkResult] = useState<any>(null);
  const [linkErr, setLinkErr] = useState("");

  const handleLinkAll = async () => {
    if (!confirm("Rattacher tous les employés (non-admins) à TOUS les studios ?")) return;
    setLinkState("running"); setLinkErr(""); setLinkResult(null);
    try {
      const r = await linkAll();
      setLinkResult(r);
      setLinkState("done");
    } catch (e: any) {
      setLinkErr(e?.message || "Erreur");
      setLinkState("error");
    }
  };

  const handleClick = async () => {
    if (!confirm("Cela va SUPPRIMER tous les profils existants (sauf admins et comptes marqués protégés) puis créer ~30 employés fictifs. Continuer ?")) return;
    setState("running"); setErr(""); setResult(null);
    try {
      const r = await seed();
      setResult(r);
      setState("done");
    } catch (e: any) {
      setErr(e?.message || "Erreur");
      setState("error");
    }
  };

  const handleAddKitchen = async () => {
    if (!confirm("Ajouter Léa Bernardi (étudiante cuisine) et Karim El Amrani (flexi cuisine) au studio Châtelain, avec dispos focus week-end ?")) return;
    setKitchenState("running"); setKitchenErr(""); setKitchenResult(null);
    try {
      const r = await addKitchen();
      setKitchenResult(r);
      setKitchenState("done");
    } catch (e: any) {
      setKitchenErr(e?.message || "Erreur");
      setKitchenState("error");
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <Link to="/planning/generate" className="flex items-center gap-1 mb-4" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
        <ArrowLeft size={12} /> Retour
      </Link>
      <Link to="/admin/migrate-studios" className="inline-block mb-4 ml-3" style={{ fontSize: 12, color: "var(--primary)" }}>
        → Migrer les studios doublons
      </Link>

      <h1 style={{ fontSize: 26, fontWeight: 500, marginBottom: 6 }}>Seeder de données fictives</h1>
      <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginBottom: 24 }}>
        Nettoie tous les profils non protégés puis crée 30 employés fictifs réalistes avec disponibilités sur 4 semaines.
      </p>

      <div className="rounded-xl border p-4 mb-6" style={{ borderColor: "var(--warning-border, #f0c674)", backgroundColor: "var(--warning-bg, #fef9e7)" }}>
        <div className="flex gap-2" style={{ fontSize: 12 }}>
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontWeight: 500, marginBottom: 4 }}>Action destructive</div>
            <div style={{ color: "var(--muted-foreground)" }}>
              Tous les profils <strong>sauf</strong> les administrateurs et les comptes marqués <code>is_protected = true</code> seront supprimés. Idempotent.
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={handleClick}
        disabled={state === "running"}
        className="w-full rounded-xl px-6 py-5 flex items-center justify-center gap-3 transition"
        style={{
          fontSize: 15, fontWeight: 500,
          backgroundColor: state === "running" ? "var(--muted)" : "var(--primary)",
          color: "var(--primary-foreground)",
          cursor: state === "running" ? "wait" : "pointer",
          border: "none",
        }}
      >
        {state === "running" ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
        {state === "running" ? "Génération en cours…" : "Générer les données fictives (reset complet)"}
      </button>

      {state === "error" && (
        <div className="mt-6 rounded-xl border p-4" style={{ borderColor: "var(--danger-border, #ef4444)", backgroundColor: "var(--danger-bg, #fef2f2)", fontSize: 13 }}>
          <div style={{ fontWeight: 500, marginBottom: 4 }}>Erreur</div>
          <div style={{ color: "var(--danger-text, #b91c1c)", fontFamily: "monospace", fontSize: 12 }}>{err}</div>
        </div>
      )}

      {state === "done" && result && <ResultPanel result={result} navigate={navigate} />}

      {/* ─── Section ajout cuisine week-end ─── */}
      <div className="mt-10 pt-8" style={{ borderTop: "0.5px solid var(--border)" }}>
        <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 6 }}>Ajout ciblé — cuisine week-end</h2>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginBottom: 16 }}>
          Ajoute 2 profils qualifiés cuisine sans toucher au reste de la BDD : Léa Bernardi (étudiante, week-end) et Karim El Amrani (flexi, week-end + Accueil). Idempotent.
        </p>

        <button
          onClick={handleAddKitchen}
          disabled={kitchenState === "running"}
          className="w-full rounded-xl px-6 py-4 flex items-center justify-center gap-3 transition"
          style={{
            fontSize: 14, fontWeight: 500,
            backgroundColor: kitchenState === "running" ? "var(--muted)" : "var(--card)",
            color: "var(--foreground)",
            cursor: kitchenState === "running" ? "wait" : "pointer",
            border: "0.5px solid var(--border)",
          }}
        >
          {kitchenState === "running" ? <Loader2 size={18} className="animate-spin" /> : <ChefHat size={18} />}
          {kitchenState === "running" ? "Ajout en cours…" : "Ajouter 2 profils cuisine week-end"}
        </button>

        {kitchenState === "error" && (
          <div className="mt-4 rounded-xl border p-4" style={{ borderColor: "var(--danger-border, #ef4444)", backgroundColor: "var(--danger-bg, #fef2f2)", fontSize: 13 }}>
            <div style={{ fontWeight: 500, marginBottom: 4 }}>Erreur</div>
            <div style={{ color: "var(--danger-text, #b91c1c)", fontFamily: "monospace", fontSize: 12 }}>{kitchenErr}</div>
          </div>
        )}

        {kitchenState === "done" && kitchenResult && (
          <div className="mt-4 rounded-xl border p-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)", fontSize: 13 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
              Résultat
            </div>
            {kitchenResult.created.map((c: any) => (
              <div key={c.id} className="flex items-center gap-2" style={{ lineHeight: 1.9 }}>
                <Check size={14} style={{ color: "var(--success-text, #16a34a)" }} /> <span>{c.name} ({c.contract}) créé</span>
              </div>
            ))}
            {kitchenResult.skipped.map((s: string, i: number) => (
              <div key={i} style={{ color: "var(--muted-foreground)", fontSize: 12, marginTop: 4 }}>· {s}</div>
            ))}
            <button
              onClick={() => navigate({ to: "/planning/generate" })}
              className="mt-4 rounded-xl px-4 py-2 flex items-center gap-2"
              style={{ fontSize: 13, fontWeight: 500, backgroundColor: "var(--primary)", color: "var(--primary-foreground)", border: "none" }}
            >
              Relancer une génération de planning <ArrowRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ResultPanel({ result, navigate }: { result: any; navigate: any }) {
  const Section = ({ title, children }: any) => (
    <div className="rounded-xl border p-4 mb-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>{title}</div>
      <div style={{ fontSize: 13, lineHeight: 1.9 }}>{children}</div>
    </div>
  );
  const ok = (txt: string) => (
    <div className="flex items-center gap-2"><Check size={14} style={{ color: "var(--success-text, #16a34a)" }} /> <span>{txt}</span></div>
  );

  return (
    <div className="mt-6">
      <Section title="Nettoyage">
        {ok(`${result.cleanup.deletedProfiles} profils supprimés`)}
        {ok(`${result.cleanup.deletedLinked} lignes liées nettoyées`)}
        {result.cleanup.keptEmails.length > 0 && ok(`Profils préservés : ${result.cleanup.keptEmails.join(", ")}`)}
      </Section>

      <Section title="Seeding">
        {ok(`${result.seeding.employees_created} profils créés`)}
        {ok(`${result.seeding.by_contract.CDI} CDI / ${result.seeding.by_contract["Étudiant"]} Étudiants / ${result.seeding.by_contract.Flexi} Flexis`)}
        {ok(`${result.seeding.cuisine_count} cuisinier${result.seeding.cuisine_count > 1 ? "s" : ""}${result.seeding.cuisine_name ? ` (${result.seeding.cuisine_name})` : ""}`)}
        {ok(`${result.seeding.rhode_only} Rhode / ${result.seeding.chatelain_only} Châtelain / ${result.seeding.poly} poly-studios`)}
        {ok(`${result.seeding.templates_created > 0 ? result.seeding.templates_created + " staffing_templates créés" : "staffing_templates déjà présents"}`)}
        {ok(`${result.seeding.availabilities_created} disponibilités créées`)}
      </Section>

      <Section title="Logs">
        <div style={{ fontFamily: "monospace", fontSize: 11, color: "var(--muted-foreground)", whiteSpace: "pre-wrap" }}>
          {result.log.join("\n")}
        </div>
        <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 8 }}>
          Durée : {(result.duration_ms / 1000).toFixed(1)}s
        </div>
      </Section>

      <div className="flex gap-3 mt-5">
        <button
          onClick={() => navigate({ to: "/planning/generate" })}
          className="flex-1 rounded-xl px-4 py-3 flex items-center justify-center gap-2"
          style={{ fontSize: 13, fontWeight: 500, backgroundColor: "var(--primary)", color: "var(--primary-foreground)", border: "none" }}
        >
          Aller à la génération de planning <ArrowRight size={14} />
        </button>
        <Link to="/staff" className="flex-1 rounded-xl px-4 py-3 flex items-center justify-center"
          style={{ fontSize: 13, fontWeight: 500, border: "0.5px solid var(--border)", backgroundColor: "var(--card)", textAlign: "center" }}>
          Voir les employés
        </Link>
      </div>
    </div>
  );
}
