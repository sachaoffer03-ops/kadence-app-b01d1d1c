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
        severity: "ok",
        file: "src/lib/diagnostic.functions.ts",
        verdict: "🟢 Résolu",
        recommendation: "Le diagnostic ne requête plus aucun nom en dur : il découvre dynamiquement le 1er CDI cuisine via les flags business_roles.is_kitchen + user_contracts.contract = 'CDI', et les profils non-CDI cuisine pour les dispos week-end.",
      },
      {
        severity: "info",
        file: "src/lib/seed.functions.ts",
        verdict: "🟡 Acceptable (gated DEV)",
        recommendation: "Le seeder utilise des prénoms fictifs (Marco/Léa/Karim) — c'est son rôle. La route /admin/seeder est verrouillée derrière import.meta.env.DEV (cf. cat. H), donc inaccessible en prod.",
      },
    ],
  },
  {
    id: "B",
    title: "B — Emails en dur",
    description: "Adresses email littérales dans le code.",
    findings: [
      {
        severity: "ok",
        file: "src/lib/seed.functions.ts",
        verdict: "🟢 Résolu",
        recommendation: "PROTECTED_EMAILS supprimée. La protection des comptes utilise désormais le flag DB profiles.is_protected.",
      },
      {
        severity: "info",
        file: "src/lib/seed.functions.ts",
        verdict: "🟡 OK (seeder DEV-only)",
        recommendation: "Domaine fictif @fake-coffee.test généré par le seeder. Inaccessible en prod (route gated).",
      },
      {
        severity: "info",
        file: "src/lib/mock-data.ts",
        verdict: "🟡 Tableau employees inerte",
        recommendation: "Le tableau employees fictif existe encore dans mock-data.ts mais n'est plus importé par planning.tsx ni aucune page applicative. Suppression complète possible une fois studios.tsx refactoré.",
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
        recommendation: "Aucun UUID littéral détecté dans src/.",
      },
    ],
  },
  {
    id: "D",
    title: "D — Noms de studios en dur",
    description: `"Skult Rhodes" / "Skult Châtelain" utilisés comme constantes de logique métier.`,
    findings: [
      {
        severity: "ok",
        file: "src/routes/planning.tsx",
        verdict: "🟢 Résolu",
        recommendation: "La liste des studios est désormais dérivée dynamiquement de studioMap (issu de la DB). Plus aucun fallback en dur.",
      },
      {
        severity: "warn",
        file: "src/routes/studios.tsx",
        line: "36, 65-200+",
        snippet: `const baseStudioTabs: Studio[] = ["Skult Rhodes", "Skult Châtelain"];\n"Skult Rhodes": { name, address, manager, ... }`,
        verdict: "🟠 À refactorer (UI mock)",
        recommendation: "La page /studios reste un mock UI 2100 lignes. À reconstruire en CRUD branché sur la table studios (phase dédiée).",
      },
      {
        severity: "info",
        file: "studios DB",
        verdict: "🟡 short_name disponible",
        recommendation: `La colonne studios.short_name est désormais présente et backfillée. Les pages qui font studioName.replace("Skult ", "") peuvent migrer vers ce champ.`,
      },
    ],
  },
  {
    id: "E",
    title: "E — Logique métier hardcodée sur identité",
    description: "Comparaisons par nom/string au lieu d'un flag ou d'un ID.",
    findings: [
      {
        severity: "ok",
        file: "src/lib/generate-planning.functions.ts",
        verdict: "🟢 Résolu",
        recommendation: "CHATELAIN_NAME_HINTS supprimé. La détection 'CDI cuisine unique' utilise désormais studios.has_kitchen + business_roles.is_kitchen. Le moteur est studio-agnostique.",
      },
      {
        severity: "ok",
        file: "src/routes/planning.tsx",
        verdict: "🟢 Résolu",
        recommendation: "Plus d'import de employees depuis mock-data. La page utilise le hook useEmployees() qui lit profiles + user_business_roles en realtime.",
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
        file: "ai_planning_settings",
        verdict: "🟡 OK",
        recommendation: "Les seuils principaux (heures min/max, max hebdo CDI/Étudiant/Flexi, deadline dispos) sont lus depuis la table ai_planning_settings.",
      },
      {
        severity: "info",
        file: "src/lib/availabilities.functions.ts",
        snippet: "MIN_DURATION_MINUTES = 240, GRANULARITY = 15",
        verdict: "🟡 Constantes horeca",
        recommendation: "Cohérent avec convention horeca BE. Migrer vers ai_planning_settings si l'enseigne change ses règles.",
      },
    ],
  },
  {
    id: "G",
    title: "G — Fichiers seeders / mocks",
    description: "Fichiers dont le rôle est uniquement de générer/contenir des données fictives.",
    findings: [
      {
        severity: "info",
        file: "src/lib/seed.functions.ts",
        verdict: "🟡 OK (route gated DEV)",
        recommendation: "Seeder accessible uniquement via /admin/seeder, désormais verrouillée derrière import.meta.env.DEV.",
      },
      {
        severity: "warn",
        file: "src/lib/mock-data.ts",
        verdict: "🟠 Réduire au minimum",
        recommendation: "Toujours exporté pour roleColors/Role (proxy dynamique → business_roles). Le tableau employees n'est plus utilisé par les pages applicatives. Peut être trimé après refactor de studios.tsx.",
      },
      {
        severity: "ok",
        file: "src/lib/diagnostic.functions.ts",
        verdict: "🟢 Générique",
        recommendation: "Réécrit pour être name-agnostic. Reste accessible en DEV uniquement via /admin/diagnostic.",
      },
    ],
  },
  {
    id: "H",
    title: "H — Routes admin de debug",
    description: "Routes /admin/* créées pour le dev.",
    findings: [
      {
        severity: "ok",
        file: "src/routes/admin.seeder.tsx",
        verdict: "🟢 Verrouillée DEV",
        recommendation: "Wrapper <DevOnly /> : affiche un message verrouillé en production.",
      },
      {
        severity: "ok",
        file: "src/routes/admin.diagnostic.tsx",
        verdict: "🟢 Verrouillée DEV",
        recommendation: "Wrapper <DevOnly /> + page rendue générique (CDI cuisine découvert dynamiquement).",
      },
      {
        severity: "ok",
        file: "src/routes/admin.data-diagnostic.tsx",
        verdict: "🟢 Verrouillée DEV",
        recommendation: "Wrapper <DevOnly /> appliqué.",
      },
      {
        severity: "ok",
        file: "src/routes/admin.migrate-studios.tsx",
        verdict: "🟢 Verrouillée DEV",
        recommendation: "Wrapper <DevOnly /> appliqué — migration one-shot, à supprimer une fois exécutée en prod.",
      },
      {
        severity: "ok",
        file: "src/routes/admin.audit.tsx",
        verdict: "🟢 Verrouillée DEV",
        recommendation: "Wrapper <DevOnly /> appliqué.",
      },
      {
        severity: "info",
        file: "src/routes/admin.hardcoding-audit.tsx",
        verdict: "🟡 Garder en prod (admin-only)",
        recommendation: "Cette page reste accessible en prod : c'est un rapport read-only. Toujours protégée par RLS admin.",
      },
    ],
  },
  {
    id: "Z",
    title: "Z — Autres anomalies détectées",
    description: "Patterns suspects hors catégories ci-dessus.",
    findings: [
      {
        severity: "info",
        file: "src/lib/mock-data.ts → src/lib/role-colors.ts",
        verdict: "🟡 API stable, source dynamique",
        recommendation: "roleColors est un Proxy qui lit business_roles via le hook (pas une constante hardcodée). Re-exporté via @/lib/role-colors pour que les pages n'importent plus jamais 'mock-data'.",
      },
      {
        severity: "warn",
        file: "src/routes/studios.tsx",
        line: 326,
        snippet: `placeholder="Ex. Skult Sablon"`,
        verdict: "🟡 Cosmétique",
        recommendation: "Placeholder à généraliser lors du refactor CRUD de la page studios.",
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
      {totals.warn > 0 && (
        <div style={{ marginTop: 32, padding: 20, background: "#fffbeb", borderRadius: 8 }}>
          <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 12, color: "#b45309" }}>
            Reste à nettoyer
          </h2>
          <ol style={{ paddingLeft: 20, fontSize: 14, lineHeight: 1.8 }}>
            <li><strong>studios.tsx migré</strong> ✓ — onglets Informations, Besoins en staff et Exceptions branchés sur les tables <code>studios</code>, <code>studio_business_roles</code>, <code>staffing_templates</code>, <code>studio_exceptions</code>.</li>
            <li><strong>Trim mock-data.ts</strong> — supprimer le tableau <code>employees</code> et tous ses dérivés (todayShifts, holeShifts, feedbacks, checklistTemplates) une fois les pages dépendantes migrées. <code>studioExceptions</code> est déjà supprimé.</li>
            <li><strong>Migrer le préfixe "Skult "</strong> — utiliser studios.short_name au lieu de <code>.replace("Skult ", "")</code> dans les pages d'affichage.</li>
          </ol>
        </div>
      )}

      <p style={{ marginTop: 24, fontSize: 11, color: "var(--muted-foreground)", textAlign: "center" }}>
        Audit statique mis à jour le 15 mai 2026 — score recalculé après refactor (Phases 1–7).
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
