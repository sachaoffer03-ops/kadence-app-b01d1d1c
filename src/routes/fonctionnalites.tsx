import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CalendarRange,
  CalendarCheck,
  MapPin,
  ClipboardCheck,
  GraduationCap,
  BarChart3,
  Bell,
  Smartphone,
  Users,
  ShieldCheck,
} from "lucide-react";
import { MarketingLayout, Section, Eyebrow, H2, Lead, CtaBand } from "@/components/marketing/MarketingLayout";
import { PlanningMock, PhoneMock, ClotureMock, PointageMock } from "@/components/marketing/Mockups";

export const Route = createFileRoute("/fonctionnalites")({
  component: FeaturesPage,
  head: () => ({
    meta: [
      { title: "Fonctionnalités — Kadence" },
      {
        name: "description",
        content:
          "Planning automatique, disponibilités par établissement, pointage géolocalisé, checklists de clôture, formation interne et rapports d'équipe.",
      },
      { property: "og:title", content: "Fonctionnalités — Kadence" },
      {
        property: "og:description",
        content: "Tout ce que couvre Kadence : planning, dispos, pointage, clôtures, formation et rapports.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://kadence.be/fonctionnalites" },
    ],
    links: [{ rel: "canonical", href: "https://kadence.be/fonctionnalites" }],
  }),
});

const CHAPTERS = [
  {
    n: "01",
    kicker: "Planning",
    title: "Le mois entier généré en une fois, puis ajusté à la main",
    text: "Vous décrivez vos besoins par jour, par poste et par établissement. Kadence propose un planning complet en respectant contrats, quotas d'heures étudiants, disponibilités et repos légaux. Vous comparez plusieurs scénarios, vous corrigez, puis vous enregistrez.",
    points: [
      "Génération en quelques secondes sur un mois complet",
      "Trous signalés avant publication, jamais après",
      "Shifts verrouillés préservés lors d'une regénération",
    ],
    mock: <PlanningMock />,
    tone: "surface" as const,
  },
  {
    n: "02",
    kicker: "Pointage",
    title: "Des heures réelles, horodatées et vérifiées",
    text: "Clock-in et clock-out depuis le téléphone avec contrôle de la position. Retards et heures supplémentaires calculés automatiquement. Un manager peut corriger une pointeuse, chaque correction reste tracée.",
    points: [
      "Vérification de la position au démarrage du shift",
      "Retards, dépassements et écarts visibles à la journée",
      "Historique de toutes les corrections manuelles",
    ],
    mock: <PointageMock />,
    tone: "default" as const,
  },
  {
    n: "03",
    kicker: "Ouvertures & clôtures",
    title: "Le service se termine vraiment quand la checklist est faite",
    text: "Des checklists guidées en début et fin de service, avec photos de référence. Les questions de clôture — caisse, stock, incidents — sont enregistrées et consultables le lendemain matin.",
    points: [
      "Photos de référence pour chaque poste",
      "Réponses de clôture archivées et recherchables",
      "Notation de shift selon vos propres règles",
    ],
    mock: <ClotureMock />,
    tone: "surface" as const,
  },
  {
    n: "04",
    kicker: "Application employé",
    title: "Tout ce dont l'équipe a besoin tient dans une seule app",
    text: "iOS, Android et web. Shifts de la semaine, collègues du jour, relais de poste, disponibilités du mois prochain, échanges de shift, formation et profil. Notifications au bon moment, sans groupe WhatsApp.",
    points: [
      "Disponibilités mois par mois, par établissement",
      "Demandes et échanges de shift validés en un clic",
      "Rappels de shift et deadline de dispos",
    ],
    mock: <PhoneMock />,
    tone: "default" as const,
  },
];

const MODULES = [
  { icon: CalendarRange, title: "Planning et génération", text: "Besoins par jour, poste et établissement. Scénarios comparés avant enregistrement." },
  { icon: CalendarCheck, title: "Disponibilités", text: "Saisie mensuelle par établissement, relances automatiques, suivi des réponses." },
  { icon: MapPin, title: "Pointage géolocalisé", text: "Clock-in vérifié, corrections manager tracées, écarts calculés." },
  { icon: ClipboardCheck, title: "Checklists de service", text: "Ouverture et clôture guidées, photos de référence, réponses archivées." },
  { icon: Users, title: "Demandes et échanges", text: "Proposition à un collègue éligible, validation manager en un clic." },
  { icon: GraduationCap, title: "Formation interne", text: "Modules, vidéos, PDF et quiz. Progression suivie, prérequis avant un premier service." },
  { icon: BarChart3, title: "Rapports et notation", text: "Heures par employé et par établissement, retards, scoring selon vos règles." },
  { icon: Bell, title: "Notifications et emails", text: "Publication du planning, rappels, alertes de trous critiques, aux couleurs de l'enseigne." },
  { icon: Smartphone, title: "App mobile employé", text: "iOS, Android et web, avec pointage, formation et profil." },
  { icon: ShieldCheck, title: "Rôles et permissions", text: "Admin, manager, employé. Vous décidez page par page ce qu'un manager peut faire." },
];

