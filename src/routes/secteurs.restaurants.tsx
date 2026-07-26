import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingLayout, CtaBand } from "@/components/marketing/MarketingLayout";
import imgTeam from "@/assets/mk-team.jpg";

export const Route = createFileRoute("/secteurs/restaurants")({
  component: RestaurantsPage,
  head: () => ({
    meta: [
      { title: "Planning pour restaurants — salle, cuisine, coupures | Kadence" },
      {
        name: "description",
        content:
          "Kadence organise les services midi et soir : coupures, équilibre salle/cuisine, heures réelles pointées et clôtures photo. Le planning du mois généré en quelques minutes.",
      },
      { property: "og:title", content: "Planning pour restaurants — Kadence" },
      { property: "og:description", content: "Services midi et soir, coupures, salle et cuisine : un planning qui tient le vendredi." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://kadence.be/secteurs/restaurants" },
    ],
    links: [{ rel: "canonical", href: "https://kadence.be/secteurs/restaurants" }],
  }),
});

const SERVICE = [
  ["09:30", "Mise en place", "Cuisine · 2 personnes", "#F0997B"],
  ["11:45", "Ouverture midi", "Salle · 3 · Cuisine · 3", "#7BA8B8"],
  ["15:00", "Coupure", "Repos légal respecté", "#C7C3BB"],
  ["18:00", "Reprise du soir", "Salle · 4 · Cuisine · 3", "#9B7BC9"],
  ["23:30", "Clôture", "Checklist photo + caisse", "#1A1A1A"],
];

function RestaurantsPage() {
  return (
    <MarketingLayout>
      {/* Hero sombre pleine largeur */}
      <section style={{ backgroundColor: "#1A1A1A", color: "#FAFAF8" }} className="px-5 md:px-8 py-14 md:py-28">
        <div className="mx-auto" style={{ maxWidth: 1180 }}>
          <div
            className="inline-flex rounded-full px-3.5 py-1.5 mb-7"
            style={{
              fontSize: 11.5,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              backgroundColor: "rgba(250,250,248,0.1)",
              color: "rgba(250,250,248,0.85)",
            }}
          >
            Restaurants
          </div>
          <h1
            style={{
              fontSize: "clamp(34px, 6.4vw, 78px)",
              fontWeight: 500,
              letterSpacing: "-0.04em",
              lineHeight: 1.02,
              maxWidth: 980,
            }}
          >
            Deux services par jour. Zéro place pour l'improvisation.
          </h1>
          <div className="mt-10 grid gap-10 md:grid-cols-[1fr_auto] md:items-end">
            <p style={{ fontSize: 17, color: "rgba(250,250,248,0.65)", lineHeight: 1.85, maxWidth: 560 }}>
              Midi, coupure, soir. Salle et cuisine qui ne se remplacent pas. Des extras le week-end. Kadence construit
              le planning avec ces règles dans le moteur — et signale la moindre couverture manquante avant que vous ne
              publiiez.
            </p>
            <Link
              to="/contact"
              className="rounded-full px-8 py-4 text-center transition-opacity hover:opacity-90"
              style={{ fontSize: 15, fontWeight: 500, backgroundColor: "var(--coral)", color: "#fff" }}
            >
              Demander une démo
            </Link>
          </div>
        </div>
      </section>

      {/* Journée type — timeline verticale */}
      <section className="px-5 md:px-8 py-14 md:py-28">
        <div className="mx-auto grid gap-14 md:grid-cols-[0.85fr_1.15fr]" style={{ maxWidth: 1180 }}>
          <div>
            <h2 style={{ fontSize: "clamp(26px, 3.6vw, 40px)", fontWeight: 500, letterSpacing: "-0.03em", lineHeight: 1.15 }}>
              Une journée de service, telle que Kadence la lit
            </h2>
            <p style={{ fontSize: 16, color: "var(--muted-foreground)", lineHeight: 1.8, marginTop: 16 }}>
              Vos besoins se décrivent une fois par poste et par jour de la semaine. Ensuite, chaque mois se génère
              dessus.
            </p>
          </div>
          <div>
            {SERVICE.map(([h, t, d, c], i) => (
              <div key={h} className="grid grid-cols-[64px_20px_1fr] gap-4" style={{ paddingBottom: i === SERVICE.length - 1 ? 0 : 34 }}>
                <div style={{ fontSize: 13.5, color: "var(--muted-foreground)", paddingTop: 2, fontVariantNumeric: "tabular-nums" }}>
                  {h}
                </div>
                <div className="relative flex justify-center">
                  <span className="rounded-full" style={{ width: 11, height: 11, backgroundColor: c, marginTop: 5 }} />
                  {i !== SERVICE.length - 1 && (
                    <span className="absolute" style={{ top: 20, bottom: -34, width: 1, backgroundColor: "var(--border)" }} />
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 500 }}>{t}</div>
                  <div style={{ fontSize: 14, color: "var(--muted-foreground)", marginTop: 4 }}>{d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Image large + arguments alternés */}
      <section className="px-5 md:px-8 pb-4">
        <div className="mx-auto rounded-[26px] overflow-hidden" style={{ maxWidth: 1180, aspectRatio: "21/9" }}>
          <img src={imgTeam} alt="Équipe de restaurant en plein service" className="h-full w-full object-cover" />
        </div>
      </section>

      <section className="px-5 md:px-8 py-14 md:py-24">
        <div className="mx-auto flex flex-col gap-14" style={{ maxWidth: 900 }}>
          {[
            ["Les coupures gérées correctement", "Un service midi puis soir n'est pas un shift de dix heures. Kadence découpe, respecte le repos minimum et compte les heures réelles."],
            ["Salle et cuisine ne sont pas interchangeables", "Chaque employé porte ses postes. Un commis ne comble pas un trou en salle par accident de génération."],
            ["Les extras du week-end", "Ajoutez un renfort ponctuel : il reçoit sa proposition sur son téléphone et l'accepte ou la refuse en un tap."],
            ["Clôture caisse et cuisine", "Checklists distinctes avec photos obligatoires. La fermeture est tracée, datée et consultable le lendemain."],
          ].map(([t, d], i) => (
            <div key={t} className="grid gap-4 md:grid-cols-[auto_1fr] md:gap-10">
              <div style={{ fontSize: 13, color: "var(--coral)", fontVariantNumeric: "tabular-nums", paddingTop: 6 }}>
                0{i + 1}
              </div>
              <div>
                <div style={{ fontSize: "clamp(19px, 2.4vw, 24px)", fontWeight: 500, letterSpacing: "-0.02em" }}>{t}</div>
                <p style={{ fontSize: 15.5, color: "var(--muted-foreground)", lineHeight: 1.85, marginTop: 10 }}>{d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <CtaBand />
    </MarketingLayout>
  );
}
