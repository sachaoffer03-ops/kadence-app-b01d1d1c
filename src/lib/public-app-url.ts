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
    // @ts-expect-error import.meta.env only exists in Vite context
    const v = import.meta?.env?.VITE_PUBLIC_APP_URL as string | undefined;
    if (v) return v;
  } catch {
    // ignore
  }
  return "https://app.kadence.be";
}
