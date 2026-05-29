import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next, request }) => {
  const url = new URL(request.url);
  if (url.pathname.startsWith("/lovable/")) {
    return next();
  }
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    // N'afficher la page HTML d'erreur que pour les vraies navigations document.
    // Pour les appels server-fn / fetch, on relance pour préserver le format
    // d'erreur attendu côté client (sinon le client reçoit du HTML et le
    // composant peut remount, perdant l'état local — ex: l'onglet du chat).
    const accept = request.headers.get("accept") || "";
    const secFetchDest = request.headers.get("sec-fetch-dest") || "";
    const secFetchMode = request.headers.get("sec-fetch-mode") || "";
    const isDocumentNavigation =
      secFetchDest === "document" ||
      secFetchMode === "navigate" ||
      (secFetchDest === "" && secFetchMode === "" && accept.includes("text/html"));
    if (!isDocumentNavigation) {
      throw error;
    }
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware],
  functionMiddleware: [attachSupabaseAuth],
}));
