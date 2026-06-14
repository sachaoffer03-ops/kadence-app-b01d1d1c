/**
 * Source unique de vérité pour le plafond hebdomadaire d'un employé.
 * Utilisable côté serveur (server functions) ET côté client (composants).
 *
 * Le toggle "allow_extended_hours" sur le profil élargit UNIQUEMENT le
 * plafond hebdo en heures — il ne contourne PAS :
 *   - le quota annuel 650h jobiste
 *   - le repos minimum légal 11h entre 2 shifts
 *   - le repos hebdomadaire 35h consécutives
 *   - les contraintes ONSS / contractuelles
 *   - les indisponibilités saisies par l'employé
 */

export type WeeklyCapSettings = {
  max_weekly_cdi_hours?: number | null;
  max_weekly_student_hours?: number | null;
  max_weekly_flexi_hours?: number | null;
};

export interface ProfileForCap {
  allow_extended_hours?: boolean | null;
  weekly_hours_cap?: number | null;
}

const DEFAULTS = { cdi: 48, student: 15, flexi: 20, fallback: 40 } as const;

function has(contracts: readonly string[] | Set<string>, c: string): boolean {
  return contracts instanceof Set ? contracts.has(c) : contracts.includes(c);
}

/** Plafond hebdo standard issu du contrat (sans override). */
export function standardCapForContracts(
  contracts: readonly string[] | Set<string>,
  settings?: WeeklyCapSettings,
): number {
  if (has(contracts, "CDI")) return Number(settings?.max_weekly_cdi_hours ?? DEFAULTS.cdi);
  if (has(contracts, "Flexi")) return Number(settings?.max_weekly_flexi_hours ?? DEFAULTS.flexi);
  if (has(contracts, "Étudiant")) return Number(settings?.max_weekly_student_hours ?? DEFAULTS.student);
  return DEFAULTS.fallback;
}

/**
 * Plafond hebdomadaire effectif pour un employé.
 * Si allow_extended_hours = true, utilise weekly_hours_cap (ou 48 par défaut, jamais > 48).
 * Sinon retourne le plafond standard du contrat.
 */
export function getWeeklyCapForUser(
  profile: ProfileForCap | null | undefined,
  contracts: readonly string[] | Set<string>,
  settings?: WeeklyCapSettings,
): { cap: number; standardCap: number; isExtended: boolean } {
  const standardCap = standardCapForContracts(contracts, settings);
  if (profile?.allow_extended_hours) {
    const override = profile.weekly_hours_cap;
    const cap = typeof override === "number" && override > 0 ? Math.min(48, override) : 48;
    return { cap, standardCap, isExtended: true };
  }
  return { cap: standardCap, standardCap, isExtended: false };
}
