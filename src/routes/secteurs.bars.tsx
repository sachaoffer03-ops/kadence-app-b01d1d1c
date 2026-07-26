import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingLayout, CtaBand } from "@/components/marketing/MarketingLayout";
import { PointageMock } from "@/components/marketing/Mockups";

export const Route = createFileRoute("/secteurs/bars")({
  component: BarsPage,
  head: () => ({
    meta: [
      { title: "Planning pour bars et clubs — nuits et extras | Kadence" },
      {
        name: "description",
        content:
          "Kadence gère les équipes de bars et clubs : shifts de nuit, week-ends, extras de dernière minute, pointage horodaté et repos entre services garanti.",
      },
      { property: "og:title", content: "Planning pour bars et clubs — Kadence" },
      { property: "og:description", content: "Nuits, week-ends, extras : des heures pointées à la minute près." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://kadence.be/secteurs/bars" },
    ],
    links: [{ rel: "canonical", href: "https://kadence.be/secteurs/bars" }],
  }),
});

const NIGHT = [
  ["17:00", "Ouverture"],
  ["21:00", "Renfort bar"],
  ["23:00", "Pic"],
  ["02:00", "Dernier service"],
  ["04:00", "Fermeture"],
];

function BarsPage() {
  return (
    <MarketingLayout>
      {/* Hero nuit, centré */}
      <section style={{ backgroundColor: "#16162A", color: "#FAFAF8" }} className="px-5 md:px-8 py-24 md:py-32">
        <div className="mx-auto text-center" style={{ maxWidth: 860 }}>
          <div
            className="inline-flex rounded-full px-3.5 py-1.5 mb-8"
            style={{
              fontSize: 11.5,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              backgroundColor: "rgba(250,250,248,0.1)",
              color: "rgba(250,250,248,0.85)",
            }}
          >
            Bars & clubs
          </div>
          <h1 style={{ fontSize: "clamp(34px, 5.8vw, 68px)", fontWeight: 500, letterSpacing: "-0.035em", lineHeight: 1.05 }}>
            Vos heures les plus chargées commencent quand les autres ferment
          </h1>
          <p
            style={{
              fontSize: 17,
              color: "rgba(250,250,248,0.6)",
              lineHeight: 1.85,
              marginTop: 22,
              maxWidth: 580,
              marginInline: "auto",
            }}
          >
            Shifts qui traversent minuit, équipes qui doublent le samedi, extras appelés l'après-midi même. Kadence
            compte juste, même quand la nuit déborde sur le lendemain.
          </p>

          {/* Ligne de nuit */}
          <div className="mt-14 grid grid-cols-5 gap-2">
            {NIGHT.map(([h, l], i) => (
              <div key={h}>
                <div
                  className="rounded-full"
                  style={{
                    height: 6,
                    backgroundColor: i === 2 ? "var(--coral)" : "rgba(250,250,248,0.22)",
                  }}
                />
                <div style={{ fontSize: 12.5, marginTop: 12, fontVariantNumeric: "tabular-nums" }}>{h}</div>
                <div style={{ fontSize: 11.5, color: "rgba(250,250,248,0.5)", marginTop: 2 }}>{l}</div>
              </div>
            ))}
          </div>

          <Link
            to="/contact"
            className="inline-block mt-14 rounded-full px-8 py-4 transition-opacity hover:opacity-90"
            style={{ fontSize: 15, fontWeight: 500, backgroundColor: "var(--coral)", color: "#fff" }}
          >
            Demander une démo
          </Link>
        </div>
      </section>

      {/* Bento */}
      <section className="px-5 md:px-8 py-20 md:py-28">
        <div className="mx-auto grid gap-5 md:grid-cols-3" style={{ maxWidth: 1180 }}>
          <div className="md:col-span-2 rounded-[24px] p-9 md:p-12" style={{ backgroundColor: "#F3F1EC" }}>
            <h2 style={{ fontSize: "clamp(24px, 3.2vw, 34px)", fontWeight: 500, letterSpacing: "-0.03em", lineHeight: 1.15 }}>
              Un shift 22h → 04h reste un seul shift
            </h2>
            <p style={{ fontSize: 15.5, color: "var(--muted-foreground)", lineHeight: 1.85, marginTop: 14, maxWidth: 480 }}>
              Le passage de minuit ne casse rien : les heures s'additionnent sur le service, pas sur deux journées.
              Le repos minimum avant le shift suivant est vérifié automatiquement.
            </p>
          </div>
          <div className="rounded-[24px] p-9" style={{ backgroundColor: "#E4E4F0" }}>
            <div style={{ fontSize: 34, fontWeight: 500, letterSpacing: "-0.03em", color: "#3E3A6B" }}>11 h</div>
            <p style={{ fontSize: 14, color: "#3E3A6B", opacity: 0.75, lineHeight: 1.75, marginTop: 8 }}>
              de repos minimum entre deux services, contrôlé à chaque génération.
            </p>
          </div>
          <div className="rounded-[24px] p-9" style={{ backgroundColor: "var(--coral-light)" }}>
            <div style={{ fontSize: 16, fontWeight: 500, color: "var(--coral-dark)" }}>Extras en un tap</div>
            <p style={{ fontSize: 14, color: "var(--coral-dark)", opacity: 0.8, lineHeight: 1.75, marginTop: 8 }}>
              Publiez un shift ouvert : seuls les employés qualifiés et disponibles le reçoivent.
            </p>
          </div>
          <div className="md:col-span-2 rounded-[24px] p-9 md:p-12" style={{ border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 16, fontWeight: 500 }}>Heures réelles, pas déclaratives</div>
            <p style={{ fontSize: 14.5, color: "var(--muted-foreground)", lineHeight: 1.85, marginTop: 10, maxWidth: 460 }}>
              Pointage horodaté et géolocalisé à l'arrivée comme au départ. Les écarts avec le prévu remontent
              directement dans vos rapports mensuels.
            </p>
          </div>
        </div>
      </section>

      <section className="px-5 md:px-8 pb-24" style={{ backgroundColor: "var(--background)" }}>
        <div className="mx-auto grid gap-12 md:grid-cols-2 md:items-center" style={{ maxWidth: 1180 }}>
          <PointageMock />
          <div>
            <h2 style={{ fontSize: "clamp(24px, 3.2vw, 36px)", fontWeight: 500, letterSpacing: "-0.03em", lineHeight: 1.15 }}>
              Le pointage se fait sur place, ou pas du tout
            </h2>
            <p style={{ fontSize: 16, color: "var(--muted-foreground)", lineHeight: 1.85, marginTop: 16 }}>
              L'employé pointe depuis son téléphone dans un rayon défini autour du bar. Pas de badgeuse à installer,
              pas de pointage depuis le tram.
            </p>
          </div>
        </div>
      </section>

      <CtaBand />
    </MarketingLayout>
  );
}
