// Détection du contexte d'exécution (wrapper Median.co vs navigateur web).
// Toujours `false` côté serveur et sur navigateur classique → zéro impact web.

export function isMedianApp(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes("median") || ua.includes("gonative");
}

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function isAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/.test(navigator.userAgent);
}
