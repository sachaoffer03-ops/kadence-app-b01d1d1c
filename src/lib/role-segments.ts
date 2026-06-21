// Source unique de vérité pour manipuler les segments de rôles d'un shift hybride.
// À utiliser dans le moteur, l'UI, le pointage, les rapports — partout.

export type RoleSegment = {
  role: string;
  start_time: string; // "HH:MM" — granularité 15 min
  end_time: string;
};

export type RoleSegmentsValidation = {
  ok: boolean;
  errors: string[];
};

const QH_REGEX = /^([01]\d|2[0-3]):(00|15|30|45)$/;

/** Valide la structure ET la couverture des segments vs shift_start/end. */
export function validateRoleSegments(
  segments: RoleSegment[] | null | undefined,
  shiftStart: string,
  shiftEnd: string,
  knownRoles?: string[],
): RoleSegmentsValidation {
  const errs: string[] = [];

  if (segments === null || segments === undefined) {
    return { ok: true, errors: [] };
  }
  if (!Array.isArray(segments)) {
    return { ok: false, errors: ["role_segments doit être un tableau"] };
  }
  if (segments.length < 2) {
    return { ok: false, errors: ["Au moins 2 segments requis pour un shift hybride"] };
  }

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const tag = `Segment ${i + 1}`;

    if (!seg?.role) errs.push(`${tag} : rôle manquant`);
    if (!seg?.start_time || !QH_REGEX.test(seg.start_time))
      errs.push(`${tag} : start_time invalide (attendu HH:00, HH:15, HH:30 ou HH:45)`);
    if (!seg?.end_time || !QH_REGEX.test(seg.end_time))
      errs.push(`${tag} : end_time invalide`);
    if (seg?.start_time && seg?.end_time && seg.start_time >= seg.end_time)
      errs.push(`${tag} : start_time doit être avant end_time`);
    if (knownRoles && seg?.role && !knownRoles.includes(seg.role))
      errs.push(`${tag} : rôle inconnu "${seg.role}"`);
    if (i > 0 && seg.start_time !== segments[i - 1].end_time)
      errs.push(`${tag} : trou ou chevauchement avec le segment précédent`);
  }

  if (segments[0]?.start_time !== shiftStart)
    errs.push(`Le premier segment doit commencer à ${shiftStart}`);
  if (segments[segments.length - 1]?.end_time !== shiftEnd)
    errs.push(`Le dernier segment doit finir à ${shiftEnd}`);

  return { ok: errs.length === 0, errors: errs };
}

/** Retourne la liste des rôles uniques requis pour ce shift. */
export function getRequiredRoles(
  segments: RoleSegment[] | null | undefined,
  fallbackRole: string,
): string[] {
  if (!segments || segments.length === 0) return [fallbackRole];
  return Array.from(new Set(segments.map((s) => s.role)));
}

/** Retourne le rôle actif à une heure donnée (HH:MM). */
export function getActiveRoleAt(
  segments: RoleSegment[] | null | undefined,
  fallbackRole: string,
  timeHHMM: string,
): string {
  if (!segments || segments.length === 0) return fallbackRole;
  const found = segments.find(
    (s) => timeHHMM >= s.start_time && timeHHMM < s.end_time,
  );
  return found?.role ?? fallbackRole;
}

/** Calcule les heures par rôle pour un shift (utile pour rapports). */
export function getHoursPerRole(
  segments: RoleSegment[] | null | undefined,
  fallbackRole: string,
  shiftStart: string,
  shiftEnd: string,
): Record<string, number> {
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + (m || 0);
  };
  if (!segments || segments.length === 0) {
    return { [fallbackRole]: (toMin(shiftEnd) - toMin(shiftStart)) / 60 };
  }
  const acc: Record<string, number> = {};
  for (const s of segments) {
    const h = (toMin(s.end_time) - toMin(s.start_time)) / 60;
    acc[s.role] = (acc[s.role] ?? 0) + h;
  }
  return acc;
}

/** True si le shift est hybride (au moins 2 rôles différents). */
export function isHybridShift(segments: RoleSegment[] | null | undefined): boolean {
  if (!segments || segments.length < 2) return false;
  return new Set(segments.map((s) => s.role)).size >= 2;
}
