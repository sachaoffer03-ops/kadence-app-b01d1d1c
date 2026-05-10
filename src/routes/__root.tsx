import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  useNavigate,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { AppSidebar, MobileSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/hooks/use-auth";

import appCss from "../styles.css?url";

const PUBLIC_ROUTES = ["/login", "/activation", "/reset-password"];

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
      { title: "Kadence" },
      { name: "description", content: "Gestion du staff" },
      { property: "og:title", content: "Kadence" },
      { name: "twitter:title", content: "Kadence" },
      { property: "og:description", content: "Gestion du staff" },
      { name: "twitter:description", content: "Gestion du staff" },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/Hsva0WbyaxZG6VrOhSmBnA7xHDJ2/social-images/social-1778369622840-cropped-sophos-favicon.png.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/Hsva0WbyaxZG6VrOhSmBnA7xHDJ2/social-images/social-1778369622840-cropped-sophos-favicon.png.webp" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
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
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </QueryClientProvider>
  );
}

function AppShell() {
  const currentPath = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { session, appRole, loading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isPublic = PUBLIC_ROUTES.some((p) => currentPath.startsWith(p));
  const isStaffApp = currentPath.startsWith("/staff-app");

  // Redirect logic
  useEffect(() => {
    if (loading) return;
    if (!session && !isPublic) {
      navigate({ to: "/login" });
      return;
    }
    if (session && isPublic && appRole) {
      navigate({ to: appRole === "employee" ? "/staff-app" : "/dashboard" });
      return;
    }
    // Block employees from admin routes
    if (session && appRole === "employee" && !isStaffApp && !isPublic) {
      navigate({ to: "/staff-app" });
    }
  }, [loading, session, appRole, currentPath, isPublic, isStaffApp, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--background)" }}>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Chargement...</p>
      </div>
    );
  }

  if (isPublic) {
    return (
      <>
        <Outlet />
        <Toaster position="top-center" />
      </>
    );
  }

  if (isStaffApp) {
    return (
      <>
        <Outlet />
        <Toaster position="top-center" />
      </>
    );
  }

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: "var(--background)" }}>
      <AppSidebar />
      <MobileSidebar open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      <div className="flex-1 flex flex-col md:ml-[220px]">
        <TopBar onMenuToggle={() => setMobileMenuOpen(prev => !prev)} />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
      <Toaster position="top-right" />
    </div>
  );
}
