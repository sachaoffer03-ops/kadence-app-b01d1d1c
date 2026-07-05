// Retourne l'URL publique de l'app Kadence.
// - Côté serveur (server functions, routes API) : lit process.env.PUBLIC_APP_URL
// - Côté client : lit import.meta.env.VITE_PUBLIC_APP_URL si défini
// - Fallback dur : https://app.kadence.be (jamais de crash)
export function getPublicAppUrl(): string {
  try {
    if (typeof process !== "undefined" && process.env && process.env.PUBLIC_APP_URL) {
      return process.env.PUBLIC_APP_URL;
    }
  } catch {
    // ignore
  }
  try {
    const meta = import.meta as unknown as { env?: Record<string, string | undefined> };
    const v = meta?.env?.VITE_PUBLIC_APP_URL;
    if (v) return v;
  } catch {
    // ignore
  }
  return "https://app.kadence.be";
}
