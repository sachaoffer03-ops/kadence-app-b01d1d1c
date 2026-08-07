export const PUSH_CATEGORIES = [
  "planning",
  "shift",
  "request",
  "pointage",
  "training",
  "document",
  "general",
] as const;

export type PushCategory = (typeof PUSH_CATEGORIES)[number];

export const PUSH_CATEGORY_LABELS: Record<PushCategory, string> = {
  planning: "Planning publié",
  shift: "Shifts (proposés, attribués, trous à combler)",
  request: "Réponses à mes demandes",
  pointage: "Rappels de pointage",
  training: "Formations",
  document: "Documents",
  general: "Informations générales",
};
