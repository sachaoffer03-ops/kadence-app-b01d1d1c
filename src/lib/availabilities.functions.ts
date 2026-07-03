// =============================================================================
// AVAILABILITIES — validation côté serveur (deadline, durée min, granularité,
// passé, chevauchement). Utilisée par l'UI employé en complément de la
// validation client. Réplique la même logique pour ne pas faire confiance au
// client.
// =============================================================================
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  addMonthsYM,
  brusselsDeadlineDate,
  formatBrusselsDeadlineLabel,
  formatBrusselsMonthLabel,
  getBrusselsDateParts,
  monthEndISO,
  monthStartISO,
  todayBrusselsISO,
} from "@/lib/brussels-time";

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

const DEFAULT_MIN_DURATION_MIN = 4 * 60;
const STEP_MIN = 15;

async function getMinDurationMin(supabase: any): Promise<number> {
  const { data } = await supabase
    .from("ai_planning_settings")
    .select("min_shift_hours")
    .order("updated_at", { ascending: false })
    .limit(1);
  const v = Number(data?.[0]?.min_shift_hours);
  if (Number.isFinite(v) && v > 0) return Math.round(v * 60);
  return DEFAULT_MIN_DURATION_MIN;
}

function fmtHours(min: number) {
  const h = min / 60;
  return Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`;
}

function t2m(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function todayIso() {
  return todayBrusselsISO();
}

async function isAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return !!data?.some((r: any) => r.role === "admin");
}

async function getDeadlineDay(supabase: any): Promise<number> {
  const { data } = await supabase
    .from("ai_planning_settings")
    .select("availability_lock_day")
    .order("updated_at", { ascending: false })
    .limit(1);
  return data?.[0]?.availability_lock_day ?? 20;
}

/**
 * Verrouillé si :
 *  - un planning publié couvre le mois de la date cible, OU
 *  - la deadline (jour J du mois précédent la cible, à 23:59:59.999) est dépassée.
 */
async function isMonthLocked(supabase: any, targetDate: string, _userId?: string): Promise<boolean> {
  // Verrou "publication" : seulement si une publication couvre RÉELLEMENT la date cible
  // (une publication d'une semaine qui déborde d'un jour sur le mois suivant ne doit
  // pas verrouiller tout ce mois).
  const { data } = await supabase
    .from("planning_publications")
    .select("id")
    .lte("period_start", targetDate)
    .gte("period_end", targetDate)
    .limit(1);
  if ((data?.length ?? 0) > 0) return true;

  // Deadline : jour J du mois précédent la cible, à 23:59:59.999 heure Brussels.
  const [y, m] = targetDate.split("-").map(Number);
  const day = await getDeadlineDay(supabase);
  const deadlineMonth = addMonthsYM(y, m, -1);
  const deadline = brusselsDeadlineDate(deadlineMonth.year, deadlineMonth.month, day);
  return Date.now() > deadline.getTime();
}


function validateRangeShape(start: string, end: string, minDurationMin: number) {
  const s = t2m(start);
  const e = t2m(end);
  if (s % STEP_MIN !== 0 || e % STEP_MIN !== 0) {
    throw new Error("Les heures doivent être alignées sur 15 minutes");
  }
  if (e <= s) throw new Error("L'heure de fin doit être après le début");
  if (e - s < minDurationMin) {
    throw new Error(`Une dispo doit faire au moins ${fmtHours(minDurationMin)}`);
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

    if (!admin && await isMonthLocked(supabase, data.avail_date, userId)) {
      throw new Error("Modifications fermées (deadline dépassée ou planning publié). Fais une demande de modification depuis l'accueil.");
    }

    const minDur = await getMinDurationMin(supabase);
    const { s, e } = validateRangeShape(data.start_time, data.end_time, minDur);
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

    if (!admin && await isMonthLocked(supabase, existing.avail_date, userId)) {
      throw new Error("Modifications fermées (deadline dépassée ou planning publié). Fais une demande de modification.");
    }

    const minDur = await getMinDurationMin(supabase);
    const { s, e } = validateRangeShape(data.start_time, data.end_time, minDur);
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
    if (!admin && await isMonthLocked(supabase, existing.avail_date, userId)) {
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
    const now = new Date();
    const today = getBrusselsDateParts(now);
    const target = addMonthsYM(today.year, today.month, 1);
    const deadline = brusselsDeadlineDate(today.year, today.month, day);
    const msLeft = deadline.getTime() - now.getTime();
    const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
    const targetMonthFirst = monthStartISO(target.year, target.month);
    const published = await isMonthLocked(supabase, targetMonthFirst);
    return {
      deadline_day: day,
      deadline_iso: deadline.toISOString(),
      target_year: target.year,
      target_month: target.month - 1, // 0-indexed
      days_left: daysLeft,
      passed: msLeft < 0,
      planning_published: published,
    };
  });

// =============================================================================
// getAvailabilityLockInfo
// Dispos ouvertes en permanence. Chaque mois a une deadline : jour
// `availability_lock_day` du mois précédent à 23:59. Les mois passés / courant
// sont verrouillés, le mois suivant l'est aussi quand la deadline est passée.
// =============================================================================
export interface AvailabilityLockInfo {
  lockDay: number;
  currentMonth: { year: number; month: number };
  nextDeadline: string;
  msUntilDeadline: number;
  lockedMonthsForUser: Array<{ year: number; month: number; locked: boolean }>;
}

export const getAvailabilityLockInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AvailabilityLockInfo> => {
    const { supabase } = context;
    const { data: settings } = await supabase
      .from("ai_planning_settings")
      .select("availability_lock_day")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const lockDay = (settings as any)?.availability_lock_day ?? 25;

    const now = new Date();
    const brusselsNow = getBrusselsDateParts(now);
    const currentYear = brusselsNow.year;
    const currentMonth = brusselsNow.month; // 1-12

    // Prochaine deadline = lockDay ce mois si pas encore passée, sinon lockDay le mois prochain
    const thisMonthDeadline = brusselsDeadlineDate(currentYear, currentMonth, lockDay);
    let nextDeadlineDate: Date;
    if (now.getTime() <= thisMonthDeadline.getTime()) {
      nextDeadlineDate = thisMonthDeadline;
    } else {
      const nextDeadlineMonth = addMonthsYM(currentYear, currentMonth, 1);
      nextDeadlineDate = brusselsDeadlineDate(nextDeadlineMonth.year, nextDeadlineMonth.month, lockDay);
    }


    const nextMonth = addMonthsYM(currentYear, currentMonth, 1);
    const nextMonthYear = nextMonth.year;
    const nextMonthMonth = nextMonth.month;
    const nextMonthLocked = now.getTime() > thisMonthDeadline.getTime();

    const lockedMonthsForUser: Array<{ year: number; month: number; locked: boolean }> = [];
    for (let offset = 0; offset < 13; offset++) {
      const target = addMonthsYM(currentYear, currentMonth, offset);
      const ty = target.year;
      const tm = target.month;
      let locked = false;
      if (ty < currentYear || (ty === currentYear && tm <= currentMonth)) {
        locked = true;
      } else if (ty === nextMonthYear && tm === nextMonthMonth) {
        locked = nextMonthLocked;
      }
      lockedMonthsForUser.push({ year: ty, month: tm, locked });
    }

    return {
      lockDay,
      currentMonth: { year: currentYear, month: currentMonth },
      nextDeadline: nextDeadlineDate.toISOString(),
      msUntilDeadline: Math.max(0, nextDeadlineDate.getTime() - now.getTime()),
      lockedMonthsForUser,
    };
  });

// =============================================================================
// checkUserDispoStatus — l'utilisateur a-t-il rempli ses dispos pour le mois
// prochain ? Utilisé par la home staff-app pour afficher un encart de rappel.
// =============================================================================
export const checkUserDispoStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const now = getBrusselsDateParts();
    const nextMonth = addMonthsYM(now.year, now.month, 1);
    const nextMonthStart = monthStartISO(nextMonth.year, nextMonth.month);
    const nextMonthEnd = monthEndISO(nextMonth.year, nextMonth.month);

    const { count } = await supabase
      .from("availabilities")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("avail_date", nextMonthStart)
      .lte("avail_date", nextMonthEnd);

    const c = count ?? 0;
    return {
      nextMonthYear: nextMonth.year,
      nextMonthMonth: nextMonth.month,
      hasFilledNextMonth: c > 0,
      countNextMonth: c,
    };
  });


// =============================================================================
// MONITORING ADMIN — vue par mois des dispos remplies / partielles / vides
// =============================================================================
export interface MonthlyDispoStatus {
  userId: string;
  firstName: string;
  lastName: string;
  contract: string | null;
  contracts: string[];
  studioIds: string[];
  availsCount: number;
  availHours: number;
  assignedHours: number;
  assignedShifts: number;
  fulfillmentPct: number | null;
  lastSubmittedAt: string | null;
  status: "complete" | "partial" | "empty";
}

function diffHours(start: string, end: string): number {
  // "HH:MM:SS" -> minutes
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + (m || 0);
  };
  const d = toMin(end) - toMin(start);
  return d > 0 ? d / 60 : 0;
}

export const getMonthlyDispoMonitoring = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      year: z.number().int().min(2020).max(2100),
      month: z.number().int().min(1).max(12),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .in("role", ["admin", "manager"])
      .maybeSingle();
    if (!roleRow) throw new Error("Admin/manager uniquement");

    const start = monthStartISO(data.year, data.month);
    const end = monthEndISO(data.year, data.month);

    const { data: adminIds } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "manager"]);
    const adminSet = new Set((adminIds ?? []).map((r: any) => r.user_id));

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, first_name, last_name, contract, studio_id")
      .eq("status", "active");
    const employees = (profiles ?? []).filter((p: any) => !adminSet.has(p.id));

    const { data: avails } = await supabaseAdmin
      .from("availabilities")
      .select("user_id, avail_date, start_time, end_time, created_at")
      .gte("avail_date", start)
      .lte("avail_date", end);

    const byUser = new Map<string, { count: number; hours: number; days: Set<string>; lastAt: string | null }>();
    for (const a of avails ?? []) {
      const existing = byUser.get(a.user_id) ?? { count: 0, hours: 0, days: new Set<string>(), lastAt: null };
      existing.count++;
      existing.hours += diffHours(a.start_time, a.end_time);
      existing.days.add(a.avail_date);
      if (!existing.lastAt || a.created_at > existing.lastAt) existing.lastAt = a.created_at;
      byUser.set(a.user_id, existing);
    }

    const { data: shiftsRows } = await supabaseAdmin
      .from("shifts")
      .select("user_id, shift_date, start_time, end_time, status")
      .gte("shift_date", start)
      .lte("shift_date", end)
      .not("user_id", "is", null)
      .neq("status", "cancelled");

    const shiftsByUser = new Map<string, { count: number; hours: number; days: Set<string> }>();
    for (const s of shiftsRows ?? []) {
      if (!s.user_id) continue;
      const existing = shiftsByUser.get(s.user_id) ?? { count: 0, hours: 0, days: new Set<string>() };
      existing.count++;
      existing.hours += diffHours(s.start_time, s.end_time);
      existing.days.add(s.shift_date);
      shiftsByUser.set(s.user_id, existing);
    }

    const { data: studios } = await supabaseAdmin
      .from("user_studios")
      .select("user_id, studio_id");
    const studiosByUser = new Map<string, Set<string>>();
    for (const s of studios ?? []) {
      const set = studiosByUser.get(s.user_id) ?? new Set<string>();
      set.add(s.studio_id);
      studiosByUser.set(s.user_id, set);
    }

    const { data: contractsRows } = await supabaseAdmin
      .from("user_contracts")
      .select("user_id, contract");
    const contractsByUser = new Map<string, Set<string>>();
    for (const c of contractsRows ?? []) {
      const set = contractsByUser.get(c.user_id) ?? new Set<string>();
      set.add(c.contract);
      contractsByUser.set(c.user_id, set);
    }

    const rows: MonthlyDispoStatus[] = employees.map((p: any) => {
      const info = byUser.get(p.id) ?? { count: 0, hours: 0, days: new Set<string>(), lastAt: null };
      const sh = shiftsByUser.get(p.id) ?? { count: 0, hours: 0, days: new Set<string>() };
      let status: "complete" | "partial" | "empty";
      if (info.count === 0) status = "empty";
      else if (info.count < 5) status = "partial";
      else status = "complete";

      const studioSet = studiosByUser.get(p.id) ?? new Set<string>();
      if (p.studio_id) studioSet.add(p.studio_id);

      const contractSet = contractsByUser.get(p.id) ?? new Set<string>();
      if (p.contract) contractSet.add(p.contract);

      const availHours = Math.round(info.hours * 10) / 10;
      const assignedHours = Math.round(sh.hours * 10) / 10;
      // Fulfilment = jours travaillés / jours de dispo (peu importe les heures, sans
      // filtrer par intersection — si l'employé a bossé un jour non déclaré dispo,
      // ça compte quand même comme un jour rempli). Capé à 100 %.
      const availDays = info.days.size;
      const assignedDays = sh.days.size;
      const fulfillmentPct = availDays > 0 ? Math.min(100, Math.round((assignedDays / availDays) * 100)) : null;

      return {
        userId: p.id,
        firstName: p.first_name ?? "",
        lastName: p.last_name ?? "",
        contract: p.contract,
        contracts: Array.from(contractSet),
        studioIds: Array.from(studioSet),
        availsCount: info.count,
        availHours,
        assignedHours,
        assignedShifts: sh.count,
        fulfillmentPct,
        lastSubmittedAt: info.lastAt,
        status,
      };
    });


    const order: Record<string, number> = { empty: 0, partial: 1, complete: 2 };
    rows.sort((a, b) => order[a.status] - order[b.status] || a.lastName.localeCompare(b.lastName));

    return {
      year: data.year,
      month: data.month,
      total: rows.length,
      complete: rows.filter((r) => r.status === "complete").length,
      partial: rows.filter((r) => r.status === "partial").length,
      empty: rows.filter((r) => r.status === "empty").length,
      rows,
    };
  });


export const remindLateEmployees = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      year: z.number().int(),
      month: z.number().int(),
      userIds: z.array(z.string().uuid()).min(1).max(200),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .in("role", ["admin", "manager"])
      .maybeSingle();
    if (!roleRow) throw new Error("Admin uniquement");

    const monthLabel = formatBrusselsMonthLabel(data.year, data.month);

    // 1. Notifications in-app
    const notifs = data.userIds.map((uid) => ({
      user_id: uid,
      type: "dispo_manual_reminder",
      title: "Rappel : tes dispos sont attendues",
      body: `Ton manager te demande de remplir tes dispos pour ${monthLabel}.`,
      link: "/staff-app?tab=accueil",
      priority: "high",
      category: "general",
    }));
    if (notifs.length > 0) {
      const { error } = await supabaseAdmin.from("notifications").insert(notifs);
      if (error) throw new Error(error.message);
    }

    // 2. Emails — render + enqueue directly via shared helper
    let emailsSent = 0;
    try {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, first_name, email")
        .in("id", data.userIds);

      // Deadline = lockDay du mois précédent
      const { data: settings } = await supabaseAdmin
        .from("ai_planning_settings")
        .select("availability_lock_day")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const lockDay = (settings as any)?.availability_lock_day ?? 25;
      const deadlineMonth = data.month === 1 ? 12 : data.month - 1;
      const deadlineYear = data.month === 1 ? data.year - 1 : data.year;
      const deadline = brusselsDeadlineDate(deadlineYear, deadlineMonth, lockDay);
      const deadlineLabel = formatBrusselsDeadlineLabel(deadline);

      const statsAppUrl = "https://app.shyft.flashsite.fr/staff-app";

      const { enqueueTemplateEmail } = await import("@/lib/email-send.server");
      const recipients = (profiles ?? []).filter((p: any) => p.email);
      const results = await Promise.allSettled(
        recipients.map((p: any) =>
          enqueueTemplateEmail({
            templateId: "dispo-reminder",
            recipient: p.email,
            idempotencyKey: `dispo-reminder-${data.year}-${data.month}-${p.id}-${Date.now()}`,
            data: {
              firstName: p.first_name ?? "",
              monthLabel,
              deadlineLabel,
              statsAppUrl,
            },
          }).then((r) => {
            if (!r.ok) {
              console.error("[remindLateEmployees] email failed", p.email, r.reason);
              return null;
            }
            return r;
          }),
        ),
      );
      emailsSent = results.filter((r) => r.status === "fulfilled" && r.value).length;
    } catch (e) {
      console.error("[remindLateEmployees] email block error", e);
    }

    return { ok: true, sent: data.userIds.length, notifsSent: data.userIds.length, emailsSent };
  });


// =============================================================================
// getUserAvailabilitiesForMonth — détail des dispos d'un employé pour un mois
// =============================================================================
export const getUserAvailabilitiesForMonth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      userId: z.string().uuid(),
      year: z.number().int().min(2020).max(2100),
      month: z.number().int().min(1).max(12),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .in("role", ["admin", "manager"])
      .maybeSingle();
    if (!roleRow) throw new Error("Admin/manager uniquement");

    const start = monthStartISO(data.year, data.month);
    const end = monthEndISO(data.year, data.month);

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, first_name, last_name, contract")
      .eq("id", data.userId)
      .maybeSingle();

    const { data: avails } = await supabaseAdmin
      .from("availabilities")
      .select("id, avail_date, start_time, end_time, created_at")
      .eq("user_id", data.userId)
      .gte("avail_date", start)
      .lte("avail_date", end)
      .order("avail_date", { ascending: true })
      .order("start_time", { ascending: true });

    return {
      profile: profile ?? null,
      availabilities: avails ?? [],
    };
  });

// =============================================================================
// getUserAvailabilitiesAll — toutes les dispos d'un employé (tous mois)
// =============================================================================
export const getUserAvailabilitiesAll = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ userId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .in("role", ["admin", "manager"])
      .maybeSingle();
    if (!roleRow) throw new Error("Admin/manager uniquement");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, first_name, last_name, contract")
      .eq("id", data.userId)
      .maybeSingle();

    const { data: avails } = await supabaseAdmin
      .from("availabilities")
      .select("id, avail_date, start_time, end_time, created_at")
      .eq("user_id", data.userId)
      .order("avail_date", { ascending: true })
      .order("start_time", { ascending: true });

    return {
      profile: profile ?? null,
      availabilities: avails ?? [],
    };
  });

// =============================================================================
// getClosedDaysForMonth — jours grisés pour l'employé (fermetures + absence
// totale de besoin staffing) dans tous ses studios. Un jour est "fermé" si,
// POUR CHACUN des studios de l'employé : (a) une studio_exception de type
// 'fermeture' existe ce jour-là, OU (b) aucun staffing_template avec
// required_count > 0 n'existe pour ce day_of_week. Si l'employé n'est lié à
// aucun studio, on retourne [] (rien de grisé).
// =============================================================================
export const getClosedDaysForMonth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      year: z.number().int().min(2020).max(2100),
      month: z.number().int().min(1).max(12), // 1-12
    }).parse(i),
  )
  .handler(async ({ data, context }): Promise<{ closedDays: number[] }> => {
    const { supabase, userId } = context;

    // Studios de l'employé : user_studios + profiles.studio_id en fallback
    const [{ data: us }, { data: prof }] = await Promise.all([
      supabase.from("user_studios").select("studio_id").eq("user_id", userId),
      supabase.from("profiles").select("studio_id").eq("id", userId).maybeSingle(),
    ]);
    const studioSet = new Set<string>();
    (us ?? []).forEach((r: any) => r.studio_id && studioSet.add(r.studio_id));
    if ((prof as any)?.studio_id) studioSet.add((prof as any).studio_id);
    const studioIds = Array.from(studioSet);
    if (studioIds.length === 0) return { closedDays: [] };

    const pad = (n: number) => String(n).padStart(2, "0");
    const daysInMonth = new Date(data.year, data.month, 0).getDate();
    const start = `${data.year}-${pad(data.month)}-01`;
    const end = `${data.year}-${pad(data.month)}-${pad(daysInMonth)}`;

    const [{ data: tpl }, { data: exc }] = await Promise.all([
      supabase
        .from("staffing_templates")
        .select("studio_id, day_of_week, required_count")
        .in("studio_id", studioIds),
      supabase
        .from("studio_exceptions")
        .select("studio_id, exception_date, exception_type")
        .in("studio_id", studioIds)
        .gte("exception_date", start)
        .lte("exception_date", end),
    ]);

    // hasNeed[studio][dow] = true si au moins un template requis > 0
    const hasNeed: Record<string, Record<number, boolean>> = {};
    for (const sid of studioIds) hasNeed[sid] = {};
    for (const t of (tpl ?? []) as any[]) {
      if ((t.required_count ?? 0) > 0) {
        hasNeed[t.studio_id][t.day_of_week] = true;
      }
    }

    // closures[studio][YYYY-MM-DD] = true
    const closures: Record<string, Set<string>> = {};
    for (const sid of studioIds) closures[sid] = new Set<string>();
    for (const e of (exc ?? []) as any[]) {
      if (e.exception_type === "fermeture") {
        closures[e.studio_id].add(e.exception_date);
      }
    }

    const closedDays: number[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const iso = `${data.year}-${pad(data.month)}-${pad(day)}`;
      const dow = new Date(data.year, data.month - 1, day).getDay();
      let allClosed = true;
      for (const sid of studioIds) {
        const closedHere = closures[sid].has(iso) || !hasNeed[sid][dow];
        if (!closedHere) { allClosed = false; break; }
      }
      if (allClosed) closedDays.push(day);
    }

    return { closedDays };
  });
