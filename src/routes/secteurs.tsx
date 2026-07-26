import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingLayout, Section, Eyebrow, CtaBand } from "@/components/marketing/MarketingLayout";
import { SECTORS } from "@/components/marketing/sectors";

export const Route = createFileRoute("/secteurs")({
  component: SectorsIndex,
  head: () => ({
    meta: [
      { title: "Secteurs — Kadence, planning et pointage par métier" },
      {
        name: "description",
        content:
          "Cafés, restaurants, bars, commerces, hôtels, boulangeries : Kadence s'adapte aux contraintes réelles de chaque secteur — contrats, coupures, pics de service, multi-adresses.",
      },
      { property: "og:title", content: "Secteurs — Kadence" },
      { property: "og:description", content: "Un planning pensé pour les contraintes réelles de votre métier." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://kadence.be/secteurs" },
    ],
    links: [{ rel: "canonical", href: "https://kadence.be/secteurs" }],
  }),
});

function SectorsIndex() {
  return (
    <MarketingLayout>
      <Section>
        <Eyebrow>Secteurs</Eyebrow>
        <h1
          style={{
            fontSize: "clamp(32px, 5.4vw, 64px)",
            fontWeight: 500,
            letterSpacing: "-0.035em",
            lineHeight: 1.06,
            maxWidth: 900,
          }}
        >
          Le même moteur. Des contraintes très différentes.
        </h1>
        <p style={{ fontSize: 17, color: "var(--muted-foreground)", lineHeight: 1.8, marginTop: 20, maxWidth: 620 }}>
          Un coffeeshop ne planifie pas comme un restaurant du soir, et un commerce ne compte pas ses heures comme un
          hôtel ouvert 24h. Choisissez votre métier.
        </p>
      </Section>

      <section className="px-5 md:px-8 pb-24">
        <div className="mx-auto grid gap-px md:grid-cols-2" style={{ maxWidth: 1180, backgroundColor: "var(--border)" }}>
          {SECTORS.map((s) => (
            <Link
              key={s.slug}
              to={s.slug}
              className="group block p-8 md:p-11 transition-colors"
              style={{ backgroundColor: "var(--background)" }}
            >
              <div
                className="inline-flex rounded-full px-3 py-1 mb-6"
                style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", backgroundColor: s.tint, color: s.ink }}
              >
                {s.kicker}
              </div>
              <div style={{ fontSize: 26, fontWeight: 500, letterSpacing: "-0.025em" }}>{s.title}</div>
              <p style={{ fontSize: 14.5, color: "var(--muted-foreground)", lineHeight: 1.8, marginTop: 12, maxWidth: 440 }}>
                {s.teaser}
              </p>
              <div
                className="mt-7 transition-opacity group-hover:opacity-60"
                style={{ fontSize: 13.5, fontWeight: 500, color: s.ink }}
              >
                Voir la page {s.title.toLowerCase()} →
              </div>
            </Link>
          ))}
        </div>
      </section>

      <CtaBand />
    </MarketingLayout>
  );
}
