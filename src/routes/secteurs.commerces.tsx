import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingLayout, CtaBand } from "@/components/marketing/MarketingLayout";

export const Route = createFileRoute("/secteurs/commerces")({
  component: CommercesPage,
  head: () => ({
    meta: [
      { title: "Planning pour commerces et retail — Kadence" },
      {
        name: "description",
        content:
          "Kadence couvre les amplitudes d'ouverture de vos boutiques : plannings par magasin, personnel tournant, pics de fréquentation, heures pointées et rapports par point de vente.",
      },
      { property: "og:title", content: "Planning pour commerces et retail — Kadence" },
      { property: "og:description", content: "Plusieurs boutiques, une équipe qui tourne, une couverture toujours vérifiée." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://kadence.be/secteurs/commerces" },
    ],
    links: [{ rel: "canonical", href: "https://kadence.be/secteurs/commerces" }],
  }),
});

const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const LOAD = [0.45, 0.5, 0.6, 0.62, 0.85, 1, 0.3];

function CommercesPage() {
  return (
    <MarketingLayout>
      {/* Hero surface, aligné à droite */}
      <section style={{ backgroundColor: "#DFEDEA" }} className="px-5 md:px-8 py-20 md:py-28">
        <div className="mx-auto" style={{ maxWidth: 1180 }}>
          <div className="md:ml-auto" style={{ maxWidth: 720 }}>
            <div
              className="inline-flex rounded-full px-3.5 py-1.5 mb-6"
              style={{
                fontSize: 11.5,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                backgroundColor: "rgba(44,93,85,0.12)",
                color: "#2C5D55",
              }}
            >
              Commerces & retail
            </div>
            <h1 style={{ fontSize: "clamp(32px, 5.2vw, 60px)", fontWeight: 500, letterSpacing: "-0.035em", lineHeight: 1.06, color: "#1A1A1A" }}>
              Chaque boutique ouverte, chaque heure couverte
            </h1>
            <p style={{ fontSize: 17, color: "rgba(26,26,26,0.7)", lineHeight: 1.85, marginTop: 20, maxWidth: 540 }}>
              Vos horaires d'ouverture sont fixes, votre fréquentation ne l'est pas. Kadence part de l'amplitude réelle
              de chaque point de vente et répartit votre équipe là où le trafic l'exige.
            </p>
            <Link
              to="/contact"
              className="inline-block mt-9 rounded-full px-7 py-3.5 transition-opacity hover:opacity-90"
              style={{ fontSize: 15, fontWeight: 500, backgroundColor: "#2C5D55", color: "#fff" }}
            >
              Demander une démo
            </Link>
          </div>
        </div>
      </section>

      {/* Graphe de charge */}
      <section className="px-5 md:px-8 py-20 md:py-24">
        <div className="mx-auto grid gap-14 md:grid-cols-[1fr_1fr] md:items-end" style={{ maxWidth: 1180 }}>
          <div>
            <h2 style={{ fontSize: "clamp(26px, 3.6vw, 40px)", fontWeight: 500, letterSpacing: "-0.03em", lineHeight: 1.15 }}>
              Plus de monde le samedi ? Plus de vendeurs le samedi.
            </h2>
            <p style={{ fontSize: 16, color: "var(--muted-foreground)", lineHeight: 1.85, marginTop: 16 }}>
              Les besoins se définissent jour par jour et créneau par créneau. Une fois posés, ils s'appliquent à
              chaque mois généré — sans les retaper.
            </p>
          </div>
          <div className="flex items-end gap-3" style={{ height: 220 }}>
            {LOAD.map((v, i) => (
              <div key={DAYS[i]} className="flex-1 flex flex-col items-center gap-3">
                <div
                  className="w-full rounded-t-lg"
                  style={{ height: `${v * 100}%`, backgroundColor: v === 1 ? "#2C5D55" : "#BBD6CF" }}
                />
                <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{DAYS[i]}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Liste numérotée pleine largeur */}
      <section className="px-5 md:px-8 pb-24">
        <div className="mx-auto" style={{ maxWidth: 1180 }}>
          {[
            ["Plusieurs points de vente", "Un employé rattaché à deux boutiques déclare ses disponibilités séparément pour chacune. Le planning ne l'envoie jamais au mauvais endroit."],
            ["Ouverture et fermeture tracées", "Checklists d'ouverture et de clôture avec photo : vitrine, caisse, réserve. Consultables depuis le bureau."],
            ["Heures et coûts par magasin", "Les rapports séparent les heures et le coût par point de vente, mois par mois."],
            ["Remplacements sans téléphone", "Une absence se signale dans l'app, les collègues éligibles reçoivent l'offre, vous arbitrez."],
          ].map(([t, d], i) => (
            <div
              key={t}
              className="grid gap-4 md:grid-cols-[80px_1fr_1.1fr] md:gap-10 py-8"
              style={{ borderTop: "1px solid var(--border)" }}
            >
              <div style={{ fontSize: 13, color: "#2C5D55", fontVariantNumeric: "tabular-nums" }}>0{i + 1}</div>
              <div style={{ fontSize: 19, fontWeight: 500, letterSpacing: "-0.02em" }}>{t}</div>
              <p style={{ fontSize: 15, color: "var(--muted-foreground)", lineHeight: 1.85 }}>{d}</p>
            </div>
          ))}
        </div>
      </section>

      <CtaBand />
    </MarketingLayout>
  );
}
