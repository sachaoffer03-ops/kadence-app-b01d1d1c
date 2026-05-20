// Server-only helpers around scoring_settings.
// Loads the (singleton) scoring rules with a 60s in-memory cache.

import type { ScoringRules } from "./scoring-shared";
import { DEFAULT_RULES } from "./scoring-shared";

type AnySupabase = any;

interface CachedRules {
  rules: ScoringRules & {
    id: string;
    profile_name: string;
    punctuality_tolerance: string;
    checklist_strictness: string;
    photos_importance: string;
    expert_mode_unlocked: boolean;
  };
  loadedAt: number;
}

let cache: CachedRules | null = null;
const TTL_MS = 60_000;

export async function loadScoringSettings(supabase: AnySupabase) {
  if (cache && Date.now() - cache.loadedAt < TTL_MS) return cache.rules;
  const { data } = await supabase.from("scoring_settings").select("*").limit(1).maybeSingle();
  const rules = {
    id: data?.id ?? "",
    profile_name: data?.profile_name ?? "equilibre",
    punctuality_tolerance: data?.punctuality_tolerance ?? "moyenne",
    checklist_strictness: data?.checklist_strictness ?? "moyenne",
    photos_importance: data?.photos_importance ?? "important",
    expert_mode_unlocked: data?.expert_mode_unlocked ?? false,
    weight_punctuality: data?.weight_punctuality ?? DEFAULT_RULES.weight_punctuality,
    weight_checklist: data?.weight_checklist ?? DEFAULT_RULES.weight_checklist,
    weight_photos: data?.weight_photos ?? DEFAULT_RULES.weight_photos,
    punct_0min: data?.punct_0min ?? DEFAULT_RULES.punct_0min,
    punct_5min: data?.punct_5min ?? DEFAULT_RULES.punct_5min,
    punct_15min: data?.punct_15min ?? DEFAULT_RULES.punct_15min,
    punct_30min: data?.punct_30min ?? DEFAULT_RULES.punct_30min,
    punct_over: data?.punct_over ?? DEFAULT_RULES.punct_over,
    punct_noshow: data?.punct_noshow ?? DEFAULT_RULES.punct_noshow,
    checklist_complete: data?.checklist_complete ?? DEFAULT_RULES.checklist_complete,
    checklist_bonus_per_photo_item: Number(data?.checklist_bonus_per_photo_item ?? DEFAULT_RULES.checklist_bonus_per_photo_item),
    checklist_penalty_per_missed: data?.checklist_penalty_per_missed ?? DEFAULT_RULES.checklist_penalty_per_missed,
    photos_all_validated: data?.photos_all_validated ?? DEFAULT_RULES.photos_all_validated,
    photos_penalty_per_refused: data?.photos_penalty_per_refused ?? DEFAULT_RULES.photos_penalty_per_refused,
  };
  cache = { rules, loadedAt: Date.now() };
  return rules;
}

export function invalidateScoringCache() {
  cache = null;
}
