// =============================================================================
// AVAILABILITIES — validation côté serveur (deadline, durée min, granularité,
// passé, chevauchement). Utilisée par l'UI employé en complément de la
// validation client. Réplique la même logique pour ne pas faire confiance au
// client.
// =============================================================================
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const AvailInput = z.object({
  avail_date: z.string().regex(DATE_RE),
  start_time: z.string().regex(TIME_RE),
  end_time: z.string().regex(TIME_RE),
});

const UpdateInput = z.object({
  id: z.string().uuid(),
  start_time: z.string().regex(TIME_RE),
  end_time: z.string().regex(TIME_RE),
});

const MIN_DURATION_MIN = 4 * 60;
const STEP_MIN = 15;

function t2m(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function isAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return !!data?.some((r: any) => r.role === "admin");
}

async function getDeadlineDay(supabase: any): Promise<number> {
  const { data } = await supabase
    .from("ai_planning_settings")
    .select("availability_deadline_day")
    .order("updated_at", { ascending: false })
    .limit(1);
  return data?.[0]?.availability_deadline_day ?? 20;
}

/**
 * Verrouillé si :
 *  - un planning publié couvre le mois de la date cible, OU
 *  - la deadline (jour J du mois précédent la cible, à 23:59:59.999) est dépassée.
 */
async function isMonthLocked(supabase: any, targetDate: string): Promise<boolean> {
  const target = new Date(`${targetDate}T00:00:00`);
  const y = target.getFullYear();
  const m = target.getMonth();
  const monthStart = `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const monthEnd = `${y}-${String(m + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const { data } = await supabase
    .from("planning_publications")
    .select("id")
    .lte("period_start", monthEnd)
    .gte("period_end", monthStart)
    .limit(1);
  if ((data?.length ?? 0) > 0) return true;

  // Deadline : jour J du mois précédent la cible, à 23:59:59.999 locale.
  const day = await getDeadlineDay(supabase);
  const deadline = new Date(y, m - 1, day, 23, 59, 59, 999);
  return Date.now() > deadline.getTime();
}


function validateRangeShape(start: string, end: string) {
  const s = t2m(start);
  const e = t2m(end);
  if (s % STEP_MIN !== 0 || e % STEP_MIN !== 0) {
    throw new Error("Les heures doivent être alignées sur 15 minutes");
  }
  if (e <= s) throw new Error("L'heure de fin doit être après le début");
  if (e - s < MIN_DURATION_MIN) {
    throw new Error("Une dispo doit faire au moins 4 heures");
  }
  return { s, e };
}

async function ensureNoOverlap(
  supabase: any,
  userId: string,
  date: string,
  s: number,
  e: number,
  excludeId?: string
) {
  const { data } = await supabase
    .from("availabilities")
    .select("id, start_time, end_time")
    .eq("user_id", userId)
    .eq("avail_date", date);
  for (const r of data ?? []) {
    if (excludeId && r.id === excludeId) continue;
    const rs = t2m(String(r.start_time).slice(0, 5));
    const re = t2m(String(r.end_time).slice(0, 5));
    if (s < re && e > rs) {
      throw new Error("Cette plage chevauche une dispo existante");
    }
  }
}

// =============================================================================
// createAvailability
// =============================================================================
export const createAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => AvailInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const todayStr = todayIso();
    const admin = await isAdmin(supabase, userId);

    if (data.avail_date < todayStr) {
      throw new Error("Impossible de créer une dispo dans le passé");
    }

    if (!admin && await isMonthLocked(supabase, data.avail_date)) {
      throw new Error("Modifications fermées (deadline dépassée ou planning publié). Fais une demande de modification depuis l'accueil.");
    }

    const { s, e } = validateRangeShape(data.start_time, data.end_time);
    await ensureNoOverlap(supabase, userId, data.avail_date, s, e);

    const { data: row, error } = await supabase
      .from("availabilities")
      .insert({
        user_id: userId,
        avail_date: data.avail_date,
        start_time: data.start_time,
        end_time: data.end_time,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

// =============================================================================
// updateAvailability
// =============================================================================
export const updateAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => UpdateInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const todayStr = todayIso();
    const admin = await isAdmin(supabase, userId);

    const { data: existing, error: e0 } = await supabase
      .from("availabilities")
      .select("id, user_id, avail_date")
      .eq("id", data.id)
      .maybeSingle();
    if (e0) throw new Error(e0.message);
    if (!existing) throw new Error("Dispo introuvable");
    if (!admin && existing.user_id !== userId) throw new Error("Non autorisé");

    if (existing.avail_date < todayStr) {
      throw new Error("Impossible de modifier une dispo passée");
    }

    if (!admin && await isMonthLocked(supabase, existing.avail_date)) {
      throw new Error("Modifications fermées (deadline dépassée ou planning publié). Fais une demande de modification.");
    }

    const { s, e } = validateRangeShape(data.start_time, data.end_time);
    await ensureNoOverlap(supabase, existing.user_id, existing.avail_date, s, e, data.id);

    const { error } = await supabase
      .from("availabilities")
      .update({ start_time: data.start_time, end_time: data.end_time })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// =============================================================================
// deleteAvailability
// =============================================================================
export const deleteAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const todayStr = todayIso();
    const admin = await isAdmin(supabase, userId);

    const { data: existing } = await supabase
      .from("availabilities")
      .select("id, user_id, avail_date")
      .eq("id", data.id)
      .maybeSingle();
    if (!existing) throw new Error("Dispo introuvable");
    if (!admin && existing.user_id !== userId) throw new Error("Non autorisé");
    if (existing.avail_date < todayStr) {
      throw new Error("Impossible de supprimer une dispo passée");
    }
    if (!admin && await isMonthLocked(supabase, existing.avail_date)) {
      throw new Error("Modifications fermées (deadline dépassée ou planning publié). Fais une demande de modification.");
    }

    const { error } = await supabase.from("availabilities").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// =============================================================================
// getAvailabilityDeadline : indicatif + état de publication du mois cible
// =============================================================================
export const getAvailabilityDeadline = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const day = await getDeadlineDay(supabase);
    const today = new Date();
    const target = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const deadline = new Date(today.getFullYear(), today.getMonth(), day, 23, 59, 59, 999);
    const msLeft = deadline.getTime() - today.getTime();
    const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
    const targetMonthFirst = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}-01`;
    const published = await isMonthLocked(supabase, targetMonthFirst);
    return {
      deadline_day: day,
      deadline_iso: deadline.toISOString(),
      target_year: target.getFullYear(),
      target_month: target.getMonth(), // 0-indexed
      days_left: daysLeft,
      passed: msLeft < 0,
      planning_published: published,
    };
  });
