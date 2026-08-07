// Envoi de notifications push via OneSignal (canal natif Median).
// Server-only : lit ONESIGNAL_APP_ID / ONESIGNAL_REST_API_KEY.

export interface PushTarget {
  playerIds: string[];
  title: string;
  body: string;
  url?: string | null;
  data?: Record<string, unknown>;
}

export async function sendOneSignalPush(target: PushTarget): Promise<
  { ok: true; id: string | null } | { ok: false; error: string }
> {
  const appId = process.env["ONESIGNAL_APP_ID"];
  const apiKey = process.env["ONESIGNAL_REST_API_KEY"];

  if (!appId || !apiKey) return { ok: false, error: "OneSignal non configuré" };
  if (target.playerIds.length === 0) return { ok: false, error: "Aucun appareil" };

  try {
    const res = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Key ${apiKey}`,
      },
      body: JSON.stringify({
        app_id: appId,
        include_player_ids: target.playerIds.slice(0, 2000),
        headings: { en: target.title, fr: target.title },
        contents: { en: target.body, fr: target.body },
        data: { url: target.url ?? "/staff-app", ...(target.data ?? {}) },
        ...(target.url ? { url: undefined } : {}),
        ios_badge_type: "Increase",
        ios_badge_count: 1,
      }),
    });

    const json = (await res.json().catch(() => ({}))) as any;
    if (!res.ok) {
      return { ok: false, error: json?.errors?.[0] ?? `HTTP ${res.status}` };
    }
    return { ok: true, id: json?.id ?? null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur inconnue" };
  }
}
