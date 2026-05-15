import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, AlertTriangle, CheckCircle2, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/admin/hardcoding-audit")({
  component: HardcodingAuditPage,
});

type Severity = "critical" | "warn" | "info" | "ok";

type Finding = {
  severity: Severity;
  file: string;
  line?: number | string;
  snippet?: string;
  verdict: string;
  recommendation: string;
};

type Section = {
  id: string;
  title: string;
  description: string;
  findings: Finding[];
};

// ════════════════════════════════════════════════════════════════════════════
// Audit statique — basé sur scan ripgrep du codebase au 15 mai 2026
// Exécution en mode read-only : aucune modif de code, juste détection.
// ════════════════════════════════════════════════════════════════════════════

const SECTIONS: Section[] = [
  {
    id: "A",
    title: "A — Noms de personnes en dur",
    description: "Prénoms/noms d'employés fictifs présents dans le code actif.",
    findings: [
      {
        severity: "critical",
        file: "src/lib/diagnostic.functions.ts",
        line: 63,
        snippet: `const { data: marco } = await sb.from("profiles").select("id")\n  .eq("first_name", "Marco").eq("last_name", "Bianchi").maybeSingle();`,
        verdict: "🔴 BLOQUANT prod",
        recommendation: "diagnostic.functions.ts requête une personne nommée. À supprimer ou rendre générique avant prod.",
      },
      {
        severity: "critical",
        file: "src/lib/diagnostic.functions.ts",
        line: "87-92",
        snippet: `.or("first_name.eq.Léa,first_name.eq.Karim");\nconst lkIds = (lk ?? []).filter((p) => p.last_name === "Bernardi" || p.last_name === "El Amrani");`,
        verdict: "🔴 BLOQUANT prod",
        recommendation: "Diagnostic dépend de noms fictifs. Supprimer la route /admin/diagnostic en prod ou réécrire générique.",
      },
      {
        severity: "warn",
        file: "src/lib/seed.functions.ts",
        line: "267-296",
        snippet: `forcedName: { first: "Marco", last: "Bianchi" }\nforcedName: { first: "Léa", last: "Bernardi" }\nforcedName: { first: "Karim", last: "El Amrani" }`,
        verdict: "🟠 À nettoyer (seeder dev only)",
        recommendation: "Acceptable dans un seeder, mais le seeder doit être supprimé/protégé en prod (voir cat. G & H).",
      },
      {
        severity: "warn",
        file: "src/routes/studios.tsx",
        line: "71, 84",
        snippet: `manager: "Sacha"`,
        verdict: "🟠 À nettoyer",
        recommendation: "Manager hardcodé pour les 2 studios. Devrait venir de la DB (colonne manager_id).",
      },
      {
        severity: "info",
        file: "src/lib/seed.functions.ts",
        line: "23-25",
        snippet: `const FIRST_NAMES = ["Léa", "Hugo", "Inès", ... "Eva", "Mehdi", ...]`,
        verdict: "🟡 OK (seeder)",
        recommendation: "Pool de prénoms aléatoires pour seeder. Pas un problème si seeder désactivé en prod.",
      },
    ],
  },
  {
    id: "B",
    title: "B — Emails en dur",
    description: "Adresses email littérales dans le code.",
    findings: [
      {
        severity: "critical",
        file: "src/lib/seed.functions.ts",
        line: 8,
        snippet: `const PROTECTED_EMAILS = ["sachaoffer@gmail.com"];`,
        verdict: "🔴 BLOQUANT prod",
        recommendation: "Email personnel hardcodé comme liste de protection du seeder. Externaliser en variable d'env ou flag DB (is_protected).",
      },
      {
        severity: "warn",
        file: "src/lib/seed.functions.ts",
        line: "326, 573",
        snippet: `const email = \`\${slug(first)}.\${slug(last)}@fake-coffee.test\`;`,
        verdict: "🟠 À nettoyer (seeder)",
        recommendation: "Domaine fictif utilisé dans le seeder. OK tant que le seeder n'est pas exécutable en prod.",
      },
      {
        severity: "critical",
        file: "src/lib/mock-data.ts",
        line: "185-200+",
        snippet: `email: 'clara.martens@student.be', email: 'marc.peeters@gmail.com', ...`,
        verdict: "🔴 BLOQUANT prod",
        recommendation: "Tableau employees fictif avec emails @gmail.com — ces données sont importées dans planning.tsx (voir cat. E).",
      },
    ],
  },
  {
    id: "C",
    title: "C — IDs UUID en dur",
    description: "UUIDs littéraux dans le code (presque toujours un bug en attente).",
    findings: [
      {
        severity: "ok",
        file: "—",
        verdict: "🟢 Safe",
        recommendation: "Aucun UUID littéral détecté dans src/. Excellent.",
      },
    ],
  },
  {
    id: "D",
    title: "D — Noms de studios en dur",
    description: `"Skult Rhodes" / "Skult Châtelain" utilisés comme constantes de logique métier.`,
    findings: [
      {
        severity: "critical",
        file: "src/routes/planning.tsx",
        line: "27, 465, 523",
        snippet: `const studios: Studio[] = ["Skult Rhodes", "Skult Châtelain"];\nuseState<Studio>("Skult Rhodes")`,
        verdict: "🔴 BLOQUANT prod",
        recommendation: "Liste fermée des studios codée en dur. Si l'enseigne ouvre un 3ème studio, il faut éditer le code. Charger depuis la table studios.",
      },
      {
        severity: "critical",
        file: "src/routes/studios.tsx",
        line: "36, 65-200+",
        snippet: `const baseStudioTabs: Studio[] = ["Skult Rhodes", "Skult Châtelain"];\n"Skult Rhodes": { name, address, manager, ... }`,
        verdict: "🔴 BLOQUANT prod",
        recommendation: "Toute la config des studios (adresse, manager, horaires, rôles) est en dur. Migrer vers la table studios + colonnes dédiées.",
      },
      {
        severity: "warn",
        file: "src/routes/staff-app.tsx, signalements.tsx, pointage.tsx, dimona.tsx, feedbacks.tsx, staff.index.tsx, staff.$id.tsx",
        line: "multiple",
        snippet: `studioName.replace("Skult ", "")`,
        verdict: "🟠 À nettoyer",
        recommendation: `Préfixe "Skult " strippé partout en dur pour l'affichage. Stocker plutôt un short_name dans la table studios, ou supprimer le préfixe en DB.`,
      },
    ],
  },
  {
    id: "E",
    title: "E — Logique métier hardcodée sur identité",
    description: "Comparaisons par nom/string au lieu d'un flag ou d'un ID.",
    findings: [
      {
        severity: "critical",
        file: "src/lib/generate-planning.functions.ts",
        line: "24, 362",
        snippet: `const CHATELAIN_NAME_HINTS = ["Châtelain", "Chatelain", "châtelain", "chatelain"];\n// PHASE 1 — Détection "CDI cuisine unique" (Châtelain seulement)`,
        verdict: "🔴 BLOQUANT prod",
        recommendation: "Le moteur de génération identifie un studio par son nom string. Ajouter un flag has_kitchen ou kitchen_studio_id en DB.",
      },
      {
        severity: "critical",
        file: "src/routes/planning.tsx",
        line: "9, 324, 598, 646, 1127, 1205",
        snippet: `import { employees } from "@/lib/mock-data";\nemployees.filter(e => e.roles.includes(role))`,
        verdict: "🔴 BLOQUANT prod",
        recommendation: "La page planning utilise encore le tableau employees fictif comme source de vérité (eligibility, find by id...). À remplacer entièrement par les profiles DB.",
      },
    ],
  },
  {
    id: "F",
    title: "F — Valeurs métier en dur (magic numbers)",
    description: "Constantes business qui devraient être en config.",
    findings: [
      {
        severity: "info",
        file: "—",
        verdict: "🟡 OK mais à connaître",
        recommendation: `Les seuils principaux (heures min/max, max_etudiants_jour, etc.) sont déjà lus depuis ai_planning_settings. ✅ Audit ciblé non détecté de littéraux problématiques.\nÀ vérifier manuellement pour: durée min shift (4h), granularité (15min), deadline dispos (jour 20).`,
      },
      {
        severity: "warn",
        file: "src/lib/availabilities.functions.ts",
        line: "—",
        snippet: "MIN_DURATION_MINUTES = 240, GRANULARITY = 15",
        verdict: "🟠 À connaître",
        recommendation: "Constantes métier OK car cohérentes avec convention horeca. Migrer vers ai_planning_settings si l'enseigne change ses règles.",
      },
    ],
  },
  {
    id: "G",
    title: "G — Fichiers seeders / mocks",
    description: "Fichiers dont le rôle est uniquement de générer/contenir des données fictives.",
    findings: [
      {
        severity: "critical",
        file: "src/lib/seed.functions.ts",
        verdict: "🔴 BLOQUANT prod (route active)",
        recommendation: "Appelable via /admin/seeder. À supprimer ou cacher derrière un flag DEV avant prod.",
      },
      {
        severity: "critical",
        file: "src/lib/mock-data.ts",
        verdict: "🔴 BLOQUANT prod (importé en runtime)",
        recommendation: `Fichier importé par planning.tsx, studios.tsx, staff.index.tsx, staff.$id.tsx, staff-app.tsx, checklists.tsx, ProfileSheets.tsx, shared.tsx. Ce n'est PAS du dead code — il alimente l'UI. Refactor majeur requis : remplacer "employees" par les profiles DB et "roleColors" par des tokens design.`,
      },
      {
        severity: "warn",
        file: "src/lib/diagnostic.functions.ts",
        verdict: "🟠 À supprimer en prod",
        recommendation: "Diagnostic dépend de données seedées (Marco, Léa, Karim). Inutile en prod.",
      },
    ],
  },
  {
    id: "H",
    title: "H — Routes admin de debug",
    description: "Routes /admin/* créées pour le dev.",
    findings: [
      {
        severity: "critical",
        file: "src/routes/admin.seeder.tsx",
        verdict: "🔴 SUPPRIMER en prod",
        recommendation: "Permet de wiper et regénérer la base. Catastrophique si laissé accessible.",
      },
      {
        severity: "critical",
        file: "src/routes/admin.diagnostic.tsx",
        verdict: "🔴 SUPPRIMER en prod",
        recommendation: "Tests dépendant de noms fictifs. Inutile.",
      },
      {
        severity: "warn",
        file: "src/routes/admin.data-diagnostic.tsx",
        verdict: "🟠 À garder mais sécuriser",
        recommendation: "Utile en prod pour vérifier la cohérence des données. Vérifier que la route est admin-only (RLS + middleware).",
      },
      {
        severity: "warn",
        file: "src/routes/admin.migrate-studios.tsx",
        verdict: "🟠 SUPPRIMER après migration",
        recommendation: "Migration one-shot. Une fois exécutée, supprimer.",
      },
      {
        severity: "info",
        file: "src/routes/admin.audit.tsx",
        verdict: "🟡 Garder (admin-only)",
        recommendation: "Audit système utile en prod. Confirmer protection admin.",
      },
      {
        severity: "info",
        file: "src/routes/admin.hardcoding-audit.tsx",
        verdict: "🟡 Garder (cette page)",
        recommendation: "Page de méta-audit. Garder en prod tant qu'elle est admin-only.",
      },
    ],
  },
  {
    id: "Z",
    title: "Z — Autres anomalies détectées",
    description: "Patterns suspects hors catégories ci-dessus.",
    findings: [
      {
        severity: "warn",
        file: "src/lib/mock-data.ts",
        snippet: `roleColors: { Barista: '...', Accueil: '...', ... }`,
        verdict: "🟠 À déplacer",
        recommendation: "Les couleurs des rôles sont définies dans mock-data au lieu de src/styles.css. Migrer vers les design tokens du système.",
      },
      {
        severity: "warn",
        file: "src/routes/studios.tsx",
        line: 326,
        snippet: `placeholder="Ex. Skult Sablon"`,
        verdict: "🟡 Cosmétique",
        recommendation: "Placeholder qui suppose la marque Skult. OK mais à généraliser si revente.",
      },
    ],
  },
];

