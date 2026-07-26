import { Link } from "@tanstack/react-router";
import {
  CalendarRange,
  MapPin,
  ClipboardCheck,
  GraduationCap,
  BarChart3,
  CalendarCheck,
  ArrowRight,
} from "lucide-react";
import { MarketingLayout, Section, Eyebrow, H2, Lead, CtaBand, APP_URL } from "./MarketingLayout";
import { PlanningMock, PhoneMock, ClotureMock, PointageMock } from "./Mockups";
import imgCounter from "@/assets/mk-counter.jpg";
import imgTeam from "@/assets/mk-team.jpg";
import imgClosing from "@/assets/mk-closing.jpg";
import imgMobile from "@/assets/mk-mobile.jpg";

const FEATURES = [
  {
    icon: CalendarRange,
    title: "Planning généré automatiquement",
    text: "Décrivez vos besoins par jour et par poste. Kadence construit le mois en respectant contrats, disponibilités et heures maximum.",
  },
  {
    icon: CalendarCheck,
    title: "Disponibilités par établissement",
    text: "Chaque employé renseigne ses dispos, adresse par adresse. Fini les allers-retours WhatsApp avant chaque mois.",
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
    text: "Modules, vidéos et quiz accessibles depuis l'app. Un nouvel employé devient opérationnel plus vite.",
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
      <section className="px-5 md:px-8 pt-14 md:pt-20 pb-8">
        <div className="mx-auto" style={{ maxWidth: 1180 }}>
          <div style={{ maxWidth: 900 }}>
            <Eyebrow>Gestion d'équipe · Bruxelles</Eyebrow>
            <h1
              style={{
                fontSize: "clamp(38px, 7vw, 82px)",
                fontWeight: 500,
                letterSpacing: "-0.045em",
                lineHeight: 1.02,
              }}
            >
              Le planning de votre équipe,
              <br />
              <span style={{ color: "var(--coral-dark)" }}>réglé une bonne fois</span> pour toutes.
            </h1>
            <p
              style={{
                fontSize: 18,
                color: "var(--muted-foreground)",
                lineHeight: 1.8,
                marginTop: 24,
                maxWidth: 580,
              }}
            >
              Planning, disponibilités, pointage géolocalisé et clôtures de service dans un seul outil — pensé pour les
              cafés, restaurants et commerces à plusieurs adresses.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row gap-3">
              <Link
                to="/contact"
                className="rounded-full px-7 py-3.5 text-center transition-opacity hover:opacity-90"
                style={{ fontSize: 15, fontWeight: 500, backgroundColor: "var(--coral)", color: "#fff" }}
              >
                Demander une démo
              </Link>
              <a
                href={APP_URL}
                className="rounded-full px-7 py-3.5 text-center border transition-colors"
                style={{ fontSize: 15, fontWeight: 500, borderColor: "var(--border)", color: "var(--foreground)" }}
              >
                Se connecter
              </a>
            </div>
          </div>

          {/* Bandeau visuel */}
          <div className="mt-14 grid gap-4 lg:grid-cols-[1.55fr_1fr]">
            <div className="rounded-[26px] overflow-hidden" style={{ backgroundColor: "#F3F1EC", padding: "26px 22px" }}>
              <PlanningMock />
            </div>
            <div className="grid gap-4">
              <div className="rounded-[26px] overflow-hidden" style={{ minHeight: 200 }}>
                <img
                  src={imgCounter}
                  alt="Barista préparant un café derrière le comptoir"
                  className="w-full h-full object-cover"
                  style={{ minHeight: 200 }}
                  width={1600}
                  height={1104}
                  loading="eager"
                />
              </div>
              <div
                className="rounded-[26px] p-7 flex flex-col justify-between"
                style={{ backgroundColor: "#1A1A1A", minHeight: 210 }}
              >
                <div style={{ fontSize: 13, color: "rgba(250,250,248,0.55)", letterSpacing: "0.06em" }}>
                  UN MOIS DE PLANNING
                </div>
                <div>
                  <div style={{ fontSize: 52, fontWeight: 500, color: "#FAFAF8", letterSpacing: "-0.04em", lineHeight: 1 }}>
                    ~4 min
                  </div>
                  <p style={{ fontSize: 13.5, color: "rgba(250,250,248,0.6)", marginTop: 10, lineHeight: 1.7 }}>
                    Génération, ajustements et publication — au lieu d'une soirée sur un tableur.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Chiffres / valeur */}
      <Section tone="surface">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Zéro trou oublié", "Chaque besoin non couvert remonte avant publication, jour par jour et poste par poste."],
            ["Des heures fiables", "Le pointage géolocalisé remplace le carnet, les captures d'écran et les estimations."],
            ["Une équipe autonome", "Dispos, échanges de shift, clôtures et formation depuis leur téléphone."],
            ["Plusieurs adresses", "Des équipes partagées entre établissements, sans double planning à tenir."],
          ].map(([t, d]) => (
            <div key={t}>
              <div style={{ fontSize: 16, fontWeight: 500, letterSpacing: "-0.01em" }}>{t}</div>
              <p style={{ fontSize: 14.5, color: "var(--muted-foreground)", lineHeight: 1.8, marginTop: 10 }}>{d}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Bloc 1 — planning */}
      <Section>
        <div className="grid gap-14 lg:grid-cols-2 lg:items-center">
          <div>
            <Eyebrow>Côté gérant</Eyebrow>
            <H2>Vous décrivez vos besoins. Le planning se remplit.</H2>
            <Lead>
              Besoins en staff par jour, contrats étudiants, heures maximum, disponibilités déclarées, rotations entre
              établissements : tout est pris en compte avant que la première case ne se remplisse.
            </Lead>
            <div className="mt-9 flex flex-col gap-4">
              {[
                "Prévisualisation complète avant enregistrement",
                "Exclusion d'un employé pour simuler un scénario",
                "Les shifts verrouillés manuellement sont préservés",
              ].map((t) => (
                <div key={t} className="flex items-start gap-3">
                  <span
                    className="rounded-full mt-2"
                    style={{ width: 6, height: 6, backgroundColor: "var(--coral)", flexShrink: 0 }}
                  />
                  <span style={{ fontSize: 15, lineHeight: 1.7 }}>{t}</span>
                </div>
              ))}
            </div>
            <Link
              to="/fonctionnalites"
              className="inline-flex items-center gap-2 mt-9"
              style={{ fontSize: 15, color: "var(--coral-dark)", fontWeight: 500 }}
            >
              Voir toutes les fonctionnalités <ArrowRight size={16} />
            </Link>
          </div>
          <div className="rounded-[26px] p-6 md:p-8" style={{ backgroundColor: "#F3F1EC" }}>
            <PointageMock />
            <div className="mt-4 rounded-[20px] overflow-hidden">
              <img
                src={imgTeam}
                alt="Équipe de salle en briefing avant le service"
                className="w-full object-cover"
                style={{ height: 190 }}
                width={1600}
                height={1104}
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </Section>

      {/* Bloc 2 — mobile, fond sombre */}
      <Section tone="ink">
        <div className="grid gap-14 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <div className="order-2 lg:order-1">
            <PhoneMock />
          </div>
          <div className="order-1 lg:order-2">
            <Eyebrow tone="light">Côté équipe</Eyebrow>
            <h2
              style={{
                fontSize: "clamp(28px, 4vw, 44px)",
                fontWeight: 500,
                letterSpacing: "-0.03em",
                lineHeight: 1.12,
                color: "#FAFAF8",
              }}
            >
              Une application mobile que vos employés ouvrent vraiment
            </h2>
            <p style={{ fontSize: 16.5, color: "rgba(250,250,248,0.65)", lineHeight: 1.8, marginTop: 18, maxWidth: 560 }}>
              Leurs shifts de la semaine, leurs collègues du jour, le relais du poste, leur pointage, leurs demandes de
              changement et leur formation. Sans compte à créer, sans formation à donner.
            </p>
            <div className="mt-10 grid gap-6 sm:grid-cols-2">
              {[
                ["iOS, Android et web", "La même app partout, notifications comprises."],
                ["Pointage en un geste", "Position vérifiée, heures fiables, zéro saisie."],
                ["Clôtures guidées", "Checklist photo, étape par étape, en fin de service."],
                ["Échanges de shift", "Demande envoyée, remplaçant proposé, validation gérant."],
              ].map(([t, d]) => (
                <div key={t}>
                  <div style={{ fontSize: 15, fontWeight: 500, color: "#FAFAF8" }}>{t}</div>
                  <p style={{ fontSize: 13.5, color: "rgba(250,250,248,0.55)", lineHeight: 1.7, marginTop: 6 }}>{d}</p>
                </div>
              ))}
            </div>
            <div className="mt-10 rounded-[22px] overflow-hidden">
              <img
                src={imgMobile}
                alt="Employé consultant son planning sur son téléphone"
                className="w-full object-cover"
                style={{ height: 200 }}
                width={1200}
                height={1504}
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </Section>

      {/* Bloc 3 — clôtures */}
      <Section>
        <div className="grid gap-14 lg:grid-cols-2 lg:items-center">
          <div className="rounded-[26px] p-6 md:p-8" style={{ backgroundColor: "#F3F1EC" }}>
            <ClotureMock />
          </div>
          <div>
            <Eyebrow>Fin de service</Eyebrow>
            <H2>Ce qui a été fait, prouvé en photo</H2>
            <Lead>
              Chaque clôture suit une checklist définie par vous, avec photo de référence à l'appui. Le lendemain matin,
              vous savez ce qui a été fait — et par qui.
            </Lead>
            <div className="mt-8 rounded-[22px] overflow-hidden">
              <img
                src={imgClosing}
                alt="Salle de café fermée en fin de journée"
                className="w-full object-cover"
                style={{ height: 230 }}
                width={1600}
                height={1104}
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </Section>

      {/* Fonctionnalités */}
      <Section tone="surface">
        <Eyebrow>Ce que fait Kadence</Eyebrow>
        <H2>Tout le cycle d'un service, au même endroit</H2>
        <Lead>Du besoin en staff à la clôture de caisse, chaque étape est couverte — et reliée à la précédente.</Lead>

        <div className="mt-14 grid gap-px" style={{ backgroundColor: "var(--border)" }}>
          <div className="grid md:grid-cols-3 gap-px" style={{ backgroundColor: "var(--border)" }}>
            {FEATURES.map((f) => (
              <div key={f.title} className="p-8" style={{ backgroundColor: "#F3F1EC" }}>
                <f.icon size={20} style={{ color: "var(--coral-dark)" }} />
                <div style={{ fontSize: 16, fontWeight: 500, marginTop: 18, letterSpacing: "-0.01em" }}>{f.title}</div>
                <p style={{ fontSize: 14, color: "var(--muted-foreground)", lineHeight: 1.8, marginTop: 10 }}>{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Comment ça marche */}
      <Section>
        <Eyebrow>En pratique</Eyebrow>
        <H2>Trois étapes, puis ça tourne</H2>

        <div className="mt-14 grid gap-12 md:grid-cols-3">
          {[
            ["01", "On configure vos établissements", "Postes, horaires d'ouverture, besoins en staff par jour, contrats et quotas d'heures."],
            ["02", "Votre équipe renseigne ses dispos", "Chaque employé reçoit un accès mobile et remplit ses disponibilités du mois."],
            ["03", "Vous enregistrez le planning", "Kadence propose une répartition complète. Vous ajustez, vous publiez, l'équipe est notifiée."],
          ].map(([n, t, d]) => (
            <div key={n} className="pt-6" style={{ borderTop: "1px solid var(--border)" }}>
              <div style={{ fontSize: 13, color: "var(--coral-dark)", fontWeight: 500, letterSpacing: "0.1em" }}>{n}</div>
              <div style={{ fontSize: 18, fontWeight: 500, marginTop: 14, letterSpacing: "-0.01em" }}>{t}</div>
              <p style={{ fontSize: 14.5, color: "var(--muted-foreground)", lineHeight: 1.8, marginTop: 10 }}>{d}</p>
            </div>
          ))}
        </div>
      </Section>

      <CtaBand />
    </MarketingLayout>
  );
}
