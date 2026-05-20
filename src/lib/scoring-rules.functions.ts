import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const ok = data?.some((r: any) => r.role === "admin");
  if (!ok) throw new Error("Réservé aux admins");
}

export const getScoringSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("scoring_settings").select("*").limit(1).maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export const setScoringProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    profile: z.enum(["bienveillant", "equilibre", "exigeant"]),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { PROFILES } = await import("./scoring-shared");
    const { invalidateScoringCache } = await import("./scoring-rules.server");
    const p = PROFILES[data.profile];
    const payload: any = { ...p, profile_name: data.profile, updated_at: new Date().toISOString(), updated_by: userId };
    const { data: row } = await supabase.from("scoring_settings").select("id").limit(1).maybeSingle();
    if (!row) throw new Error("Configuration introuvable");
    const { error } = await supabase.from("scoring_settings").update(payload).eq("id", row.id);
    if (error) throw new Error(error.message);
    invalidateScoringCache();
    return { ok: true };
  });

const FIELD_SCHEMA = z.object({
  field: z.string(),
  value: z.union([z.string(), z.number(), z.boolean()]),
});

export const updateScoringRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => FIELD_SCHEMA.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { PUNCT_PRESETS, CHECKLIST_PRESETS, PHOTOS_PRESETS } = await import("./scoring-shared");
    const { invalidateScoringCache } = await import("./scoring-rules.server");

    const { data: row } = await supabase.from("scoring_settings").select("*").limit(1).maybeSingle();
    if (!row) throw new Error("Configuration introuvable");

    const update: any = { profile_name: "personnalise", updated_at: new Date().toISOString(), updated_by: userId };

    if (data.field === "punctuality_tolerance" && typeof data.value === "string") {
      update.punctuality_tolerance = data.value;
      Object.assign(update, PUNCT_PRESETS[data.value as keyof typeof PUNCT_PRESETS] ?? {});
    } else if (data.field === "checklist_strictness" && typeof data.value === "string") {
      update.checklist_strictness = data.value;
      Object.assign(update, CHECKLIST_PRESETS[data.value as keyof typeof CHECKLIST_PRESETS] ?? {});
    } else if (data.field === "photos_importance" && typeof data.value === "string") {
      update.photos_importance = data.value;
      Object.assign(update, PHOTOS_PRESETS[data.value as keyof typeof PHOTOS_PRESETS] ?? {});
    } else if (data.field.startsWith("weight_")) {
      // expect caller to send the full triplet via updateScoringWeights instead
      throw new Error("Utiliser updateScoringWeights pour modifier les pondérations.");
    } else if (data.field === "expert_mode_unlocked" && typeof data.value === "boolean") {
      update.expert_mode_unlocked = data.value;
      delete update.profile_name; // toggle alone ne change pas le profil
      delete update.updated_at;
    } else {
      // expert mode: raw bareme field
      const allowed = new Set([
        "punct_0min","punct_5min","punct_15min","punct_30min","punct_over","punct_noshow",
        "checklist_complete","checklist_bonus_per_photo_item","checklist_penalty_per_missed",
        "photos_all_validated","photos_penalty_per_refused",
      ]);
      if (!allowed.has(data.field)) throw new Error(`Champ inconnu: ${data.field}`);
      update[data.field] = data.value;
    }

    const { error } = await supabase.from("scoring_settings").update(update).eq("id", row.id);
    if (error) throw new Error(error.message);
    invalidateScoringCache();
    return { ok: true };
  });

export const updateScoringWeights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    weight_punctuality: z.number().int().min(0).max(100),
    weight_checklist: z.number().int().min(0).max(100),
    weight_photos: z.number().int().min(0).max(100),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { invalidateScoringCache } = await import("./scoring-rules.server");
    const sum = data.weight_punctuality + data.weight_checklist + data.weight_photos;
    if (sum !== 100) throw new Error("La somme des pondérations doit faire 100%.");
    const { data: row } = await supabase.from("scoring_settings").select("id").limit(1).maybeSingle();
    if (!row) throw new Error("Configuration introuvable");
    const { error } = await supabase.from("scoring_settings").update({
      ...data,
      profile_name: "personnalise",
      updated_at: new Date().toISOString(),
      updated_by: userId,
    }).eq("id", row.id);
    if (error) throw new Error(error.message);
    invalidateScoringCache();
    return { ok: true };
  });

export const simulateScoring = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { loadScoringSettings } = await import("./scoring-rules.server");
    const rules = await loadScoringSettings(supabase);

    // Team average over last 30 days based on profiles.score
    const { data: profiles } = await supabase
      .from("profiles").select("id,first_name,last_name,score")
      .not("score", "is", null);
    const scores = (profiles ?? []).map((p: any) => Number(p.score)).filter((n: number) => !Number.isNaN(n));
    const teamAvg = scores.length > 0 ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : null;
    const below5 = (profiles ?? []).filter((p: any) => Number(p.score) < 5).map((p: any) => `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim());

    return {
      rules,
      teamAvg: teamAvg !== null ? Math.round(teamAvg * 10) / 10 : null,
      teamCount: scores.length,
      below5,
    };
  });

export const recalcAllScoresWithNewRules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data, error } = await supabase.rpc("recalculate_all_scores");
    if (error) throw new Error(error.message);
    return { ok: true, count: data ?? 0 };
  });
