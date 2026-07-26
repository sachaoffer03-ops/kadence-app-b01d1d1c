import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { MarketingLayout, Section, Eyebrow, Lead, CtaBand } from "@/components/marketing/MarketingLayout";

export const Route = createFileRoute("/tarifs")({
  component: PricingPage,
  head: () => ({
    meta: [
      { title: "Tarifs — Kadence" },
      {
        name: "description",
        content:
          "Kadence s'adapte à la taille de votre équipe et au nombre d'établissements. Tarif sur demande, après une démo de 20 minutes.",
      },
      { property: "og:title", content: "Tarifs — Kadence" },
      { property: "og:description", content: "Tarif sur demande, adapté à votre équipe et à vos établissements." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://kadence.be/tarifs" },
    ],
    links: [{ rel: "canonical", href: "https://kadence.be/tarifs" }],
  }),
});

const PLANS = [
  {
    name: "Un établissement",
    who: "Un café, un restaurant, une boutique",
    items: [
      "Planning et génération automatique",
      "Disponibilités et demandes de shift",
      "Pointage géolocalisé",
      "Checklists d'ouverture et de clôture",
      "Application mobile employé",
    ],
  },
  {
    name: "Plusieurs établissements",
    who: "Deux adresses ou plus, équipes partagées",
    highlight: true,
    items: [
      "Tout ce qui précède",
      "Disponibilités par établissement",
      "Rapports consolidés multi-sites",
      "Rôles managers avec permissions fines",
      "Formation interne et suivi",
    ],
  },
  {
    name: "Sur mesure",
    who: "Groupe, franchise, besoins spécifiques",
    items: [
      "Tout ce qui précède",
      "Emails et interface à vos couleurs",
      "Règles de scoring personnalisées",
      "Accompagnement à la mise en place",
      "Interlocuteur dédié",
    ],
  },
];

function PricingPage() {
  return (
    <MarketingLayout>
      <Section>
        <Eyebrow>Tarifs</Eyebrow>
        <h1 style={{ fontSize: "clamp(30px, 4.4vw, 44px)", fontWeight: 500, letterSpacing: "-0.03em", lineHeight: 1.12 }}>
          Un tarif construit avec vous, pas une grille au hasard
        </h1>
        <Lead>
          Kadence sort d'une utilisation quotidienne en conditions réelles et s'ouvre progressivement à d'autres
          commerces. Le tarif dépend du nombre d'établissements et de la taille de l'équipe — on en discute
          simplement, après une démo.
        </Lead>

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {PLANS.map((p) => (
            <div
              key={p.name}
              className="rounded-2xl border p-7 flex flex-col"
              style={{
                backgroundColor: "var(--card)",
                borderColor: p.highlight ? "var(--coral)" : "var(--border)",
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 500 }}>{p.name}</div>
              <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 6 }}>{p.who}</div>

              <div className="mt-6 mb-6">
                <div style={{ fontSize: 24, fontWeight: 500, letterSpacing: "-0.02em" }}>Tarif sur demande</div>
                <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 4 }}>
                  Devis en 48 h après la démo
                </div>
              </div>

              <div className="flex flex-col gap-2.5 flex-1">
                {p.items.map((i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <Check size={15} style={{ color: "var(--coral-dark)", marginTop: 2, flexShrink: 0 }} />
                    <span style={{ fontSize: 13.5, color: "var(--muted-foreground)", lineHeight: 1.6 }}>{i}</span>
                  </div>
                ))}
              </div>

              <Link
                to="/contact"
                className="mt-7 rounded-full py-2.5 text-center transition-opacity hover:opacity-90"
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  backgroundColor: p.highlight ? "var(--coral)" : "transparent",
                  color: p.highlight ? "#fff" : "var(--foreground)",
                  border: p.highlight ? "none" : "1px solid var(--border)",
                }}
              >
                Nous contacter
              </Link>
            </div>
          ))}
        </div>

        <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 24, lineHeight: 1.7, maxWidth: 640 }}>
          Nous préférons annoncer un prix juste plutôt qu'un prix affiché : l'offre publique est en cours de
          définition, et les premiers clients sont accompagnés individuellement.
        </p>
      </Section>

      <Section tone="surface">
        <div className="grid gap-8 md:grid-cols-3">
          {[
            ["Pas d'engagement long", "On commence sur un mois de planning réel avant toute décision."],
            ["Mise en place incluse", "Vos établissements, postes et contrats sont configurés avec vous."],
            ["Vos données restent les vôtres", "Export possible à tout moment, hébergement européen."],
          ].map(([t, d]) => (
            <div key={t}>
              <div style={{ fontSize: 15, fontWeight: 500 }}>{t}</div>
              <p style={{ fontSize: 14, color: "var(--muted-foreground)", lineHeight: 1.7, marginTop: 8 }}>{d}</p>
            </div>
          ))}
        </div>
      </Section>

      <CtaBand />
    </MarketingLayout>
  );
}
