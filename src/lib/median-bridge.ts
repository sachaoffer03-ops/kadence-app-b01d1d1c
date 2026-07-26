import { isMedianApp } from "./is-median-app";

/**
 * Bouton retour physique Android dans le wrapper Median.
 * Median émet un event `median_back` ; si on a un historique, on revient
 * en arrière, sinon on laisse Median fermer l'app naturellement.
 * No-op complet hors app (navigateur web).
 */
export function registerMedianBackButton(navigate: (delta: number) => void): () => void {
  if (typeof window === "undefined" || !isMedianApp()) return () => {};

  const handler = (e: Event) => {
    if (window.history.length > 1) {
      (e as any).preventDefault?.();
      navigate(-1);
    }
  };

  window.addEventListener("median_back", handler);
  return () => window.removeEventListener("median_back", handler);
}