function HardcodingAuditPage() {
  const counts = SECTIONS.map((s) => ({
    id: s.id,
    critical: s.findings.filter((f) => f.severity === "critical").length,
    warn: s.findings.filter((f) => f.severity === "warn").length,
    info: s.findings.filter((f) => f.severity === "info").length,
    ok: s.findings.filter((f) => f.severity === "ok").length,
  }));
  const totals = counts.reduce(
    (acc, c) => ({
      critical: acc.critical + c.critical,
      warn: acc.warn + c.warn,
      info: acc.info + c.info,
    }),
    { critical: 0, warn: 0, info: 0 }
  );

  // Score : 100 - 15*critique - 4*warn - 1*info, plancher 0
  const score = Math.max(0, 100 - totals.critical * 15 - totals.warn * 4 - totals.info * 1);

  let verdict: { color: string; bg: string; icon: ReactNode; text: string };
  if (totals.critical > 0) {
    verdict = {
      color: "#b91c1c",
      bg: "#fef2f2",
      icon: <AlertTriangle size={20} />,
      text: `🔴 ${totals.critical} hardcoding critique(s) détecté(s) — NE PAS PASSER EN PROD`,
    };
  } else if (totals.warn > 0) {
    verdict = {
      color: "#b45309",
      bg: "#fffbeb",
      icon: <AlertCircle size={20} />,
      text: `⚠️ ${totals.warn} hardcoding mineur(s) à nettoyer — pas bloquant`,
    };
  } else {
    verdict = {
      color: "#15803d",
      bg: "#f0fdf4",
      icon: <CheckCircle2 size={20} />,
      text: "✅ Aucun hardcoding bloquant détecté, prêt pour la prod",
    };
  }

  return (
    <div style={{ padding: "32px 28px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ marginBottom: 8, fontSize: 12 }}>
        <Link to="/" style={{ color: "var(--muted-foreground)" }}>← Accueil</Link>
      </div>

      <h1 style={{ fontSize: 26, fontWeight: 500, marginBottom: 4 }}>Audit hardcoding</h1>
      <p style={{ color: "var(--muted-foreground)", fontSize: 14, marginBottom: 24 }}>
        Détection statique des noms, emails, IDs et logique métier en dur dans le codebase. Page admin, lecture seule.
      </p>

      {/* Verdict global */}
      <div
        style={{
          padding: 16,
          borderRadius: 8,
          background: verdict.bg,
          color: verdict.color,
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 16,
          fontWeight: 500,
        }}
      >
        {verdict.icon}
        <span>{verdict.text}</span>
      </div>

      {/* Score & compteurs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr 1fr",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <ScoreCard label="Score propreté" value={`${score}/100`} accent />
        <ScoreCard label="🔴 Critiques" value={totals.critical} />
        <ScoreCard label="🟠 À nettoyer" value={totals.warn} />
        <ScoreCard label="🟡 Info" value={totals.info} />
      </div>

      {/* Sections */}
      {SECTIONS.map((s) => {
        const c = counts.find((x) => x.id === s.id)!;
        return (
          <CollapsibleSection
            key={s.id}
            section={s}
            badge={`${c.critical}🔴 ${c.warn}🟠 ${c.info}🟡`}
          />
        );
      })}

      {/* Plan d'action */}
      {totals.critical > 0 && (
        <div style={{ marginTop: 32, padding: 20, background: "#fef2f2", borderRadius: 8 }}>
          <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 12, color: "#b91c1c" }}>
            Plan d'action avant passage prod
          </h2>
          <ol style={{ paddingLeft: 20, fontSize: 14, lineHeight: 1.8 }}>
            <li><strong>Refactor planning.tsx</strong> — supprimer l'import de <code>employees</code> depuis mock-data, brancher sur la table profiles.</li>
            <li><strong>Refactor studios.tsx</strong> — charger la liste, adresses, managers, horaires depuis la table studios.</li>
            <li><strong>Charger la liste des studios dynamiquement</strong> dans planning.tsx au lieu de la constante <code>["Skult Rhodes", "Skult Châtelain"]</code>.</li>
            <li><strong>Remplacer CHATELAIN_NAME_HINTS</strong> dans generate-planning.functions.ts par un flag <code>has_kitchen</code> sur la table studios.</li>
            <li><strong>Externaliser sachaoffer@gmail.com</strong> en variable d'env ou flag <code>is_protected</code> sur profiles.</li>
            <li><strong>Supprimer ou flagger DEV</strong> les routes /admin/seeder, /admin/diagnostic, /admin/migrate-studios.</li>
            <li><strong>Migrer mock-data.ts</strong> — déplacer roleColors vers src/styles.css, supprimer le tableau employees.</li>
            <li><strong>Migrer le préfixe "Skult "</strong> — soit l'inclure dans un short_name DB, soit le supprimer en base.</li>
          </ol>
        </div>
      )}

      <p style={{ marginTop: 24, fontSize: 11, color: "var(--muted-foreground)", textAlign: "center" }}>
        Audit statique généré le 15 mai 2026 — basé sur scan ripgrep du dossier src/.
      </p>
    </div>
  );
}

