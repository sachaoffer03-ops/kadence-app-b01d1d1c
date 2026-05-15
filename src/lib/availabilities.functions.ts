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
 * Vérifie que la date n'est pas dans un mois "verrouillé" par la deadline.
 * Pour le mois M, deadline = jour D du mois M-1. Si on est après cette date,
 * impossible de toucher aux dispos du mois M.
 */
function isMonthLocked(targetDate: string, deadlineDay: number, today: Date): boolean {
  const target = new Date(`${targetDate}T00:00:00`);
  const targetMonthStart = new Date(target.getFullYear(), target.getMonth(), 1);
  const deadline = new Date(targetMonthStart);
  deadline.setMonth(deadline.getMonth() - 1);
  deadline.setDate(deadlineDay);
  deadline.setHours(23, 59, 59, 999);
  return today > deadline;
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
    const today = new Date();
    const todayStr = todayIso();
    const admin = await isAdmin(supabase, userId);

    if (data.avail_date < todayStr) {
      throw new Error("Impossible de créer une dispo dans le passé");
    }

    if (!admin) {
      const deadline = await getDeadlineDay(supabase);
      if (isMonthLocked(data.avail_date, deadline, today)) {
        throw new Error(
          `Deadline dépassée : les dispos pour ce mois devaient être saisies avant le ${deadline} du mois précédent`
        );
      }
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
    const today = new Date();
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

    if (!admin) {
      const deadline = await getDeadlineDay(supabase);
      if (isMonthLocked(existing.avail_date, deadline, today)) {
        throw new Error(`Deadline dépassée pour ce mois`);
      }
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
    const today = new Date();
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
    if (!admin) {
      const deadline = await getDeadlineDay(supabase);
      if (isMonthLocked(existing.avail_date, deadline, today)) {
        throw new Error("Deadline dépassée pour ce mois");
      }
    }

    const { error } = await supabase.from("availabilities").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// =============================================================================
// getAvailabilityDeadline : utilisé par l'UI pour le countdown
// =============================================================================
export const getAvailabilityDeadline = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const day = await getDeadlineDay(supabase);
    // Mois cible courant pour la saisie = mois suivant le mois actuel
    const today = new Date();
    const target = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const deadline = new Date(today.getFullYear(), today.getMonth(), day, 23, 59, 59, 999);
    const msLeft = deadline.getTime() - today.getTime();
    const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
    return {
      deadline_day: day,
      deadline_iso: deadline.toISOString(),
      target_year: target.getFullYear(),
      target_month: target.getMonth(), // 0-indexed
      days_left: daysLeft,
      passed: msLeft < 0,
    };
  });
