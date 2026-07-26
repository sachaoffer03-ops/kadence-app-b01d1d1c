import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/confidentialite")({
  component: ConfidentialitePage,
  head: () => ({
    meta: [
      { title: "Politique de confidentialité — Kadence" },
      {
        name: "description",
        content:
          "Comment Kadence collecte, utilise et conserve les données des employés : finalités, durées de conservation, droits RGPD et sous-traitants.",
      },
      { property: "og:title", content: "Politique de confidentialité — Kadence" },
      {
        property: "og:description",
        content:
          "Données collectées, finalités, conservation, droits RGPD et sous-traitants de l'application Kadence.",
      },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "https://app.kadence.be/confidentialite" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://app.kadence.be/confidentialite" }],
  }),
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 15, fontWeight: 500, marginBottom: 10 }}>{title}</h2>
      <div style={{ fontSize: 13.5, lineHeight: 1.75, color: "var(--muted-foreground)" }}>{children}</div>
    </section>
  );
}

function ConfidentialitePage() {
  return (
    <div style={{ backgroundColor: "var(--background)", minHeight: "100dvh" }}>
      <div
        className="mx-auto"
        style={{
          maxWidth: 720,
          padding: "48px 20px calc(64px + env(safe-area-inset-bottom))",
        }}
      >
        <h1 style={{ fontSize: 26, fontWeight: 500, letterSpacing: "-0.01em" }}>
          Politique de confidentialité
        </h1>
        <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 8 }}>
          Application Kadence — dernière mise à jour : juillet 2026
        </p>

        <Section title="1. Responsable du traitement">
          Kadence, Bruxelles, Belgique.
          <br />
          Contact vie privée :{" "}
          <a href="mailto:privacy@kadence.be" style={{ color: "var(--primary)" }}>
            privacy@kadence.be
          </a>
        </Section>

        <Section title="2. Données collectées">
          <ul style={{ paddingLeft: 18, listStyle: "disc" }}>
            <li>Nom, prénom, adresse email, numéro de téléphone, adresse postale</li>
            <li>IBAN (pour la paie)</li>
            <li>Photo de profil</li>
            <li>Planning, pointages et historique de shifts</li>
            <li>
              Position GPS uniquement au moment exact du pointage
            </li>
            <li>Réponses aux checklists et aux clôtures</li>
            <li>Signalements et feedbacks</li>
          </ul>
        </Section>

        <Section title="3. Finalité de chaque donnée">
          <ul style={{ paddingLeft: 18, listStyle: "disc" }}>
            <li>
              <strong style={{ fontWeight: 500, color: "var(--foreground)" }}>Identité et contact</strong> :
              gestion du compte et communication opérationnelle.
            </li>
            <li>
              <strong style={{ fontWeight: 500, color: "var(--foreground)" }}>IBAN</strong> : virement des
              salaires par votre employeur.
            </li>
            <li>
              <strong style={{ fontWeight: 500, color: "var(--foreground)" }}>Planning et pointages</strong> :
              gestion des shifts et de la paie.
            </li>
            <li>
              <strong style={{ fontWeight: 500, color: "var(--foreground)" }}>Position GPS</strong> :
              vérification de présence sur le lieu de travail au moment exact du pointage. Elle n'est jamais
              enregistrée en dehors de ce moment et n'est jamais utilisée pour du suivi.
            </li>
            <li>
              <strong style={{ fontWeight: 500, color: "var(--foreground)" }}>Photos et signalements</strong> :
              suivi opérationnel des studios.
            </li>
          </ul>
        </Section>

        <Section title="4. Durée de conservation">
          Les données identifiantes sont supprimées sur demande, directement depuis l'application (Profil →
          Zone de danger → Supprimer mon compte). Les données comptables (shifts, pointages, clôtures) sont
          conservées 7 ans sous forme anonymisée, sans lien avec votre identité, conformément à l'obligation
          légale belge de conservation des documents comptables et sociaux.
        </Section>

        <Section title="5. Vos droits RGPD">
          Vous disposez d'un droit d'accès, de rectification, d'effacement, de portabilité, d'opposition et de
          limitation du traitement. Pour exercer ces droits :{" "}
          <a href="mailto:privacy@kadence.be" style={{ color: "var(--primary)" }}>
            privacy@kadence.be
          </a>
        </Section>

        <Section title="6. Sous-traitants">
          <ul style={{ paddingLeft: 18, listStyle: "disc" }}>
            <li>Supabase — hébergement et base de données</li>
            <li>Resend — envoi des emails</li>
            <li>Median — encapsulation de l'application mobile</li>
            <li>OneSignal — notifications push</li>
          </ul>
        </Section>

        <Section title="7. Cookies">
          Kadence utilise uniquement des cookies et un stockage techniques, nécessaires au maintien de votre
          session. Aucun cookie de tracking, de publicité ou de profilage n'est déposé.
        </Section>

        <Section title="8. Réclamation">
          Vous pouvez introduire une réclamation auprès de l'Autorité de protection des données belge —{" "}
          <a
            href="https://www.autoriteprotectiondonnees.be"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--primary)" }}
          >
            autoriteprotectiondonnees.be
          </a>
        </Section>

        <div style={{ marginTop: 40 }}>
          <Link to="/login" style={{ fontSize: 12, color: "var(--primary)" }}>
            ← Retour à la connexion
          </Link>
        </div>
      </div>
    </div>
  );
}
