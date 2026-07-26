import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingLayout, CtaBand, APP_URL } from "@/components/marketing/MarketingLayout";
import { PlanningMock } from "@/components/marketing/Mockups";
import imgCounter from "@/assets/mk-counter.jpg";

export const Route = createFileRoute("/secteurs/cafes")({
  component: CafesPage,
  head: () => ({
    meta: [
      { title: "Planning pour cafés et coffeeshops — Kadence" },
      {
        name: "description",
        content:
          "Kadence planifie les équipes de cafés et coffeeshops : étudiants, quotas d'heures, plusieurs adresses, dispos par établissement et pointage géolocalisé.",
      },
      { property: "og:title", content: "Planning pour cafés et coffeeshops — Kadence" },
      { property: "og:description", content: "Étudiants, quotas d'heures, plusieurs adresses : le planning du mois en une génération." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://kadence.be/secteurs/cafes" },
    ],
    links: [{ rel: "canonical", href: "https://kadence.be/secteurs/cafes" }],
  }),
});

const STATS = [
  ["3 min", "pour générer un mois complet"],
  ["100 %", "des quotas étudiants contrôlés"],
  ["0", "tableur à maintenir à côté"],
];

function CafesPage() {
  return (
    <MarketingLayout>
      {/* Hero split coral */}
      <section className="px-5 md:px-8 pt-12 md:pt-16">
        <div className="mx-auto grid gap-10 md:grid-cols-[1.05fr_1fr] md:items-center" style={{ maxWidth: 1180 }}>
          <div>
            <div
              className="inline-flex rounded-full px-3.5 py-1.5 mb-6"
              style={{
                fontSize: 11.5,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                backgroundColor: "var(--coral-light)",
                color: "var(--coral-dark)",
                fontWeight: 500,
              }}
            >
              Cafés & coffeeshops
            </div>
            <h1 style={{ fontSize: "clamp(34px, 5.6vw, 66px)", fontWeight: 500, letterSpacing: "-0.035em", lineHeight: 1.05 }}>
              Une équipe d'étudiants,
              <br />
              deux comptoirs,
              <br />
              <span style={{ color: "var(--coral)" }}>un seul planning.</span>
            </h1>
            <p style={{ fontSize: 17, color: "var(--muted-foreground)", lineHeight: 1.8, marginTop: 22, maxWidth: 520 }}>
              Les cafés vivent de rotations courtes et de personnel à temps partiel. Kadence connaît ces contraintes :
              contrats étudiants, plafonds d'heures, disponibilités qui changent chaque mois, et des baristas qui
              tournent d'une adresse à l'autre.
            </p>
            <div className="mt-9 flex flex-col sm:flex-row gap-3">
              <Link
                to="/contact"
                className="rounded-full px-7 py-3.5 text-center transition-opacity hover:opacity-90"
                style={{ fontSize: 15, fontWeight: 500, backgroundColor: "var(--coral)", color: "#fff" }}
              >
                Demander une démo
              </Link>
              <a
                href={APP_URL}
                className="rounded-full px-7 py-3.5 text-center border transition-opacity hover:opacity-70"
                style={{ fontSize: 15, fontWeight: 500, borderColor: "var(--border)" }}
              >
                Se connecter
              </a>
            </div>
          </div>
          <div className="rounded-[26px] overflow-hidden" style={{ aspectRatio: "4/5" }}>
            <img src={imgCounter} alt="Comptoir de café en service" className="h-full w-full object-cover" />
          </div>
        </div>
      </section>

      {/* Stats band */}
      <section className="px-5 md:px-8 py-16 md:py-20">
        <div className="mx-auto grid gap-8 sm:grid-cols-3" style={{ maxWidth: 1180 }}>
          {STATS.map(([n, l]) => (
            <div key={l} style={{ borderTop: "2px solid var(--coral)", paddingTop: 18 }}>
              <div style={{ fontSize: 34, fontWeight: 500, letterSpacing: "-0.03em" }}>{n}</div>
              <div style={{ fontSize: 14, color: "var(--muted-foreground)", marginTop: 6, lineHeight: 1.7 }}>{l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Mockup */}
      <section className="px-5 md:px-8 py-14 md:py-24" style={{ backgroundColor: "#F3F1EC" }}>
        <div className="mx-auto" style={{ maxWidth: 1180 }}>
          <h2 style={{ fontSize: "clamp(26px, 3.6vw, 40px)", fontWeight: 500, letterSpacing: "-0.03em", maxWidth: 620, lineHeight: 1.15 }}>
            Le mois entier, poste par poste, avant le 25
          </h2>
          <p style={{ fontSize: 16, color: "var(--muted-foreground)", lineHeight: 1.8, marginTop: 16, maxWidth: 560 }}>
            Vous décrivez vos besoins par jour — barista, accueil, cuisine — et Kadence remplit en respectant les
            disponibilités de chacun. Les trous restants sont signalés, pas cachés.
          </p>
          <div className="mt-12">
            <PlanningMock />
          </div>
        </div>
      </section>

      {/* Arguments en colonnes serrées */}
      <section className="px-5 md:px-8 py-14 md:py-24">
        <div className="mx-auto grid gap-x-14 gap-y-12 md:grid-cols-3" style={{ maxWidth: 1180 }}>
          {[
            ["Contrats étudiants sous contrôle", "Le quota trimestriel est suivi automatiquement. Un dépassement est bloqué avant la publication, pas découvert à la paie."],
            ["Dispos par établissement", "Un barista disponible le samedi au centre mais pas en périphérie ? Les disponibilités se renseignent adresse par adresse."],
            ["Pointage sur place", "Arrivée et départ depuis le téléphone, position vérifiée. Les heures réelles alimentent directement vos rapports."],
            ["Ouvertures et clôtures", "Checklists photo à la fermeture. Vous savez le lendemain matin ce qui a été fait, sans appeler personne."],
            ["Remplacements express", "Un désistement le matin ? L'employé propose, les collègues éligibles reçoivent l'offre, vous validez d'un tap."],
            ["Formation des nouveaux", "Recettes, procédures et quiz dans l'app. Un nouveau barista est autonome plus vite."],
          ].map(([t, d]) => (
            <div key={t}>
              <div style={{ fontSize: 16.5, fontWeight: 500, letterSpacing: "-0.01em" }}>{t}</div>
              <p style={{ fontSize: 14, color: "var(--muted-foreground)", lineHeight: 1.8, marginTop: 10 }}>{d}</p>
            </div>
          ))}
        </div>
      </section>

      <CtaBand />
    </MarketingLayout>
  );
}
