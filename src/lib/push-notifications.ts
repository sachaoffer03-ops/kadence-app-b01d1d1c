import { isMedianApp } from "./is-median-app";

// À remplir quand OneSignal sera branché côté Median.
export const ONESIGNAL_APP_ID: string | null = null;

let initialized = false;

function handleNotificationTap(payload: any) {
  // payload attendu : { url?: string, notificationId?: string }
  const url = payload?.additionalData?.url || payload?.url;
  if (url && typeof url === "string") {
    try {
      const target = new URL(url, window.location.origin);
      if (target.origin === window.location.origin) {
        // Navigation interne React, sans reload
        window.history.pushState({}, "", target.pathname + target.search);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }
    } catch {
      // ignore
    }
  }
}

export function initPushNotifications(): () => void {
  if (typeof window === "undefined" || !isMedianApp()) return () => {};
  if (initialized) return () => {};
  initialized = true;

  // Median injecte OneSignal nativement si activé côté config Median.
  // Côté web on se contente d'écouter l'event custom.
  const handler = (e: any) => handleNotificationTap(e?.detail || {});
  window.addEventListener("median_notification_opened", handler);

  return () => {
    window.removeEventListener("median_notification_opened", handler);
    initialized = false;
  };
}
