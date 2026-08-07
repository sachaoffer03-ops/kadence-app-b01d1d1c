import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";

import { isMedianApp } from "@/lib/is-median-app";
import {
  getMedianPushInfo,
  requestPushPermission,
  setPushExternalUserId,
} from "@/lib/push-notifications";
import { registerPushDevice } from "@/lib/push.functions";

const STORAGE_KEY = "kadence-push-player-id";

/**
 * Enregistre l'appareil mobile (Median) auprès de Kadence pour recevoir
 * les notifications push. No-op complet sur navigateur web.
 */
export function usePushRegistration(userId: string | null | undefined) {
  const register = useServerFn(registerPushDevice);
  const doneFor = useRef<string | null>(null);

  useEffect(() => {
    if (!userId || !isMedianApp()) return;
    if (doneFor.current === userId) return;
    doneFor.current = userId;

    let cancelled = false;

    (async () => {
      requestPushPermission();
      const info = await getMedianPushInfo();
      if (cancelled || !info?.playerId) return;

      setPushExternalUserId(userId);

      try {
        await register({
          data: { playerId: info.playerId, platform: info.platform || "unknown" },
        });
        try {
          window.localStorage.setItem(STORAGE_KEY, info.playerId);
        } catch {
          // ignore
        }
      } catch {
        doneFor.current = null; // on retentera au prochain montage
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, register]);
}

export function getStoredPlayerId(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
