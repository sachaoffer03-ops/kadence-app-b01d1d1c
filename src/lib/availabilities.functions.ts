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
async function isMonthLocked(supabase: any, targetDate: string, _userId?: string): Promise<boolean> {


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

    if (!admin && await isMonthLocked(supabase, data.avail_date, userId)) {
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

    if (!admin && await isMonthLocked(supabase, existing.avail_date, userId)) {
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
    const currentDay = now.getDate();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12

    // Prochaine deadline = lockDay ce mois si pas encore passée, sinon lockDay le mois prochain
    const thisMonthDeadline = new Date(currentYear, currentMonth - 1, lockDay, 23, 59, 59, 999);
    let nextDeadlineDate: Date;
    if (now.getTime() <= thisMonthDeadline.getTime()) {
      nextDeadlineDate = thisMonthDeadline;
    } else {
      const ny = currentMonth === 12 ? currentYear + 1 : currentYear;
      const nm = currentMonth === 12 ? 1 : currentMonth + 1;
      nextDeadlineDate = new Date(ny, nm - 1, lockDay, 23, 59, 59, 999);
    }

    const nextMonthYear = currentMonth === 12 ? currentYear + 1 : currentYear;
    const nextMonthMonth = currentMonth === 12 ? 1 : currentMonth + 1;
    const nextMonthLocked = currentDay > lockDay;

    const lockedMonthsForUser: Array<{ year: number; month: number; locked: boolean }> = [];
    for (let offset = 0; offset < 13; offset++) {
      const target = new Date(currentYear, currentMonth - 1 + offset, 1);
      const ty = target.getFullYear();
      const tm = target.getMonth() + 1;
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
    const now = new Date();
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    const pad = (n: number) => String(n).padStart(2, "0");
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    const { count } = await supabase
      .from("availabilities")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("avail_date", fmt(nextMonthStart))
      .lte("avail_date", fmt(nextMonthEnd));

    const c = count ?? 0;
    return {
      nextMonthYear: nextMonthStart.getFullYear(),
      nextMonthMonth: nextMonthStart.getMonth() + 1,
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
  studioIds: string[];
  availsCount: number;
  lastSubmittedAt: string | null;
  status: "complete" | "partial" | "empty";
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

    const pad = (n: number) => String(n).padStart(2, "0");
    const start = `${data.year}-${pad(data.month)}-01`;
    const lastDay = new Date(data.year, data.month, 0).getDate();
    const end = `${data.year}-${pad(data.month)}-${pad(lastDay)}`;

    const { data: adminIds } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "manager"]);
    const adminSet = new Set((adminIds ?? []).map((r: any) => r.user_id));

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, first_name, last_name, contract")
      .eq("status", "active");
    const employees = (profiles ?? []).filter((p: any) => !adminSet.has(p.id));

    const { data: avails } = await supabaseAdmin
      .from("availabilities")
      .select("user_id, avail_date, created_at")
      .gte("avail_date", start)
      .lte("avail_date", end);

    const byUser = new Map<string, { count: number; lastAt: string | null }>();
    for (const a of avails ?? []) {
      const existing = byUser.get(a.user_id) ?? { count: 0, lastAt: null };
      existing.count++;
      if (!existing.lastAt || a.created_at > existing.lastAt) existing.lastAt = a.created_at;
      byUser.set(a.user_id, existing);
    }

    const { data: studios } = await supabaseAdmin
      .from("user_studios")
      .select("user_id, studio_id");
    const studiosByUser = new Map<string, string[]>();
    for (const s of studios ?? []) {
      const arr = studiosByUser.get(s.user_id) ?? [];
      arr.push(s.studio_id);
      studiosByUser.set(s.user_id, arr);
    }

    const rows: MonthlyDispoStatus[] = employees.map((p: any) => {
      const info = byUser.get(p.id) ?? { count: 0, lastAt: null };
      let status: "complete" | "partial" | "empty";
      if (info.count === 0) status = "empty";
      else if (info.count < 5) status = "partial";
      else status = "complete";
      return {
        userId: p.id,
        firstName: p.first_name ?? "",
        lastName: p.last_name ?? "",
        contract: p.contract,
        studioIds: studiosByUser.get(p.id) ?? [],
        availsCount: info.count,
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
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .in("role", ["admin", "manager"])
      .maybeSingle();
    if (!roleRow) throw new Error("Admin uniquement");

    const monthLabel = new Date(data.year, data.month - 1, 1)
      .toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

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

    return { ok: true, sent: data.userIds.length };
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

    const pad = (n: number) => String(n).padStart(2, "0");
    const start = `${data.year}-${pad(data.month)}-01`;
    const lastDay = new Date(data.year, data.month, 0).getDate();
    const end = `${data.year}-${pad(data.month)}-${pad(lastDay)}`;

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
