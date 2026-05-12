// Détecte si on est sur le sous-domaine admin ou employé.
// Fallback en preview/dev: ?mode=admin ou ?mode=employee dans l'URL,
// sinon on tombe sur "admin" par défaut côté preview Lovable.

export type AppMode = "admin" | "employee";

const ADMIN_HOST = "admin.shyft.flashsite.fr";
const EMPLOYEE_HOST = "app.shyft.flashsite.fr";

export function getAppMode(): AppMode {
  if (typeof window === "undefined") return "admin";
  const host = window.location.hostname.toLowerCase();

  if (host === ADMIN_HOST || host.startsWith("admin.")) return "admin";
  if (host === EMPLOYEE_HOST || host.startsWith("app.")) return "employee";

  // Preview / dev fallback
  try {
    const params = new URLSearchParams(window.location.search);
    const m = params.get("mode");
    if (m === "employee" || m === "app") return "employee";
    if (m === "admin") return "admin";
    // Persist le choix entre navigations preview
    const stored = window.localStorage.getItem("kadence_preview_mode");
    if (stored === "employee" || stored === "admin") return stored;
  } catch {
    // ignore
  }
  return "admin";
}

export function setPreviewMode(mode: AppMode) {
  try {
    window.localStorage.setItem("kadence_preview_mode", mode);
  } catch {
    // ignore
  }
}

export function getOtherSpaceUrl(currentMode: AppMode): string {
  const target = currentMode === "admin" ? EMPLOYEE_HOST : ADMIN_HOST;
  return `https://${target}`;
}

export function getSpaceUrl(mode: AppMode): string {
  return `https://${mode === "admin" ? ADMIN_HOST : EMPLOYEE_HOST}`;
}

export const ADMIN_DOMAIN = ADMIN_HOST;
export const EMPLOYEE_DOMAIN = EMPLOYEE_HOST;
