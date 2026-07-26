import { Link } from "@tanstack/react-router";
import {
  CalendarRange,
  MapPin,
  ClipboardCheck,
  GraduationCap,
  BarChart3,
  Bell,
  Smartphone,
  CalendarCheck,
} from "lucide-react";
import { MarketingLayout, Section, Eyebrow, H2, Lead, CtaBand, APP_URL } from "./MarketingLayout";
import heroShot from "@/assets/marketing-hero.jpg";

const FEATURES = [
  {
    icon: CalendarRange,
    title: "Planning généré automatiquement",
    text: "Vous décrivez vos besoins en staff par jour et par poste. Kadence construit le planning en respectant contrats, disponibilités et heures max.",
  },
  {
    icon: CalendarCheck,
    title: "Disponibilités par établissement",
    text: "Chaque employé renseigne ses dispos, établissement par établissement. Fini les allers-retours WhatsApp avant chaque mois.",
  },
  {
    icon: MapPin,
    title: "Pointage géolocalisé",
    text: "Arrivée et départ pointés depuis le téléphone, avec vérification de la position sur le lieu de travail.",
  },
  {
    icon: ClipboardCheck,
    title: "Ouvertures et clôtures",
    text: "Checklists photo obligatoires en fin de service. Vous voyez ce qui a été fait, et ce qui ne l'a pas été.",
  },
  {
    icon: GraduationCap,
    title: "Formation interne",
    text: "Modules, vidéos et quiz accessibles depuis l'app. Un nouvel employé est opérationnel plus vite.",
  },
  {
    icon: BarChart3,
    title: "Rapports et suivi d'équipe",
    text: "Heures travaillées, retards, notations de shift, coût par établissement. Les chiffres sont déjà là.",
  },
];

