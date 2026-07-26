// Helpers de construction de payloads notification push (OneSignal).
// Utilisés côté serveur quand OneSignal sera branché.

export interface PushPayload {
  headings: { fr: string };
  contents: { fr: string };
  additionalData: Record<string, unknown> & { url: string; type: string };
}

export function buildShiftNotification(shift: {
  id: string;
  date: string;
  startTime: string;
  role: string;
}): PushPayload {
  return {
    headings: { fr: "Nouveau shift" },
    contents: { fr: `${shift.role} — ${shift.date} à ${shift.startTime}` },
    additionalData: {
      url: `/shifts/${shift.id}`,
      type: "new_shift",
      shiftId: shift.id,
    },
  };
}

export function buildPlanningPublishedNotification(period: { label: string }): PushPayload {
  return {
    headings: { fr: "Planning publié" },
    contents: { fr: `Ton planning ${period.label} est disponible.` },
    additionalData: {
      url: "/planning",
      type: "planning_published",
    },
  };
}

export function buildRequestResponseNotification(request: {
  id: string;
  accepted: boolean;
}): PushPayload {
  return {
    headings: { fr: request.accepted ? "Demande acceptée" : "Demande refusée" },
    contents: {
      fr: request.accepted
        ? "Ta demande a été acceptée."
        : "Ta demande a été refusée.",
    },
    additionalData: {
      url: `/demandes/${request.id}`,
      type: "request_response",
      requestId: request.id,
    },
  };
}

export function buildSignalementResponseNotification(signalement: {
  id: string;
  message?: string;
}): PushPayload {
  return {
    headings: { fr: "Réponse à ton signalement" },
    contents: { fr: signalement.message ?? "Ton signalement a reçu une réponse." },
    additionalData: {
      url: `/signalements/${signalement.id}`,
      type: "signalement_response",
      signalementId: signalement.id,
    },
  };
}

export function buildDisposReminderNotification(period: { label: string }): PushPayload {
  return {
    headings: { fr: "Disponibilités à remplir" },
    contents: { fr: `N'oublie pas d'indiquer tes disponibilités pour ${period.label}.` },
    additionalData: {
      url: "/disponibilites",
      type: "reminder_dispos",
    },
  };
}
