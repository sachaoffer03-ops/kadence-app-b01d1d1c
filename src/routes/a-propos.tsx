import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingLayout, Section, Eyebrow, H2, Lead, CtaBand } from "@/components/marketing/MarketingLayout";

export const Route = createFileRoute("/a-propos")({
  component: AboutPage,
  head: () => ({
    meta: [
      { title: "À propos — Kadence" },
      {
        name: "description",
        content:
          "Kadence est né dans les coffeeshops Skult Studios à Bruxelles, pour résoudre un problème concret : planifier une équipe qui tourne sur plusieurs établissements.",
      },
      { property: "og:title", content: "À propos — Kadence" },
      { property: "og:description", content: "Un outil né dans un vrai commerce bruxellois, pas dans un bureau." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://kadence.be/a-propos" },
    ],
    links: [{ rel: "canonical", href: "https://kadence.be/a-propos" }],
  }),
});

function AboutPage() {
  return (
    <MarketingLayout>
      <Section>
        <Eyebrow>À propos</Eyebrow>
        <h1 style={{ fontSize: "clamp(30px, 4.4vw, 44px)", fontWeight: 500, letterSpacing: "-0.03em", lineHeight: 1.12 }}>
          Né derrière un comptoir, pas dans une salle de réunion
        </h1>
        <Lead>
          Kadence a d'abord été construit pour Skult Studios, deux coffeeshops bruxellois. Le problème était simple
          et quotidien : composer un planning juste pour une équipe d'étudiants et de temps partiels, répartie sur
          deux adresses, avec des contrats et des quotas d'heures à respecter.
        </Lead>
      </Section>

      <Section tone="surface">
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <H2>Ce en quoi nous croyons</H2>
          </div>
          <div className="flex flex-col gap-7">
            {[
              [
                "Un outil qu'on ouvre sans y penser",
                "Si un employé doit être formé pour consulter son planning, l'outil a raté son travail. L'interface reste volontairement sobre et directe.",
              ],
              [
                "Les règles du terrain d'abord",
                "Contrats étudiants, heures maximum, repos entre deux services, postes qui ne s'improvisent pas : ces contraintes sont dans le moteur, pas dans un tableur à côté.",
              ],
              [
                "Le manager décide, l'outil propose",
                "Kadence génère une proposition complète et signale les trous. La décision finale reste humaine, toujours.",
              ],
              [
                "Des données sérieuses",
                "Heures, pointages et clôtures sont conservés proprement, avec traçabilité — parce que la paie et la comptabilité en dépendent.",
              ],
            ].map(([t, d]) => (
              <div key={t}>
                <div style={{ fontSize: 16, fontWeight: 500 }}>{t}</div>
                <p style={{ fontSize: 14, color: "var(--muted-foreground)", lineHeight: 1.75, marginTop: 8 }}>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section>
        <H2>Aujourd'hui</H2>
        <Lead>
          Kadence gère chaque mois les plannings, les pointages et les clôtures des équipes Skult Studios. L'outil
          s'ouvre maintenant à d'autres cafés, restaurants et commerces qui vivent les mêmes contraintes.
        </Lead>
        <div className="mt-8">
          <Link to="/contact" style={{ fontSize: 14, color: "var(--coral-dark)", fontWeight: 500 }}>
            Nous écrire →
          </Link>
        </div>
      </Section>

      <CtaBand />
    </MarketingLayout>
  );
}
