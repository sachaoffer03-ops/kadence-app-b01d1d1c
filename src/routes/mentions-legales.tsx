import { createFileRoute } from "@tanstack/react-router";
import { MarketingLayout, Section, Eyebrow, H2 } from "@/components/marketing/MarketingLayout";

export const Route = createFileRoute("/mentions-legales")({
  component: LegalPage,
  head: () => ({
    meta: [
      { title: "Mentions légales — Kadence" },
      {
        name: "description",
        content:
          "Mentions légales de Kadence : éditeur du site, siège social, numéro d'entreprise, hébergement et contact.",
      },
      { property: "og:title", content: "Mentions légales — Kadence" },
      { property: "og:description", content: "Éditeur, siège social, numéro d'entreprise et contact de Kadence." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://kadence.be/mentions-legales" },
    ],
    links: [{ rel: "canonical", href: "https://kadence.be/mentions-legales" }],
  }),
});

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-10">
      <h3 style={{ fontSize: 16, fontWeight: 500, letterSpacing: "-0.01em" }}>{title}</h3>
      <div style={{ fontSize: 14, color: "var(--muted-foreground)", lineHeight: 1.8, marginTop: 8 }}>{children}</div>
    </div>
  );
}

function LegalPage() {
  return (
    <MarketingLayout>
      <Section>
        <div style={{ maxWidth: 720 }}>
          <Eyebrow>Informations légales</Eyebrow>
          <H2>Mentions légales</H2>

          <Block title="Éditeur">
            KOL INVEST, SRL dont le siège est établi Avenue d'Orbaix 23/A Boîte 4, 1180 Uccle, Belgique, et
            enregistrée à la Banque Carrefour des Entreprises sous le numéro 0776.362.165.
          </Block>

          <Block title="Responsable du traitement des données">
            KOL INVEST SRL, pour elle-même, une société qu'elle représente ou pour une société à constituer,
            confirme être responsable du traitement de vos données.
          </Block>

          <Block title="Contact">
            Pour toute question, commentaire ou réclamation concernant la politique de confidentialité ou vos
            données&nbsp;:{" "}
            <a href="mailto:privacy@skult-studios.com" style={{ color: "var(--coral-dark)" }}>
              privacy@skult-studios.com
            </a>
          </Block>

          <Block title="Hébergement et infrastructure">
            Le service est hébergé sur une infrastructure cloud européenne. Les données de planning, de pointage et de
            personnel sont stockées dans l'Union européenne.
          </Block>

          <Block title="Propriété intellectuelle">
            L'ensemble des contenus du site kadence.be — textes, interfaces, illustrations, marque et logo — est la
            propriété de son éditeur. Toute reproduction, même partielle, est interdite sans autorisation écrite
            préalable.
          </Block>

          <Block title="Responsabilité">
            L'éditeur met tout en œuvre pour assurer l'exactitude des informations publiées sur ce site, sans garantie
            d'exhaustivité. Les captures et interfaces présentées sont des reconstitutions à visée illustrative,
            construites avec des données fictives.
          </Block>
        </div>
      </Section>
    </MarketingLayout>
  );
}