export function MarketingHome() {
  return (
    <MarketingLayout>
      {/* Hero */}
      <section className="px-5 md:px-8 pt-16 md:pt-24 pb-10">
        <div className="mx-auto" style={{ maxWidth: 1120 }}>
          <div className="grid gap-12 md:grid-cols-2 md:items-center">
            <div>
              <Eyebrow>Gestion d'équipe · Bruxelles</Eyebrow>
              <h1
                style={{
                  fontSize: "clamp(32px, 5.2vw, 52px)",
                  fontWeight: 500,
                  letterSpacing: "-0.03em",
                  lineHeight: 1.08,
                }}
              >
                Le planning de votre équipe, réglé une bonne fois pour toutes
              </h1>
              <p style={{ fontSize: 17, color: "var(--muted-foreground)", lineHeight: 1.75, marginTop: 18, maxWidth: 520 }}>
                Kadence réunit planning, disponibilités, pointage et clôtures dans un seul outil, pensé pour les
                cafés, restaurants et commerces à plusieurs établissements.
              </p>

              <div className="mt-9 flex flex-col sm:flex-row gap-3">
                <Link
                  to="/contact"
                  className="rounded-full px-6 py-3 text-center transition-opacity hover:opacity-90"
                  style={{ fontSize: 15, fontWeight: 500, backgroundColor: "var(--coral)", color: "#fff" }}
                >
                  Demander une démo
                </Link>
                <a
                  href={APP_URL}
                  className="rounded-full px-6 py-3 text-center border transition-colors"
                  style={{ fontSize: 15, fontWeight: 500, borderColor: "var(--border)", color: "var(--foreground)" }}
                >
                  Se connecter
                </a>
              </div>

              <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 18 }}>
                Utilisé quotidiennement par les équipes de Skult Studios, à Bruxelles.
              </p>
            </div>

            <div className="rounded-3xl overflow-hidden border" style={{ borderColor: "var(--border)" }}>
              <img
                src={heroShot}
                alt="Aperçu du planning d'équipe dans Kadence"
                className="w-full h-auto block"
                loading="eager"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Bandeau valeur */}
      <Section tone="surface">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Moins d'heures perdues", "Le planning du mois se construit en quelques minutes, pas en une soirée."],
            ["Zéro trou oublié", "Chaque besoin non couvert remonte immédiatement, avant publication."],
            ["Des heures fiables", "Le pointage géolocalisé remplace le carnet et les estimations."],
            ["Une équipe autonome", "Dispos, échanges de shift et formation depuis leur téléphone."],
          ].map(([t, d]) => (
            <div key={t}>
              <div style={{ fontSize: 15, fontWeight: 500 }}>{t}</div>
              <p style={{ fontSize: 14, color: "var(--muted-foreground)", lineHeight: 1.7, marginTop: 8 }}>{d}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Fonctionnalités */}
      <Section>
        <Eyebrow>Ce que fait Kadence</Eyebrow>
        <H2>Tout le cycle d'un service, au même endroit</H2>
        <Lead>
          Du besoin en staff à la clôture de caisse, chaque étape est couverte — et reliée à la précédente.
        </Lead>

        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border p-6"
              style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
            >
              <div
                className="rounded-xl flex items-center justify-center mb-4"
                style={{ width: 40, height: 40, backgroundColor: "var(--coral-light)" }}
              >
                <f.icon size={18} style={{ color: "var(--coral-dark)" }} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 500 }}>{f.title}</div>
              <p style={{ fontSize: 14, color: "var(--muted-foreground)", lineHeight: 1.7, marginTop: 8 }}>{f.text}</p>
            </div>
          ))}
        </div>

        <div className="mt-8">
          <Link to="/fonctionnalites" style={{ fontSize: 14, color: "var(--coral-dark)", fontWeight: 500 }}>
            Voir toutes les fonctionnalités →
          </Link>
        </div>
      </Section>

      {/* Comment ça marche */}
      <Section tone="surface">
        <Eyebrow>En pratique</Eyebrow>
        <H2>Trois étapes, puis ça tourne</H2>

        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {[
            ["01", "On configure vos établissements", "Postes, horaires d'ouverture, besoins en staff par jour, contrats et quotas d'heures."],
            ["02", "Votre équipe renseigne ses dispos", "Chaque employé reçoit un accès mobile et remplit ses disponibilités du mois."],
            ["03", "Vous publiez le planning", "Kadence propose une répartition complète. Vous ajustez, vous publiez, l'équipe est notifiée."],
          ].map(([n, t, d]) => (
            <div key={n}>
              <div style={{ fontSize: 13, color: "var(--coral-dark)", fontWeight: 500, letterSpacing: "0.06em" }}>{n}</div>
              <div style={{ fontSize: 16, fontWeight: 500, marginTop: 10 }}>{t}</div>
              <p style={{ fontSize: 14, color: "var(--muted-foreground)", lineHeight: 1.7, marginTop: 8 }}>{d}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* App mobile */}
      <Section>
        <div className="grid gap-10 md:grid-cols-2 md:items-center">
          <div>
            <Eyebrow>Côté équipe</Eyebrow>
            <H2>Une application mobile que vos employés ouvrent vraiment</H2>
            <Lead>
              Leurs shifts de la semaine, leurs collègues du jour, leur pointage, leurs demandes de changement et
              leur formation. Sans compte à créer, sans formation à donner.
            </Lead>
            <div className="mt-8 flex flex-col gap-3">
              {[
                [Smartphone, "iOS et Android, plus le web"],
                [Bell, "Notifications de planning et de shift"],
                [ClipboardCheck, "Clôtures guidées, photos à l'appui"],
              ].map(([Icon, label], i) => {
                const I = Icon as typeof Smartphone;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <I size={16} style={{ color: "var(--coral-dark)" }} />
                    <span style={{ fontSize: 14 }}>{label as string}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div
            className="rounded-3xl border p-8"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", letterSpacing: "0.06em" }}>AUJOURD'HUI</div>
            <div style={{ fontSize: 22, fontWeight: 500, marginTop: 6 }}>Service du soir</div>
            <div className="mt-6 flex flex-col gap-3">
              {[
                ["17:30 – 21:15", "Barista · Châtelain"],
                ["18:00 – 22:00", "Accueil · Rhode"],
                ["19:00 – 23:00", "Cuisine · Châtelain"],
              ].map(([h, r]) => (
                <div
                  key={h}
                  className="rounded-xl border px-4 py-3 flex items-center justify-between"
                  style={{ borderColor: "var(--border)" }}
                >
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{h}</span>
                  <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>{r}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      <CtaBand />
    </MarketingLayout>
  );
}
