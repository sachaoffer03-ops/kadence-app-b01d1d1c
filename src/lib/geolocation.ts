import { isMedianApp } from "./is-median-app";

let medianReadyPromise: Promise<void> | null = null;

function waitForMedianReady(): Promise<void> {
  if (!isMedianApp()) return Promise.resolve();
  if (medianReadyPromise) return medianReadyPromise;

  medianReadyPromise = new Promise<void>((resolve) => {
    // Si le signal a déjà été émis avant qu'on soit prêt à écouter
    if ((window as any).__median_geolocation_ready === true) {
      resolve();
      return;
    }

    // Sinon on expose le callback attendu par Median
    (window as any).median_geolocation_ready = () => {
      (window as any).__median_geolocation_ready = true;
      resolve();
    };

    // Timeout sécurité : après 5s on tente quand même
    setTimeout(() => resolve(), 5000);
  });

  return medianReadyPromise;
}

export type GeoResult =
  | { ok: true; lat: number; lng: number; accuracy: number }
  | { ok: false; reason: "denied" | "unavailable" | "timeout" | "unsupported" };

export async function getCurrentPositionSafe(): Promise<GeoResult> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return { ok: false, reason: "unsupported" };
  }

  await waitForMedianReady();

  return new Promise<GeoResult>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          ok: true,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) resolve({ ok: false, reason: "denied" });
        else if (err.code === err.POSITION_UNAVAILABLE) resolve({ ok: false, reason: "unavailable" });
        else if (err.code === err.TIMEOUT) resolve({ ok: false, reason: "timeout" });
        else resolve({ ok: false, reason: "unavailable" });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  });
}
