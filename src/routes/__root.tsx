import { useState, useEffect } from "react";
import "@/lib/browser-storage-guard";
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
import { getAppMode } from "@/lib/app-mode";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

  const forceReload = () => {
    if (typeof window === "undefined") {
      router.invalidate();
      reset();
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set("r", String(Date.now()));
    window.location.replace(url.toString());
  };

  // Auto-recovery : erreur d'import de chunk périmé (post-déploiement).
  // On recharge une seule fois, en bypassant le cache.
  useEffect(() => {
    const msg = String(error?.message || "");
    const isChunkError =
      /Importing a module script failed/i.test(msg) ||
      /Failed to fetch dynamically imported module/i.test(msg) ||
      /Loading chunk \d+ failed/i.test(msg) ||
      /error loading dynamically imported module/i.test(msg);
    if (!isChunkError || typeof window === "undefined") return;
    const KEY = "kadence_chunk_reload_at";
    try {
      const last = Number(window.sessionStorage?.getItem(KEY) || 0);
      if (Date.now() - last < 10_000) return; // évite la boucle
      window.sessionStorage?.setItem(KEY, String(Date.now()));
    } catch {
      // sessionStorage inaccessible (mode privé, storage bloqué) — on recharge quand même
    }
    forceReload();
  }, [error]);

  // Home selon le mode (employé → /staff-app, admin → /dashboard)
  const homeHref =
    typeof window !== "undefined" && getAppMode() === "employee" ? "/staff-app" : "/dashboard";

  return (
    <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "var(--background)" }}>
      <div className="max-w-md text-center">
        <h1 style={{ fontSize: 18, fontWeight: 500 }}>Erreur de chargement</h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 8 }}>
          Quelque chose s'est mal passé. Essayez de recharger.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={forceReload}
            className="inline-flex items-center justify-center rounded-md px-4 py-2"
            style={{ fontSize: 13, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}
          >
            Réessayer
          </button>
          <a
            href={homeHref}
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
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/ee6269ed-b70d-492d-b645-034740b5038b" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/ee6269ed-b70d-492d-b645-034740b5038b" },
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
  const { session, appRole, managerPermissions, loading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage?.getItem("kadence_sidebar_collapsed") === "1";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      window.localStorage?.setItem("kadence_sidebar_collapsed", sidebarCollapsed ? "1" : "0");
    } catch {
      // ignore
    }
  }, [sidebarCollapsed]);

  const isPublic = currentPath === "/" || PUBLIC_ROUTES.some((p) => currentPath.startsWith(p));
  const isStaffApp = currentPath.startsWith("/staff-app") || currentPath.startsWith("/staff/checklist");
  const isDisplay = currentPath.startsWith("/display");

  if (isDisplay) {
    return <Outlet />;
  }
  // Allow admins to view the activation page in preview mode (?preview=...)
  const isActivationPreview =
    currentPath.startsWith("/activation") &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("preview");

  // Redirect logic
  useEffect(() => {
    if (loading) return;
    const appMode = getAppMode();
    const host = typeof window !== "undefined" ? window.location.hostname.toLowerCase() : "";
    // En preview Lovable / dev, on autorise l'admin à voir l'espace employé
    // (sinon impossible de prévisualiser /staff-app depuis le compte admin).
    const isPreviewHost =
      host.endsWith(".lovableproject.com") ||
      host.endsWith(".lovable.app") ||
      host === "localhost" ||
      host === "127.0.0.1";

    if (!session && !isPublic) {
      navigate({ to: "/login" });
      return;
    }

    // Si connecté, vérifier la cohérence rôle/espace
    if (session && appRole) {
      const userIsEmployee = appRole === "employee";
      const isEmployeeSpace = appMode === "employee";

      // Mauvais espace pour ce rôle → déconnexion + message
      // (skip sur preview pour permettre aux admins de tester l'espace employé)
      if (!isPreviewHost && isEmployeeSpace && !userIsEmployee) {
        toast.error("Ce compte est administrateur. Utilisez un compte employé pour app.kadence.be");
        if (isStaffApp) {
          navigate({ to: "/dashboard" });
          return;
        }
        supabase.auth.signOut();
        return;
      }
      if (!isEmployeeSpace && userIsEmployee) {
        toast.error("Ce compte est employé. Redirection vers l'espace employé…");
        supabase.auth.signOut();
        if (typeof window !== "undefined") window.location.replace("https://app.kadence.be/login");
        return;
      }

      if (isPublic && !isActivationPreview) {
        navigate({ to: userIsEmployee ? "/staff-app" : "/dashboard" });
        return;
      }

      // Employé sur une route admin → renvoie vers staff-app
      if (userIsEmployee && !isStaffApp && !isPublic) {
        navigate({ to: "/staff-app" });
        return;
      }
      // Admin sur staff-app → renvoie vers dashboard
      // (skip sur preview pour permettre la prévisualisation)
      if (!isPreviewHost && !userIsEmployee && isStaffApp) {
        navigate({ to: "/dashboard" });
        return;
      }

      // Manager : route admin non autorisée par ses permissions → redirige vers la 1re autorisée
      if (appRole === "manager" && !isStaffApp && !isPublic && managerPermissions) {
        const allowedPrefixes = managerPermissions;
        const alwaysOk = ["/staff/", "/profile"];
        const isAllowed =
          allowedPrefixes.some((k) => currentPath === k || currentPath.startsWith(k + "/")) ||
          alwaysOk.some((p) => currentPath.startsWith(p));
        if (!isAllowed) {
          if (allowedPrefixes.length > 0) {
            navigate({ to: allowedPrefixes[0] as any });
          } else {
            // Pas de permissions configurées : ne pas déconnecter (sinon
            // boucle login/logout). On envoie vers le profil et on prévient.
            toast.error("Aucun accès configuré. Contacte un administrateur.");
            if (currentPath !== "/profile") navigate({ to: "/profile" as any });
          }
        }
      }
    }
  }, [loading, session, appRole, managerPermissions, currentPath, isPublic, isStaffApp, isActivationPreview, navigate]);


  if (loading && !isPublic) {
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
      <AppSidebar collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed((v) => !v)} />
      <MobileSidebar open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      <div
        className="flex-1 min-w-0 flex flex-col overflow-x-hidden transition-[margin-left] duration-200 ease-out md:ml-[var(--sidebar-w)]"
        style={{ ["--sidebar-w" as any]: sidebarCollapsed ? "64px" : "220px" }}
      >
        <TopBar onMenuToggle={() => setMobileMenuOpen(prev => !prev)} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden min-w-0">
          <Outlet />
        </main>
      </div>
      <Toaster position="top-right" />
    </div>
  );
}
