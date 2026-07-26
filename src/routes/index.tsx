import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { getAppMode } from "@/lib/app-mode";
import { getHostContext } from "@/lib/marketing.functions";
import { MarketingHome } from "@/components/marketing/MarketingHome";

export const Route = createFileRoute("/")({
  loader: async () => {
    try {
      return await getHostContext();
    } catch {
      return { host: "", isMarketing: false };
    }
  },
  head: ({ loaderData }) =>
    loaderData?.isMarketing
      ? {
          meta: [
            { title: "Kadence — Le planning d'équipe pour les commerces" },
            {
              name: "description",
              content:
                "Planning automatique, disponibilités, pointage géolocalisé et clôtures : Kadence réunit la gestion d'équipe des cafés et restaurants dans un seul outil.",
            },
            { property: "og:title", content: "Kadence — Le planning d'équipe pour les commerces" },
            {
              property: "og:description",
              content: "Planning, dispos, pointage et clôtures dans un seul outil. Conçu à Bruxelles.",
            },
            { property: "og:type", content: "website" },
            { property: "og:url", content: "https://kadence.be/" },
          ],
          links: [{ rel: "canonical", href: "https://kadence.be/" }],
          scripts: [
            {
              type: "application/ld+json",
              children: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "SoftwareApplication",
                name: "Kadence",
                applicationCategory: "BusinessApplication",
                operatingSystem: "Web, iOS, Android",
                url: "https://kadence.be/",
                description:
                  "Logiciel de gestion d'équipe : planning automatique, disponibilités, pointage géolocalisé et clôtures.",
                offers: { "@type": "Offer", price: "0", priceCurrency: "EUR", description: "Tarif sur demande" },
              }),
            },
          ],
        }
      : { meta: [{ title: "Kadence" }] },
  component: IndexPage,
});

function IndexPage() {
  const { isMarketing } = Route.useLoaderData();
  if (isMarketing) return <MarketingHome />;
  return <IndexRedirect />;
}

function IndexRedirect() {
  const { session, appRole, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--background)" }}>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Chargement...</p>
      </div>
    );
  }

  if (!session) {
    const mode = getAppMode();
    if (mode === "marketing") return <MarketingHome />;
    return <Navigate to="/login" search={{ mode }} />;
  }

  if (appRole === "employee") return <Navigate to="/staff-app" />;
  return <Navigate to="/dashboard" />;
}
