import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingLayout, CtaBand } from "@/components/marketing/MarketingLayout";
import { ClotureMock } from "@/components/marketing/Mockups";

export const Route = createFileRoute("/secteurs/boulangeries")({
  component: BoulangeriesPage,
  head: () => ({
    meta: [
      { title: "Planning pour boulangeries et traiteurs — Kadence" },
      {
        name: "description",
        content:
          "Fournée de nuit, vente en journée, production et comptoir séparés : Kadence construit des plannings qui tiennent compte des horaires décalés et des heures de nuit.",
      },
      { property: "og:title", content: "Planning pour boulangeries et traiteurs — Kadence" },
      { property: "og:description", content: "Production à 4h, comptoir à 7h : deux équipes, un planning cohérent." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://kadence.be/secteurs/boulangeries" },
    ],
    links: [{ rel: "canonical", href: "https://kadence.be/secteurs/boulangeries" }],
  }),
});

const HOURS = [
  ["04:00", "Fournée", "Production · 2"],
  ["06:30", "Mise en vitrine", "Production · 2 · Vente · 1"],
  ["07:00", "Ouverture comptoir", "Vente · 2"],
  ["12:00", "Rush du midi", "Vente · 3"],
  ["16:00", "Deuxième fournée", "Production · 1"],
  ["18:30", "Clôture", "Vente · 1"],
];

function BoulangeriesPage() {
  return (
    <MarketingLayout>
      {/* Hero crème chaud, typo massive */}
      <section style={{ backgroundColor: "#F6E9D8" }} className="px-5 md:px-8 py-20 md:py-28">
        <div className="mx-auto" style={{ maxWidth: 1180 }}>
          <div
            className="inline-flex rounded-full px-3.5 py-1.5 mb-7"
            style={{
              fontSize: 11.5,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              backgroundColor: "rgba(122,83,32,0.12)",
              color: "#7A5320",
            }}
          >
            Boulangeries & traiteurs
          </div>
          <h1
            style={{
              fontSize: "clamp(36px, 7vw, 86px)",
              fontWeight: 500,
              letterSpacing: "-0.045em",
              lineHeight: 0.98,
              color: "#3A2A12",
              maxWidth: 1000,
            }}
          >
            La journée commence à 4h. Le planning aussi.
          </h1>
          <div className="mt-10 grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
            <p style={{ fontSize: 17, color: "rgba(58,42,18,0.72)", lineHeight: 1.85, maxWidth: 540 }}>
              Production de nuit d'un côté, comptoir en journée de l'autre. Deux métiers, deux rythmes, des heures de
              nuit à compter correctement. Kadence garde les deux équipes alignées sur un seul planning.
            </p>
            <Link
              to="/contact"
              className="rounded-full px-8 py-4 text-center transition-opacity hover:opacity-90"
              style={{ fontSize: 15, fontWeight: 500, backgroundColor: "#7A5320", color: "#fff" }}
            >
              Demander une démo
            </Link>
          </div>
        </div>
      </section>

      {/* Horloge de la journée */}
      <section className="px-5 md:px-8 py-20 md:py-24">
        <div className="mx-auto" style={{ maxWidth: 1180 }}>
          <h2 style={{ fontSize: "clamp(24px, 3.2vw, 36px)", fontWeight: 500, letterSpacing: "-0.03em", maxWidth: 560, lineHeight: 1.15 }}>
            Une journée type, décrite une fois pour toutes
          </h2>
          <div className="mt-12 grid gap-px md:grid-cols-3" style={{ backgroundColor: "var(--border)" }}>
            {HOURS.map(([h, t, d]) => (
              <div key={h} className="p-8" style={{ backgroundColor: "var(--background)" }}>
                <div style={{ fontSize: 30, fontWeight: 500, letterSpacing: "-0.03em", color: "#7A5320", fontVariantNumeric: "tabular-nums" }}>
                  {h}
                </div>
                <div style={{ fontSize: 16, fontWeight: 500, marginTop: 10 }}>{t}</div>
                <div style={{ fontSize: 14, color: "var(--muted-foreground)", marginTop: 4 }}>{d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Split arguments + mockup clôture */}
      <section className="px-5 md:px-8 py-20 md:py-24" style={{ backgroundColor: "#F3F1EC" }}>
        <div className="mx-auto grid gap-14 md:grid-cols-2 md:items-center" style={{ maxWidth: 1180 }}>
          <div className="flex flex-col gap-9">
            {[
              ["Heures de nuit comptées à part", "Les shifts de production démarrant avant l'aube sont identifiés et totalisés séparément dans vos rapports."],
              ["Production et vente ne se mélangent pas", "Chaque employé porte ses postes : un vendeur n'est jamais affecté au fournil par la génération."],
              ["Vitrine et hygiène tracées", "Checklists photo à l'ouverture et à la fermeture : vitrine, chambre froide, nettoyage. Horodatées et archivées."],
              ["Remplacement à 5h du matin", "Une absence se signale dans l'app dès la nuit ; les collègues qualifiés reçoivent l'offre immédiatement."],
            ].map(([t, d]) => (
              <div key={t}>
                <div style={{ fontSize: 18, fontWeight: 500, letterSpacing: "-0.015em" }}>{t}</div>
                <p style={{ fontSize: 15, color: "var(--muted-foreground)", lineHeight: 1.85, marginTop: 8 }}>{d}</p>
              </div>
            ))}
          </div>
          <ClotureMock />
        </div>
      </section>

      <CtaBand />
    </MarketingLayout>
  );
}
