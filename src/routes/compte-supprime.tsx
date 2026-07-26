import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/compte-supprime")({
  component: CompteSupprimePage,
  head: () => ({
    meta: [
      { title: "Compte supprimé — Kadence" },
      { name: "description", content: "Votre compte Kadence a été supprimé." },
      { property: "og:title", content: "Compte supprimé — Kadence" },
      { property: "og:description", content: "Votre compte Kadence a été supprimé." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function CompteSupprimePage() {
  return (
    <div
      className="flex items-center justify-center px-6"
      style={{ minHeight: "100dvh", backgroundColor: "var(--background)" }}
    >
      <div style={{ maxWidth: 380, textAlign: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 500 }}>Votre compte a été supprimé.</div>
        <p style={{ fontSize: 13.5, lineHeight: 1.7, color: "var(--muted-foreground)", marginTop: 12 }}>
          Merci d'avoir utilisé Kadence.
        </p>
        <p style={{ fontSize: 12, lineHeight: 1.7, color: "var(--muted-foreground)", marginTop: 16 }}>
          Vos données personnelles ont été effacées. Votre historique de travail est conservé de façon
          anonymisée pendant 7 ans, comme l'impose la législation comptable belge.
        </p>
        <a
          href="/confidentialite"
          style={{ display: "inline-block", marginTop: 24, fontSize: 12, color: "var(--primary)" }}
        >
          Politique de confidentialité
        </a>
      </div>
    </div>
  );
}
