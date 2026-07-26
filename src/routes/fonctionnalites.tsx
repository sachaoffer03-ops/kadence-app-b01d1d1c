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

const MODULES = [
  {
    icon: CalendarRange,
    title: "Planning et génération automatique",
    text: "Définissez vos besoins en staff par jour, par poste et par établissement. Kadence propose un planning complet en respectant les contrats, les quotas d'heures étudiants, les disponibilités et les repos. Vous prévisualisez, comparez plusieurs scénarios, puis enregistrez.",
  },
  {
    icon: CalendarCheck,
    title: "Disponibilités par établissement",
    text: "Chaque employé indique ses disponibilités mois par mois, différenciées si il travaille sur plusieurs adresses. Relances automatiques avant la date limite, suivi de qui a répondu.",
  },
  {
    icon: MapPin,
    title: "Pointage géolocalisé",
    text: "Clock-in et clock-out depuis le téléphone avec vérification de la position. Correction manuelle possible par un manager, avec traçabilité complète des modifications.",
  },
  {
    icon: ClipboardCheck,
    title: "Ouvertures, clôtures et checklists",
    text: "Des checklists guidées en début et fin de service, avec photos de référence. Les questions de clôture (caisse, stock, incidents) sont enregistrées et consultables.",
  },
  {
    icon: Users,
    title: "Demandes et échanges de shift",
    text: "Un employé demande un changement, propose son shift à un collègue éligible, et le manager valide en un clic. Plus de fil de discussion à dérouler.",
  },
  {
    icon: GraduationCap,
    title: "Formation interne",
    text: "Créez des cours avec modules, vidéos, PDF et quiz. Suivez la progression de chaque employé et rendez certains modules obligatoires avant un premier service.",
  },
  {
    icon: BarChart3,
    title: "Rapports, heures et notation",
    text: "Heures travaillées par employé et par établissement, retards, heures supplémentaires, notation de shift selon vos propres règles de scoring.",
  },
  {
    icon: Bell,
    title: "Notifications et emails",
    text: "Publication du planning, rappel de shift, deadline de disponibilités, alertes de trous critiques. Emails aux couleurs de votre enseigne.",
  },
  {
    icon: Smartphone,
    title: "Application mobile employé",
    text: "iOS, Android et web. Shifts de la semaine, collègues du jour, relais de poste, pointage, formation et profil.",
  },
  {
    icon: ShieldCheck,
    title: "Rôles et permissions fines",
    text: "Admin, manager, employé. Vous décidez précisément ce qu'un manager peut voir et modifier, page par page.",
  },
];

function FeaturesPage() {
  return (
    <MarketingLayout>
      <Section>
        <Eyebrow>Fonctionnalités</Eyebrow>
        <h1 style={{ fontSize: "clamp(30px, 4.4vw, 44px)", fontWeight: 500, letterSpacing: "-0.03em", lineHeight: 1.12 }}>
          Un outil complet, pas une collection d'outils
        </h1>
        <Lead>
          Kadence a été construit dans un vrai commerce, avec de vraies contraintes belges : contrats étudiants,
          quotas d'heures, multi-établissements, équipes qui tournent.
        </Lead>

        <div className="mt-14 grid gap-5 md:grid-cols-2">
          {MODULES.map((m) => (
            <div
              key={m.title}
              className="rounded-2xl border p-7"
              style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
            >
              <div
                className="rounded-xl flex items-center justify-center mb-4"
                style={{ width: 40, height: 40, backgroundColor: "var(--coral-light)" }}
              >
                <m.icon size={18} style={{ color: "var(--coral-dark)" }} />
              </div>
              <h2 style={{ fontSize: 16, fontWeight: 500 }}>{m.title}</h2>
              <p style={{ fontSize: 14, color: "var(--muted-foreground)", lineHeight: 1.75, marginTop: 10 }}>{m.text}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section tone="surface">
        <H2>Pensé pour plusieurs établissements dès le départ</H2>
        <Lead>
          Un employé peut travailler sur deux adresses avec des disponibilités différentes, des postes différents et
          des règles d'ouverture différentes. Kadence gère ça nativement, sans dupliquer les comptes.
        </Lead>
        <div className="mt-8">
          <Link to="/contact" style={{ fontSize: 14, color: "var(--coral-dark)", fontWeight: 500 }}>
            Parler de votre organisation →
          </Link>
        </div>
      </Section>

      <CtaBand />
    </MarketingLayout>
  );
}
