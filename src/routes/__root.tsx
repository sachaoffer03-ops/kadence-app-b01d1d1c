import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { AppSidebar, MobileSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "var(--background)" }}>
      <div className="max-w-md text-center">
        <h1 style={{ fontSize: 48, fontWeight: 500 }}>404</h1>
        <p style={{ fontSize: 14, color: "var(--muted-foreground)", marginTop: 8 }}>
          Cette page n'existe pas.
        </p>
        <div className="mt-6">
          <Link
            to="/dashboard"
            className="inline-flex items-center justify-center rounded-md px-4 py-2"
            style={{
              fontSize: 13,
              fontWeight: 500,
              backgroundColor: "var(--foreground)",
              color: "var(--card)",
            }}
          >
            Retour au dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "var(--background)" }}>
      <div className="max-w-md text-center">
        <h1 style={{ fontSize: 18, fontWeight: 500 }}>Erreur de chargement</h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 8 }}>
          Quelque chose s'est mal passé. Essayez de recharger.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="inline-flex items-center justify-center rounded-md px-4 py-2"
            style={{ fontSize: 13, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}
          >
            Réessayer
          </button>
          <a
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-md border px-4 py-2"
            style={{ fontSize: 13, fontWeight: 500, borderColor: "var(--border)" }}
          >
            Accueil
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Shifty — Skult Studios" },
      { name: "description", content: "Gestion du staff pour Skult Studios" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const currentPath = useRouterState({ select: (s) => s.location.pathname });

  const isStaffApp = currentPath.startsWith("/staff-app");

  if (isStaffApp) {
    return (
      <QueryClientProvider client={queryClient}>
        <Outlet />
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex min-h-screen" style={{ backgroundColor: "var(--background)" }}>
        <AppSidebar />
        <div className="flex-1 flex flex-col" style={{ marginLeft: 220 }}>
          <TopBar />
          <main className="flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </QueryClientProvider>
  );
}