function FeaturesPage() {
  return (
    <MarketingLayout>
      {/* Hero */}
      <section className="px-5 md:px-8 pt-16 md:pt-24 pb-12">
        <div className="mx-auto" style={{ maxWidth: 1180 }}>
          <Eyebrow>Fonctionnalités</Eyebrow>
          <div className="grid gap-10 md:grid-cols-[1.15fr_0.85fr] md:items-end">
            <h1
              style={{
                fontSize: "clamp(34px, 5.4vw, 62px)",
                fontWeight: 500,
                letterSpacing: "-0.035em",
                lineHeight: 1.06,
              }}
            >
              Un outil complet,
              <br />
              pas une collection d'outils
            </h1>
            <p style={{ fontSize: 17, color: "var(--muted-foreground)", lineHeight: 1.85 }}>
              Kadence a été construit dans un vrai commerce, avec de vraies contraintes belges : contrats étudiants,
              quotas d'heures, multi-établissements, équipes qui tournent chaque semaine.
            </p>
          </div>

          <div
            className="mt-12 grid gap-px overflow-hidden rounded-2xl border sm:grid-cols-2 lg:grid-cols-4"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--border)" }}
          >
            {[
              ["1 mois", "de planning généré en une fois"],
              ["4 modules", "planning, pointage, clôtures, formation"],
              ["Multi-sites", "dispos et postes par établissement"],
              ["iOS · Android", "application employé incluse"],
            ].map(([big, small]) => (
              <div key={big} className="px-6 py-7" style={{ backgroundColor: "var(--card)" }}>
                <div style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em" }}>{big}</div>
                <div style={{ fontSize: 13.5, color: "var(--muted-foreground)", marginTop: 6, lineHeight: 1.6 }}>
                  {small}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Chapitres alternés avec maquettes */}
      {CHAPTERS.map((c, i) => (
        <section
          key={c.n}
          className="px-5 md:px-8 py-16 md:py-24"
          style={c.tone === "surface" ? { backgroundColor: "#F3F1EC" } : undefined}
        >
          <div
            className={`mx-auto grid gap-12 md:gap-16 md:grid-cols-2 md:items-center ${
              i % 2 === 1 ? "md:[&>*:first-child]:order-2" : ""
            }`}
            style={{ maxWidth: 1180 }}
          >
            <div>
              <div className="flex items-baseline gap-4">
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--coral-dark)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {c.n}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "var(--muted-foreground)",
                  }}
                >
                  {c.kicker}
                </span>
              </div>
              <h2
                style={{
                  fontSize: "clamp(24px, 3.2vw, 36px)",
                  fontWeight: 500,
                  letterSpacing: "-0.03em",
                  lineHeight: 1.15,
                  marginTop: 16,
                }}
              >
                {c.title}
              </h2>
              <p style={{ fontSize: 16, color: "var(--muted-foreground)", lineHeight: 1.85, marginTop: 16 }}>
                {c.text}
              </p>
              <ul className="mt-8 flex flex-col gap-3">
                {c.points.map((p) => (
                  <li key={p} className="flex items-start gap-3" style={{ fontSize: 14.5, lineHeight: 1.7 }}>
                    <span
                      className="mt-2 rounded-full shrink-0"
                      style={{ width: 5, height: 5, backgroundColor: "var(--coral)" }}
                    />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex justify-center">{c.mock}</div>
          </div>
        </section>
      ))}

      {/* Grille complète */}
      <Section tone="ink">
        <div style={{ maxWidth: 620 }}>
          <Eyebrow tone="light">Tout le reste</Eyebrow>
          <h2 style={{ fontSize: "clamp(26px, 3.6vw, 40px)", fontWeight: 500, letterSpacing: "-0.03em", lineHeight: 1.12 }}>
            Les dix briques de Kadence
          </h2>
        </div>
        <div className="mt-12 grid gap-px overflow-hidden rounded-2xl sm:grid-cols-2 lg:grid-cols-3" style={{ backgroundColor: "rgba(250,250,248,0.12)" }}>
          {MODULES.map((m) => (
            <div key={m.title} className="px-7 py-8" style={{ backgroundColor: "#1A1A1A" }}>
              <m.icon size={18} style={{ color: "var(--coral)" }} />
              <h3 style={{ fontSize: 15.5, fontWeight: 500, color: "#FAFAF8", marginTop: 14 }}>{m.title}</h3>
              <p style={{ fontSize: 13.5, color: "rgba(250,250,248,0.6)", lineHeight: 1.75, marginTop: 8 }}>{m.text}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section>
        <div className="grid gap-10 md:grid-cols-[1fr_0.9fr] md:items-center">
          <div>
            <H2>Pensé pour plusieurs établissements dès le départ</H2>
            <Lead>
              Un employé peut travailler sur deux adresses avec des disponibilités différentes, des postes différents et
              des règles d'ouverture différentes. Kadence gère ça nativement, sans dupliquer les comptes.
            </Lead>
            <div className="mt-8">
              <Link to="/contact" style={{ fontSize: 14.5, color: "var(--coral-dark)", fontWeight: 500 }}>
                Parler de votre organisation →
              </Link>
            </div>
          </div>
          <div
            className="rounded-2xl border p-8"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            {[
              ["Comptes uniques", "Un employé, un profil, plusieurs adresses"],
              ["Dispos séparées", "Des disponibilités par établissement"],
              ["Postes par site", "Les compétences suivent l'employé, pas le site"],
              ["Rapports croisés", "Heures consolidées ou détaillées par adresse"],
            ].map(([t, d], i, arr) => (
              <div
                key={t}
                className="flex items-baseline justify-between gap-6 py-4"
                style={{ borderBottom: i === arr.length - 1 ? undefined : "1px solid var(--border)" }}
              >
                <span style={{ fontSize: 14.5, fontWeight: 500 }}>{t}</span>
                <span style={{ fontSize: 13.5, color: "var(--muted-foreground)", textAlign: "right" }}>{d}</span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <CtaBand />
    </MarketingLayout>
  );
}