function ScoreCard({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div
      style={{
        padding: 16,
        background: accent ? "#0f172a" : "#fff",
        color: accent ? "#fff" : "inherit",
        border: accent ? "none" : "1px solid var(--border)",
        borderRadius: 8,
      }}
    >
      <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 500 }}>{value}</div>
    </div>
  );
}

function CollapsibleSection({ section, badge }: { section: Section; badge: string }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 8, marginBottom: 12, overflow: "hidden" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "var(--muted)",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <span style={{ fontWeight: 500, fontSize: 14, flex: 1 }}>{section.title}</span>
        <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{badge}</span>
      </button>
      {open && (
        <div style={{ padding: 16 }}>
          <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 12 }}>{section.description}</p>
          {section.findings.map((f, i) => (
            <FindingRow key={i} finding={f} />
          ))}
        </div>
      )}
    </div>
  );
}

const SEVERITY_DOT: Record<Severity, string> = {
  critical: "🔴",
  warn: "🟠",
  info: "🟡",
  ok: "🟢",
};

function FindingRow({ finding }: { finding: Finding }) {
  return (
    <div
      style={{
        padding: 12,
        marginBottom: 8,
        border: "1px solid var(--border)",
        borderRadius: 6,
        background: "var(--background)",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
        <span>{SEVERITY_DOT[finding.severity]}</span>
        <code style={{ fontSize: 12, fontWeight: 500 }}>{finding.file}</code>
        {finding.line && (
          <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>L.{finding.line}</span>
        )}
      </div>
      {finding.snippet && (
        <pre
          style={{
            fontSize: 11,
            background: "#f8fafc",
            padding: 8,
            borderRadius: 4,
            overflow: "auto",
            margin: "6px 0",
            whiteSpace: "pre-wrap",
          }}
        >
          {finding.snippet}
        </pre>
      )}
      <div style={{ fontSize: 12, marginTop: 4 }}>
        <strong>Verdict :</strong> {finding.verdict}
      </div>
      <div style={{ fontSize: 12, marginTop: 2, color: "var(--muted-foreground)" }}>
        <strong>→</strong> {finding.recommendation}
      </div>
    </div>
  );
}
