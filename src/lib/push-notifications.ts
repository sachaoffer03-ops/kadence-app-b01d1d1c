import { isMedianApp, isIOS, isAndroid } from "./is-median-app";

// Identifiant public OneSignal (exposable côté client).
// Renseigné via VITE_ONESIGNAL_APP_ID, sinon null (push désactivé).
export const ONESIGNAL_APP_ID: string | null =
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env
    ?.VITE_ONESIGNAL_APP_ID ?? null;

export interface MedianPushInfo {
  playerId: string | null;
  subscribed: boolean;
  platform: string;
}

function platformLabel(): string {
  if (isIOS()) return "ios";
  if (isAndroid()) return "android";
  return "unknown";
}

/**
 * Récupère l'identifiant d'appareil OneSignal injecté par Median.
 * Deux chemins possibles selon la version du wrapper :
 *  - API promise `median.onesignal.info()`
 *  - callback global `median_onesignal_info(data)`
 */
export function getMedianPushInfo(timeoutMs = 8000): Promise<MedianPushInfo | null> {
  if (typeof window === "undefined" || !isMedianApp()) return Promise.resolve(null);

  const w = window as any;

  return new Promise<MedianPushInfo | null>((resolve) => {
    let settled = false;
    const done = (v: MedianPushInfo | null) => {
      if (settled) return;
      settled = true;
      resolve(v);
    };

    const normalize = (d: any): MedianPushInfo => ({
      playerId: d?.oneSignalUserId ?? d?.playerId ?? d?.subscriptionId ?? null,
      subscribed: Boolean(d?.oneSignalSubscribed ?? d?.subscribed ?? false),
      platform: d?.platform ?? platformLabel(),
    });

    // Callback global (Median l'appelle quand l'info est prête)
    const previous = w.median_onesignal_info;
    w.median_onesignal_info = (data: any) => {
      try {
        previous?.(data);
      } catch {
        // ignore
      }
      done(normalize(data));
    };

    try {
      const info = w.median?.onesignal?.info?.();
      if (info && typeof info.then === "function") {
        info.then((d: any) => done(normalize(d))).catch(() => done(null));
      }
    } catch {
      // ignore : on attend le callback
    }

    setTimeout(() => done(null), timeoutMs);
  });
}

/** Demande la permission notifications (iOS surtout). No-op hors app. */
export function requestPushPermission(): void {
  if (typeof window === "undefined" || !isMedianApp()) return;
  const w = window as any;
  try {
    w.median?.onesignal?.userPrivacyConsent?.grant?.();
    w.median?.onesignal?.register?.();
    w.median?.onesignal?.promptPermission?.();
  } catch {
    // ignore
  }
}

/** Associe l'appareil à l'utilisateur côté OneSignal (utile pour le ciblage). */
export function setPushExternalUserId(userId: string): void {
  if (typeof window === "undefined" || !isMedianApp()) return;
  try {
    (window as any).median?.onesignal?.externalUserId?.set?.({ externalId: userId });
  } catch {
    // ignore
  }
}

/** Coupe la réception des push sur cet appareil (déconnexion). */
export function clearPushExternalUserId(): void {
  if (typeof window === "undefined" || !isMedianApp()) return;
  const w = window as any;
  try {
    w.median?.onesignal?.externalUserId?.remove?.();
  } catch {
    // ignore
  }
}

function handleNotificationTap(payload: any) {
  const url = payload?.additionalData?.url || payload?.url;
  if (url && typeof url === "string") {
    try {
      const target = new URL(url, window.location.origin);
      if (target.origin === window.location.origin) {
        window.history.pushState({}, "", target.pathname + target.search);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }
    } catch {
      // ignore
    }
  }
}

let initialized = false;

/** Écoute les taps sur notification (ouverture de l'écran concerné). */
export function initPushNotifications(): () => void {
  if (typeof window === "undefined" || !isMedianApp()) return () => {};
  if (initialized) return () => {};
  initialized = true;

  const handler = (e: any) => handleNotificationTap(e?.detail || {});
  window.addEventListener("median_notification_opened", handler);

  const w = window as any;
  const previous = w.median_onesignal_opened;
  w.median_onesignal_opened = (data: any) => {
    try {
      previous?.(data);
    } catch {
      // ignore
    }
    handleNotificationTap(data);
  };

  return () => {
    window.removeEventListener("median_notification_opened", handler);
    initialized = false;
  };
}
