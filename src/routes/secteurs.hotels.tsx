import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingLayout, CtaBand } from "@/components/marketing/MarketingLayout";
import imgClosing from "@/assets/mk-closing.jpg";

export const Route = createFileRoute("/secteurs/hotels")({
  component: HotelsPage,
  head: () => ({
    meta: [
      { title: "Planning pour hôtels — réception 24h, nuits, housekeeping | Kadence" },
      {
        name: "description",
        content:
          "Kadence couvre les rotations hôtelières : réception 24h/24, shifts de nuit, housekeeping et petit-déjeuner. Chaque créneau est couvert ou signalé avant publication.",
      },
      { property: "og:title", content: "Planning pour hôtels — Kadence" },
      { property: "og:description", content: "Réception, nuit, housekeeping : trois métiers, un seul planning sans trou." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://kadence.be/secteurs/hotels" },
    ],
    links: [{ rel: "canonical", href: "https://kadence.be/secteurs/hotels" }],
  }),
});

const ROTATIONS = [
  ["Matin", "06:00 — 14:00", "Réception · Petit-déjeuner", "#E7E4DC"],
  ["Journée", "10:00 — 18:00", "Housekeeping", "#DDD8CB"],
  ["Soir", "14:00 — 22:00", "Réception · Bar", "#C9C2B0"],
  ["Nuit", "22:00 — 06:00", "Night audit", "#4A4335"],
];

function HotelsPage() {
  return (
    <MarketingLayout>
      {/* Hero éditorial : filet + colonne étroite */}
      <section className="px-5 md:px-8 pt-16 md:pt-24 pb-14">
        <div className="mx-auto" style={{ maxWidth: 1180 }}>
          <div style={{ height: 1, backgroundColor: "var(--border)" }} />
          <div className="grid gap-10 md:grid-cols-[0.4fr_1fr] pt-10">
            <div style={{ fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "#4A4335" }}>
              Hôtels
            </div>
            <div>
              <h1 style={{ fontSize: "clamp(32px, 5vw, 58px)", fontWeight: 500, letterSpacing: "-0.035em", lineHeight: 1.08 }}>
                Un hôtel ne ferme jamais.
                <br />
                Votre planning non plus.
              </h1>
              <p style={{ fontSize: 17, color: "var(--muted-foreground)", lineHeight: 1.85, marginTop: 22, maxWidth: 560 }}>
                Réception continue, night audit, housekeeping en journée, petit-déjeuner à l'aube. Kadence gère ces
                rotations comme des postes distincts, avec leurs propres compétences et leurs propres besoins de
                couverture.
              </p>
              <Link
                to="/contact"
                className="inline-block mt-9 rounded-full px-7 py-3.5 transition-opacity hover:opacity-90"
                style={{ fontSize: 15, fontWeight: 500, backgroundColor: "var(--coral)", color: "#fff" }}
              >
                Demander une démo
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Bandes de rotation */}
      <section className="px-5 md:px-8 py-16" style={{ backgroundColor: "#F3F1EC" }}>
        <div className="mx-auto" style={{ maxWidth: 1180 }}>
          <h2 style={{ fontSize: "clamp(24px, 3.2vw, 34px)", fontWeight: 500, letterSpacing: "-0.03em" }}>
            Les quatre rotations, couvertes sans angle mort
          </h2>
          <div className="mt-10 flex flex-col gap-3">
            {ROTATIONS.map(([name, hours, roles, c], i) => (
              <div
                key={name}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-2xl px-6 py-6 md:grid-cols-[160px_180px_1fr_auto]"
                style={{ backgroundColor: c, color: i === 3 ? "#FAFAF8" : "#1A1A1A" }}
              >
                <div style={{ fontSize: 17, fontWeight: 500 }}>{name}</div>
                <div style={{ fontSize: 14, opacity: 0.75, fontVariantNumeric: "tabular-nums" }}>{hours}</div>
                <div style={{ fontSize: 14, opacity: 0.75 }}>{roles}</div>
                <div style={{ fontSize: 12.5, opacity: 0.8 }}>Couvert</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Deux colonnes texte + image portrait */}
      <section className="px-5 md:px-8 py-20 md:py-28">
        <div className="mx-auto grid gap-14 md:grid-cols-[1fr_0.8fr] md:items-start" style={{ maxWidth: 1180 }}>
          <div className="flex flex-col gap-11">
            {[
              ["Le night audit n'est pas un shift comme un autre", "Shift qui traverse minuit, majoration, repos obligatoire derrière : les règles sont appliquées à la génération, pas corrigées après coup."],
              ["Housekeeping et réception séparés", "Chaque employé porte ses postes. La couverture est évaluée métier par métier, pas en effectif global."],
              ["Contrats et heures maximum", "Temps partiels, étudiants, saisonniers : les plafonds sont suivis en continu et bloquent une affectation illégale."],
              ["Un contrôle avant publication", "Kadence liste les créneaux non couverts avant que le planning ne parte à l'équipe. Vous ne découvrez pas un trou à 23h."],
            ].map(([t, d]) => (
              <div key={t}>
                <div style={{ fontSize: 20, fontWeight: 500, letterSpacing: "-0.02em" }}>{t}</div>
                <p style={{ fontSize: 15.5, color: "var(--muted-foreground)", lineHeight: 1.85, marginTop: 10, maxWidth: 520 }}>
                  {d}
                </p>
              </div>
            ))}
          </div>
          <div className="rounded-[26px] overflow-hidden" style={{ aspectRatio: "3/4" }}>
            <img src={imgClosing} alt="Salle d'hôtel en fin de journée" className="h-full w-full object-cover" />
          </div>
        </div>
      </section>

      <CtaBand />
    </MarketingLayout>
  );
}
