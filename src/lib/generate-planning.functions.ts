// =============================================================================
// MOTEUR DE GÉNÉRATION DE PLANNING — Kadence
// =============================================================================
// 3 server functions :
//   - generatePlanning  : produit un planning sur 1 mois, 1+ studios
//   - cancelPlanningRun : supprime les shifts générés par un run (garde manuels/lockés)
//   - listPlanningRuns  : historique des générations (admin)
//
// Algorithme : greedy 4-passes (A: CDI longs, B: Étudiants/Flexis,
//              C: optimisation locale, D: ajustement CDI vers target)
//
// Wall-clock local Bruxelles partout, pas de conversion timezone.
// =============================================================================

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertManagerPermission } from "@/lib/permission-guard.server";
import { fetchAll } from "@/lib/supabase-paginate";
import { getWeeklyCapForUser } from "@/lib/weekly-cap";
import {
  getRequiredRoles,
  isHybridShift,
  validateRoleSegments,
  type RoleSegment,
} from "@/lib/role-segments";

// ─── Constantes ──────────────────────────────────────────────────────────────
const CELL_MIN = 15;             // granularité (15 min)
const MAX_OPT_ITERS = 100;       // passe C
// Le rôle "cuisine" est identifié via business_roles.is_kitchen.
// Fallback string pour rétro-compat tant que tous les rôles ne sont pas étiquetés.
const KITCHEN_ROLE_FALLBACK = "Cuisine";

// ─── Types ───────────────────────────────────────────────────────────────────
type ContractType = "CDI" | "Étudiant" | "Flexi";
type Role = string;

interface Settings {
  weight_performance: number;
  weight_equity: number;
  weight_preference: number;
  weight_random: number;
  enforce_rest_11h: boolean;
  enforce_max_weekly_cdi: boolean;
  enforce_student_quota: boolean;
  strict_preferences: boolean;
  min_shift_hours: number;
  max_shift_hours: number;
  max_shift_hours_cdi: number;
  max_shift_hours_student: number;
  max_shift_hours_flexi: number;
  max_weekly_cdi_hours: number;
  max_weekly_student_hours: number;
  max_weekly_flexi_hours: number;
  target_weekly_cdi_hours: number;
  cdi_hours_tolerance: number;
  default_score_when_null: number;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  score: number;
  status: string | null;
  contracts: Set<ContractType>;
  studios: Set<string>;
  roles: Set<Role>;
  // Cumul des heures attribuées par semaine ISO (clé = lundi de la semaine)
  weeklyMin: Map<string, number>;
  // Tous les shifts attribués pendant ce run (lookup conflit + repos)
  assigned: Array<{ date: string; startMin: number; endMin: number; studio_id: string; role: Role; reqId: string }>;
  totalAssignedMin: number;
  allow_extended_hours: boolean;
  weekly_hours_cap: number | null;
  // Total des minutes de dispos déclarées sur le mois (générosité)
  availMonthMin: number;
}


interface AvailRange { startMin: number; endMin: number; studioId: string | null; }

interface Requirement {
  id: string;
  studio_id: string;
  date: string;
  role: Role;
  startMin: number;
  endMin: number;
  required_contract: ContractType | null;
  allowed_contracts: ContractType[];
  allowed_roles: Role[];
  is_optional: boolean;
  // Hybrid support
  role_segments: RoleSegment[] | null;
  is_hybrid: boolean;
  required_roles: Role[]; // tous les rôles requis (intersection pour candidats)
  // Découpage en cellules de 15 min : assignation user (null = trou)
  cells: Cell[];
  // Source pour Pass C : compter les itérations qui ont servi
}

interface Cell {
  startMin: number;
  endMin: number;
  userId: string | null;
  blocked: boolean; // bloqué = couvert par shift manuel/locké pré-existant
}

// ─── Helpers temps ───────────────────────────────────────────────────────────
const t2m = (t: string) => {
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
};
const m2t = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isoWeekStart(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  const dow = d.getDay(); // 0=dim
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return isoDate(d);
}

function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  const s = new Date(`${from}T00:00:00`);
  const e = new Date(`${to}T00:00:00`);
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) out.push(isoDate(d));
  return out;
}

// 0 = lundi, 6 = dimanche (convention staffing_templates existante)
function dowMon0(dateStr: string): number {
  const d = new Date(`${dateStr}T00:00:00`).getDay();
  return (d + 6) % 7;
}

// ─── Input ───────────────────────────────────────────────────────────────────
const GenerateInput = z.object({
  month_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  studio_ids: z.array(z.string().uuid()).optional(),
  preserve_manual: z.boolean().default(true),
  preserve_locked: z.boolean().default(true),
  dry_run: z.boolean().default(false),
});

// ─── Server fn : ADMIN GUARD ─────────────────────────────────────────────────
async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (!data?.some((r: any) => r.role === "admin")) {
    throw new Error("Seuls les admins peuvent gérer la génération de planning");
  }
}

// =============================================================================
// generatePlanning
// =============================================================================
export const generatePlanning = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => GenerateInput.parse(input))
  .handler(async ({ data, context }) => {
    const t0 = Date.now();
    const { supabase, userId } = context;
    await assertManagerPermission(supabase, userId, "/planning:generate");

    // ── Période : du jour choisi jusqu'à la fin du mois calendaire (28/30/31 jours selon le mois)
    const monthStart = data.month_start_date;
    const startD = new Date(`${monthStart}T00:00:00`);
    // Dernier jour du mois de startD : jour 0 du mois suivant
    const endD = new Date(startD.getFullYear(), startD.getMonth() + 1, 0);
    const monthEnd = isoDate(endD);

    // ── Verrou : refus si un run 'running' existe déjà sur la même période
    const { data: lockRun } = await supabase
      .from("planning_runs")
      .select("id, started_at")
      .eq("status", "running")
      .lte("month_start_date", monthEnd)
      .gte("month_end_date", monthStart)
      .limit(1)
      .maybeSingle();
    if (lockRun) {
      throw new Error(
        `Une génération est déjà en cours pour cette période (run ${lockRun.id} démarré à ${lockRun.started_at}). Réessayez dans quelques minutes.`,
      );
    }

    // ── Studios cibles
    const { data: allStudios } = await supabase.from("studios").select("id, name, has_kitchen");
    const studiosArr = (allStudios ?? []) as Array<{ id: string; name: string; has_kitchen: boolean }>;
    const studioIds = data.studio_ids?.length
      ? studiosArr.filter((s) => data.studio_ids!.includes(s.id)).map((s) => s.id)
      : studiosArr.map((s) => s.id);
    const studioName = new Map(studiosArr.map((s) => [s.id, s.name]));
    if (studioIds.length === 0) throw new Error("Aucun studio sélectionné");

    // ── Crée le run en status 'running'
    const { data: runRow, error: runErr } = await supabase
      .from("planning_runs")
      .insert({
        month_start_date: monthStart,
        month_end_date: monthEnd,
        studios_included: studioIds,
        status: "running",
        triggered_by: userId,
        preserve_manual: data.preserve_manual,
        preserve_locked: data.preserve_locked,
        dry_run: data.dry_run,
      })
      .select("id")
      .single();
    if (runErr || !runRow) throw new Error(`Impossible de créer le run : ${runErr?.message}`);
    const runId = runRow.id as string;

    try {
      const result = await runEngine({
        supabase, runId, monthStart, monthEnd, studioIds, studiosArr, studioName,
        preserveManual: data.preserve_manual,
        preserveLocked: data.preserve_locked,
        dryRun: data.dry_run,
      });

      const durationMs = Date.now() - t0;
      await supabase.from("planning_runs").update({
        status: result.status,
        coverage_rate: result.coverage_rate,
        shifts_generated: result.shifts_generated,
        shifts_with_holes: result.holes.length,
        completed_at: new Date().toISOString(),
        duration_ms: durationMs,
        solver_logs: result.solver_logs,
        alerts: result.alerts,
      }).eq("id", runId);

      return { planning_run_id: runId, duration_ms: durationMs, ...result };
    } catch (e: any) {
      await supabase.from("planning_runs").update({
        status: "failed",
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - t0,
        error_message: e?.message ?? String(e),
      }).eq("id", runId);
      throw e;
    }
  });

// =============================================================================
// cancelPlanningRun
// =============================================================================
export const cancelPlanningRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ run_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertManagerPermission(supabase, userId, "/planning:generate");

    const { data: run } = await supabase
      .from("planning_runs")
      .select("id, month_start_date, month_end_date, studios_included, status")
      .eq("id", data.run_id)
      .maybeSingle();
    if (!run) throw new Error("Run introuvable");
    if (run.status === "running") throw new Error("Impossible d'annuler un run encore en cours");

    // Supprime UNIQUEMENT les shifts créés par CE run (jamais manuels/lockés/autres runs)
    const { error, count } = await supabase
      .from("shifts")
      .delete({ count: "exact" })
      .eq("created_by_run_id", data.run_id)
      .eq("is_locked", false)
      .eq("is_manual", false);
    if (error) throw new Error(`Suppression échouée : ${error.message}`);

    return { ok: true, deleted: count ?? 0 };
  });

// =============================================================================
// listPlanningRuns
// =============================================================================
export const listPlanningRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertManagerPermission(supabase, userId, "/planning:generate");
    const { data, error } = await supabase
      .from("planning_runs")
      .select("id, month_start_date, month_end_date, studios_included, status, workflow_status, coverage_rate, shifts_generated, shifts_with_holes, started_at, completed_at, duration_ms, dry_run, solver_logs, alerts, error_message, published_at")
      .order("started_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return { runs: data ?? [] };
  });

// =============================================================================
// MOTEUR — fonction interne (évite de polluer la signature createServerFn)
// =============================================================================
interface EngineCtx {
  supabase: any;
  runId: string;
  monthStart: string;
  monthEnd: string;
  studioIds: string[];
  studiosArr: Array<{ id: string; name: string; has_kitchen: boolean }>;
  studioName: Map<string, string>;
  preserveManual: boolean;
  preserveLocked: boolean;
  dryRun: boolean;
}

async function runEngine(ctx: EngineCtx) {
  const { supabase, monthStart, monthEnd, studioIds, studioName, preserveManual, preserveLocked, dryRun } = ctx;
  const logs: any = { phases: {} };
  const alerts: Array<{ type: string; severity: "info" | "warning" | "error"; user_id?: string; user_name?: string; message: string }> = [];

  // ─── PHASE 0 — Chargement des données ─────────────────────────────────────
  const t_load = Date.now();
  const [settingsRows, profilesRows, contractsRows, rolesRows, studiosRows, availsRows, templatesRows, existingShifts, kitchenRolesRows, trainingCoursesRows, trainingCompletionsRows, businessRolesRows, unavailRows] = await Promise.all([
    supabase.from("ai_planning_settings").select("*").order("updated_at", { ascending: false }).limit(1),
    fetchAll<any>(supabase.from("profiles").select("id, first_name, last_name, score, contract, status, allow_extended_hours, weekly_hours_cap, is_test").eq("status", "active").or("is_test.is.null,is_test.eq.false")),
    fetchAll<any>(supabase.from("user_contracts").select("user_id, contract")),
    fetchAll<any>(supabase.from("user_business_roles").select("user_id, role")),
    fetchAll<any>(supabase.from("user_studios").select("user_id, studio_id")),
    fetchAll<any>(supabase.from("availabilities").select("user_id, avail_date, start_time, end_time, studio_id").gte("avail_date", monthStart).lte("avail_date", monthEnd)),
    fetchAll<any>(supabase.from("staffing_templates").select("*").in("studio_id", studioIds)),
    fetchAll<any>(supabase.from("shifts").select("id, user_id, studio_id, shift_date, start_time, end_time, business_role, role_segments, is_manual, is_locked").gte("shift_date", monthStart).lte("shift_date", monthEnd).in("studio_id", studioIds)),
    fetchAll<any>(supabase.from("business_roles").select("name, is_kitchen").eq("is_kitchen", true)),
    fetchAll<any>(supabase.from("training_courses").select("id, business_role_id, is_required_for_all, required_for_planning").eq("required_for_planning", true)),
    fetchAll<any>(supabase.from("training_course_completions").select("user_id, course_id")),
    fetchAll<any>(supabase.from("business_roles").select("id, name")),
    fetchAll<any>(supabase.from("unavailability_periods").select("user_id, start_date, end_date").lte("start_date", monthEnd).gte("end_date", monthStart)),
  ]);

  // Indisponibilités : Map<userId, Array<{start,end}>>
  const unavailByUser = new Map<string, Array<{ start: string; end: string }>>();
  for (const u of unavailRows ?? []) {
    if (!unavailByUser.has(u.user_id)) unavailByUser.set(u.user_id, []);
    unavailByUser.get(u.user_id)!.push({ start: u.start_date, end: u.end_date });
  }
  const isUnavailable = (uid: string, date: string): boolean => {
    const periods = unavailByUser.get(uid);
    if (!periods) return false;
    return periods.some((p) => date >= p.start && date <= p.end);
  };

  // Formation gating : per user → roles that they can't take because a required course is not completed
  const roleNameById = new Map<string, string>((businessRolesRows ?? []).map((r: any) => [r.id, r.name]));
  const completionsByUser = new Map<string, Set<string>>();
  for (const c of trainingCompletionsRows ?? []) {
    if (!completionsByUser.has(c.user_id)) completionsByUser.set(c.user_id, new Set());
    completionsByUser.get(c.user_id)!.add(c.course_id);
  }
  // Une formation requise ne doit pas rendre un rôle impossible à planifier si
  // personne ne l'a encore validée. Dans ce cas on garde le planning possible
  // et on laisse le suivi formation se faire à côté, sinon tous les Barista
  // peuvent disparaître des candidats d'un coup.
  const planningCourses = (trainingCoursesRows ?? []).filter((course: any) => {
    if (!course.required_for_planning) return false;
    return (trainingCompletionsRows ?? []).some((c: any) => c.course_id === course.id);
  });

  const ignoredPlanningCourses = (trainingCoursesRows ?? []).filter((course: any) =>
    course.required_for_planning && !planningCourses.some((active: any) => active.id === course.id),
  );
  if (ignoredPlanningCourses.length > 0) {
    alerts.push({
      type: "training_not_blocking",
      severity: "info",
      message: `${ignoredPlanningCourses.length} formation(s) planning ignorée(s) car aucune validation n'existe encore, pour éviter de créer des trous artificiels.`,
    });
  }

  // For each user, derive blocked role names
  const blockedRolesByUser = new Map<string, Set<string>>();
  // We'll compute lazily once we have employees; using a helper:
  function computeBlockedRoles(uid: string, userRoles: Set<string>): Set<string> {
    const blocked = new Set<string>();
    const completed = completionsByUser.get(uid) ?? new Set<string>();
    for (const course of planningCourses) {
      if (completed.has(course.id)) continue;
      if (course.is_required_for_all) {
        // blocks ALL roles
        for (const r of userRoles) blocked.add(r);
      } else if (course.business_role_id) {
        const rn = roleNameById.get(course.business_role_id);
        if (rn) blocked.add(rn);
      }
    }
    return blocked;
  }

  // Set des rôles considérés "cuisine" (DB-driven, fallback sur le nom historique)
  const kitchenRoles = new Set<string>(
    (kitchenRolesRows ?? []).map((r: any) => r.name).filter(Boolean),
  );
  if (kitchenRoles.size === 0) kitchenRoles.add(KITCHEN_ROLE_FALLBACK);
  const isKitchenRole = (role: string) => kitchenRoles.has(role);

  const s = parseSettings(settingsRows.data?.[0]);

  // Construction des employés
  const employees = new Map<string, Employee>();
  for (const p of profilesRows) {
    const score = (p.score == null ? s.default_score_when_null : Number(p.score));
    employees.set(p.id, {
      id: p.id,
      first_name: p.first_name ?? "",
      last_name: p.last_name ?? "",
      score,
      status: p.status,
      contracts: new Set(),
      studios: new Set(),
      roles: new Set(),
      weeklyMin: new Map(),
      assigned: [],
      totalAssignedMin: 0,
      availMonthMin: 0,

      allow_extended_hours: !!p.allow_extended_hours,
      weekly_hours_cap: p.weekly_hours_cap ?? null,
    });
    if (p.contract) employees.get(p.id)!.contracts.add(p.contract);
  }
  for (const r of contractsRows) employees.get(r.user_id)?.contracts.add(r.contract);
  for (const r of rolesRows) employees.get(r.user_id)?.roles.add(r.role);
  for (const r of studiosRows) employees.get(r.user_id)?.studios.add(r.studio_id);

  // Pré-calcul filtre formation : pour chaque employé, les rôles qu'il NE PEUT PAS prendre
  for (const e of employees.values()) {
    blockedRolesByUser.set(e.id, computeBlockedRoles(e.id, e.roles));
  }

  // Disponibilités → Map<userId, Map<date, AvailRange[]>>
  const availMap = new Map<string, Map<string, AvailRange[]>>();
  for (const a of availsRows) {
    let byDate = availMap.get(a.user_id);
    if (!byDate) { byDate = new Map(); availMap.set(a.user_id, byDate); }
    const arr = byDate.get(a.avail_date) ?? [];
    arr.push({ startMin: t2m(a.start_time), endMin: t2m(a.end_time), studioId: a.studio_id ?? null });
    byDate.set(a.avail_date, arr);
  }
  // matchStudio : une dispo sans studio (legacy / mono-studio) est valable partout ;
  // sinon elle ne matche que le studio ciblé.
  const matchStudio = (r: AvailRange, studioId: string) => r.studioId == null || r.studioId === studioId;
  const availOn = (uid: string, date: string): AvailRange[] => {
    if (isUnavailable(uid, date)) return [];
    return availMap.get(uid)?.get(date) ?? [];
  };
  const availOnFor = (uid: string, date: string, studioId: string): AvailRange[] =>
    availOn(uid, date).filter((r) => matchStudio(r, studioId));

  // Total dispos déclarées sur le mois par employé (générosité)
  for (const e of employees.values()) {
    let total = 0;
    const byDate = availMap.get(e.id);
    if (byDate) {
      for (const ranges of byDate.values()) {
        for (const r of ranges) total += Math.max(0, r.endMin - r.startMin);
      }
    }
    e.availMonthMin = total;
  }


  logs.phases.load_ms = Date.now() - t_load;
  logs.employee_count = employees.size;
  logs.template_count = templatesRows.length;
  logs.hybrid_template_count = (templatesRows ?? []).filter((t: any) => isHybridShift(t.role_segments as RoleSegment[] | null)).length;

  // ─── PHASE 1 — Détection "CDI cuisine unique" (studios avec cuisine) ─────
  const t_p1 = Date.now();
  const kitchenSoloByStudio = new Map<string, string | null>(); // studio_id → user_id ou null
  const kitchenStudios = ctx.studiosArr.filter((st) => st.has_kitchen && studioIds.includes(st.id));
  for (const kStudio of kitchenStudios) {
    const cdiKitchen = Array.from(employees.values()).filter(
      (e) => e.contracts.has("CDI")
        && Array.from(e.roles).some((r) => isKitchenRole(r))
        && e.studios.has(kStudio.id),
    );
    if (cdiKitchen.length === 1) {
      kitchenSoloByStudio.set(kStudio.id, cdiKitchen[0].id);
      alerts.push({
        type: "kitchen_solo",
        severity: "info",
        user_id: cdiKitchen[0].id,
        user_name: `${cdiKitchen[0].first_name} ${cdiKitchen[0].last_name}`,
        message: `${cdiKitchen[0].first_name} est l'unique CDI cuisine qualifié à ${kStudio.name} (staffing fragile : aucun remplaçant CDI en cas d'absence).`,
      });
    } else if (cdiKitchen.length === 0) {
      alerts.push({
        type: "kitchen_solo",
        severity: "warning",
        message: `Aucun CDI cuisine actif à ${kStudio.name}. Les besoins cuisine seront comblés par étudiants/flexis qualifiés s'il y en a.`,
      });
    }
  }
  logs.phases.p1_ms = Date.now() - t_p1;
  logs.kitchen_solo = Object.fromEntries(kitchenSoloByStudio);

  const isKitchenSolo = (uid: string, studioId: string): boolean =>
    kitchenSoloByStudio.get(studioId) === uid;

  // ─── PHASE 2 — Génération des slots à couvrir ────────────────────────────
  const t_p2 = Date.now();
  const requirements: Requirement[] = [];
  let reqCounter = 0;
  for (const date of eachDate(monthStart, monthEnd)) {
    const dow = dowMon0(date);
    for (const t of templatesRows) {
      if (t.day_of_week !== dow) continue;
      if (!studioIds.includes(t.studio_id)) continue;
      const startMin = t2m(t.start_time);
      const endMin = t2m(t.end_time);
      if (endMin <= startMin) continue;
      for (let k = 0; k < (t.required_count ?? 1); k++) {
        const cells: Cell[] = [];
        for (let m = startMin; m < endMin; m += CELL_MIN) {
          cells.push({ startMin: m, endMin: Math.min(m + CELL_MIN, endMin), userId: null, blocked: false });
        }
        const segs = (t.role_segments as RoleSegment[] | null) ?? null;
        const hybrid = isHybridShift(segs);
        const requiredRoles = getRequiredRoles(segs, t.business_role);
        requirements.push({
          id: `r${++reqCounter}`,
          studio_id: t.studio_id,
          date,
          role: t.business_role,
          startMin, endMin,
          required_contract: (t.required_contract ?? null) as ContractType | null,
          allowed_contracts: (t.allowed_contracts ?? []) as ContractType[],
          allowed_roles: (t.allowed_roles ?? []) as string[],
          is_optional: !!t.is_optional,
          role_segments: segs,
          is_hybrid: hybrid,
          required_roles: requiredRoles,
          cells,
        });
      }
    }
  }
  const totalCells = requirements.reduce((a, r) => a + r.cells.length, 0);
  const totalSlotsNeeded = requirements.length;
  logs.phases.p2_ms = Date.now() - t_p2;
  logs.total_requirements = totalSlotsNeeded;
  logs.total_cells = totalCells;

  // Bloque les cellules couvertes par shifts manuels/lockés et soustrait du quota
  const preservedShifts: any[] = [];
  for (const sh of existingShifts) {
    const isManual = sh.is_manual && preserveManual;
    const isLocked = sh.is_locked && preserveLocked;
    if (!isManual && !isLocked) continue;
    preservedShifts.push(sh);
    // Marquer les cellules qui chevauchent
    const sStart = t2m(sh.start_time), sEnd = t2m(sh.end_time);
    for (const r of requirements) {
      if (r.date !== sh.shift_date || r.studio_id !== sh.studio_id) continue;
      if (r.role !== sh.business_role) continue;
      for (const c of r.cells) {
        if (c.startMin >= sStart && c.endMin <= sEnd && !c.blocked) {
          c.blocked = true;
          c.userId = sh.user_id;
        }
      }
    }
    // Soustraire ces heures du quota hebdo de l'employé concerné
    if (sh.user_id && employees.has(sh.user_id)) {
      const e = employees.get(sh.user_id)!;
      const wk = isoWeekStart(sh.shift_date);
      const dur = sEnd - sStart;
      e.weeklyMin.set(wk, (e.weeklyMin.get(wk) ?? 0) + dur);
      e.totalAssignedMin += dur;
    }
  }
  logs.preserved_shifts = preservedShifts.length;

  // ─── PHASE 3 — Éligibilité par requirement ───────────────────────────────
  const t_p3 = Date.now();
  // candidatesFor(req) → liste d'employés éligibles aux filtres durs (hors dispo)
  const candidatesFor = (r: Requirement): Employee[] => {
    const out: Employee[] = [];
    for (const e of employees.values()) {
      // Studio
      if (e.studios.size > 0 && !e.studios.has(r.studio_id)) continue;
      // Rôle — pour un besoin hybride, l'employé doit avoir TOUS les rôles requis
      if (r.is_hybrid) {
        if (!r.required_roles.every((rr) => e.roles.has(rr))) continue;
      } else if (isKitchenRole(r.role)) {
        if (!Array.from(e.roles).some((er) => isKitchenRole(er))) continue;
      } else if (r.allowed_roles.length > 0) {
        if (!r.allowed_roles.some((ar) => e.roles.has(ar))) continue;
      } else {
        if (!e.roles.has(r.role)) continue;
      }
      // Contrat
      if (r.required_contract) {
        if (!e.contracts.has(r.required_contract)) continue;
      } else if (r.allowed_contracts.length > 0) {
        if (!r.allowed_contracts.some((ac) => e.contracts.has(ac as ContractType))) continue;
      }
      // Formation : pour un hybride, vérifier le blocage sur CHAQUE rôle requis
      const blocked = blockedRolesByUser.get(e.id);
      if (blocked) {
        if (r.is_hybrid) {
          if (r.required_roles.some((rr) => blocked.has(rr))) continue;
        } else {
          if (blocked.has(r.role)) continue;
        }
      }
      out.push(e);
    }
    return out;
  };

  // Pré-calcul des candidats par requirement (utilisé par toutes les passes)
  const reqCandidates = new Map<string, Employee[]>();
  let candidatesSum = 0;
  for (const r of requirements) {
    const cands = candidatesFor(r);
    reqCandidates.set(r.id, cands);
    candidatesSum += cands.length;
  }
  logs.phases.p3_ms = Date.now() - t_p3;
  logs.avg_candidates_per_slot = totalSlotsNeeded > 0 ? +(candidatesSum / totalSlotsNeeded).toFixed(2) : 0;

  // ─── PHASE 4 — Greedy 4-passes ───────────────────────────────────────────

  // Helpers de contrainte (inclut les pré-existants déjà comptés via weeklyMin)
  const minShiftMin = (s.min_shift_hours ?? 3) * 60;
  // Règle stricte : un shift ne peut jamais durer moins que min_shift_hours (par défaut 3h).
  const minAssignableMinFor = (_req: Requirement) => minShiftMin;
  const weeklyHours = (e: Employee, date: string) => (e.weeklyMin.get(isoWeekStart(date)) ?? 0) / 60;

  const maxShiftHFor = (e: Employee, _studioId: string): number => {
    const isCDI = e.contracts.has("CDI");
    const isStu = e.contracts.has("Étudiant");
    const isFlx = e.contracts.has("Flexi");
    if (isCDI) return s.max_shift_hours_cdi;
    if (isStu) return s.max_shift_hours_student;
    if (isFlx) return s.max_shift_hours_flexi;
    return s.max_shift_hours;
  };

  const maxWeeklyHFor = (e: Employee, _studioId: string): number => {
    return getWeeklyCapForUser(
      { allow_extended_hours: e.allow_extended_hours, weekly_hours_cap: e.weekly_hours_cap },
      e.contracts,
      s,
    ).cap;
  };

  // Conflit (chevauchement) : dans assigned[] + cellules pré-bloquées
  const hasConflict = (e: Employee, date: string, sMin: number, eMin: number): boolean => {
    for (const a of e.assigned) {
      if (a.date !== date) continue;
      if (a.startMin < eMin && a.endMin > sMin) return true;
    }
    return false;
  };

  // Repos 11h : aucun shift à <11h de la fenêtre [sMin, eMin] sur date
  const restOk = (e: Employee, date: string, sMin: number, eMin: number): boolean => {
    if (!s.enforce_rest_11h) return true;
    const startTs = new Date(`${date}T${m2t(sMin)}:00`).getTime();
    const endTs = new Date(`${date}T${m2t(eMin)}:00`).getTime();
    for (const a of e.assigned) {
      const aStart = new Date(`${a.date}T${m2t(a.startMin)}:00`).getTime();
      const aEnd = new Date(`${a.date}T${m2t(a.endMin)}:00`).getTime();
      // gap (en h) entre fin précédente et début nouveau
      if (aEnd <= startTs) {
        const gapH = (startTs - aEnd) / 3600000;
        if (gapH < 11) return false;
      } else if (endTs <= aStart) {
        const gapH = (aStart - endTs) / 3600000;
        if (gapH < 11) return false;
      }
    }
    return true;
  };

  // Vérifie qu'une plage est intégralement couverte par une dispo de l'employé
  const availCovers = (e: Employee, date: string, sMin: number, eMin: number, studioId: string): boolean => {
    for (const r of availOnFor(e.id, date, studioId)) if (r.startMin <= sMin && r.endMin >= eMin) return true;
    return false;
  };

  // Construit un vrai shift d'au moins min_shift_hours qui couvre le besoin.
  // Exemple : besoin Accueil 17h30-20h15 (2h45) → shift 17h15-20h15 si la dispo le permet.
  const buildAssignableWindow = (
    coverStart: number,
    coverEnd: number,
    availability: AvailRange,
    maxMin: number,
  ): { startMin: number; endMin: number } | null => {
    const coverLen = coverEnd - coverStart;
    if (coverLen <= 0) return null;
    const targetLen = Math.max(minShiftMin, coverLen);
    if (targetLen > maxMin) return null;

    const latestStart = Math.min(coverStart, availability.endMin - targetLen);
    const earliestStart = Math.max(availability.startMin, coverEnd - targetLen);
    if (latestStart < earliestStart) return null;

    const startMin = Math.max(earliestStart, latestStart);
    const endMin = startMin + targetLen;
    if (startMin > coverStart || endMin < coverEnd) return null;
    return { startMin, endMin };
  };

  // Trouve la plage de cellules contiguës non-attribuées d'un requirement contenant l'index i
  const contiguousFreeWindow = (req: Requirement, i: number): { startMin: number; endMin: number } | null => {
    if (req.cells[i].userId !== null || req.cells[i].blocked) return null;
    let lo = i, hi = i;
    while (lo > 0 && req.cells[lo - 1].userId === null && !req.cells[lo - 1].blocked) lo--;
    while (hi < req.cells.length - 1 && req.cells[hi + 1].userId === null && !req.cells[hi + 1].blocked) hi++;
    return { startMin: req.cells[lo].startMin, endMin: req.cells[hi].endMin };
  };

  // Applique l'assignation : coche les cellules + met à jour quotas
  const assign = (req: Requirement, e: Employee, sMin: number, eMin: number) => {
    for (const c of req.cells) {
      if (c.startMin >= sMin && c.endMin <= eMin) c.userId = e.id;
    }
    e.assigned.push({ date: req.date, startMin: sMin, endMin: eMin, studio_id: req.studio_id, role: req.role, reqId: req.id });
    const wk = isoWeekStart(req.date);
    e.weeklyMin.set(wk, (e.weeklyMin.get(wk) ?? 0) + (eMin - sMin));
    e.totalAssignedMin += (eMin - sMin);
  };

  // Annule une assignation précédente (utilisé par la Passe E swap-repair)
  const unassign = (req: Requirement, e: Employee, sMin: number, eMin: number) => {
    for (const c of req.cells) {
      if (c.startMin >= sMin && c.endMin <= eMin && c.userId === e.id) c.userId = null;
    }
    const idx = e.assigned.findIndex(
      (a) => a.reqId === req.id && a.date === req.date && a.startMin === sMin && a.endMin === eMin,
    );
    if (idx >= 0) e.assigned.splice(idx, 1);
    const wk = isoWeekStart(req.date);
    e.weeklyMin.set(wk, Math.max(0, (e.weeklyMin.get(wk) ?? 0) - (eMin - sMin)));
    e.totalAssignedMin = Math.max(0, e.totalAssignedMin - (eMin - sMin));
  };

  // Score d'un candidat pour un slot (système mérite, pondéré par ai_planning_settings)
  // - perf       : score / 10               (mérite)
  // - générosité : availMonthMin / max      (weight_preference : récompense ceux qui se rendent dispos)
  // - équité     : 1 - assignedSoFar / max  (ceux qui ont déjà beaucoup reçu redescendent)
  // Si la somme des poids = 0 (admin a tout mis à zéro) → fallback 50/20/30.
  const wRawPerf = s.weight_performance ?? 0;
  const wRawEq = s.weight_equity ?? 0;
  const wRawGen = s.weight_preference ?? 0;
  const wSum = wRawPerf + wRawEq + wRawGen;
  const wPerf = wSum > 0 ? wRawPerf / wSum : 0.5;
  const wEq = wSum > 0 ? wRawEq / wSum : 0.2;
  const wGen = wSum > 0 ? wRawGen / wSum : 0.3;
  const ranking = (cands: Employee[], _date: string): Employee[] => {
    if (cands.length === 0) return cands;
    const maxAvail = Math.max(0, ...cands.map((c) => c.availMonthMin));
    const maxAssigned = Math.max(0, ...cands.map((c) => c.totalAssignedMin));
    const priority = (e: Employee) => {
      const perf = Math.max(0, Math.min(1, e.score / 10));
      const gen = maxAvail > 0 ? e.availMonthMin / maxAvail : 0;
      const eq = maxAssigned > 0 ? 1 - (e.totalAssignedMin / maxAssigned) : 1;
      return wPerf * perf + wGen * gen + wEq * eq;
    };
    return [...cands].sort((a, b) => priority(b) - priority(a));
  };


  // ─── PASSE A0 : Pin CDI unique sur shifts required_contract='CDI' ────────
  // Si un requirement exige un CDI et qu'un seul CDI éligible existe → on lui
  // colle d'office le shift, peu importe ses dispos (cas typique : Sophie au
  // Barista matin 7h30-15h30). Les dispos servent à éviter les conflits inter-
  // shifts, pas à bloquer l'unique CDI sur son shift attitré.
  const t_pA0 = Date.now();
  for (const req of requirements) {
    if (req.required_contract !== "CDI") continue;
    if (req.cells.every((c) => c.userId !== null || c.blocked)) continue;
    const cdiCands = (reqCandidates.get(req.id) ?? []).filter((e) => e.contracts.has("CDI"));
    if (cdiCands.length !== 1) continue;
    const e = cdiCands[0];
    const sMin = req.startMin;
    const eMin = req.endMin;
    if (hasConflict(e, req.date, sMin, eMin)) continue;
    assign(req, e, sMin, eMin);
    if (!availCovers(e, req.date, sMin, eMin, req.studio_id)) {
      alerts.push({
        type: "cdi_pinned_no_avail",
        severity: "info",
        user_id: e.id,
        user_name: `${e.first_name} ${e.last_name}`,
        message: `${e.first_name} assignée d'office sur le shift CDI du ${req.date} ${m2t(sMin)}-${m2t(eMin)} (unique CDI éligible).`,
      });
    }
  }
  logs.phases.pA0_ms = Date.now() - t_pA0;

  // ─── PASSE A : CDI sur shifts longs ──────────────────────────────────────
  const t_pA = Date.now();
  const cdiList = Array.from(employees.values()).filter((e) => e.contracts.has("CDI"));
  cdiList.sort((a, b) => b.score - a.score);

  for (const e of cdiList) {
    // Pour chaque date, essayer de placer un long shift contigu sur ses dispos
    for (const date of eachDate(monthStart, monthEnd)) {
      const ranges = availOn(e.id, date);
      if (ranges.length === 0) continue;
      const wkH = weeklyHours(e, date);
      // budget restant pour la semaine (vise target ± tolerance, plafond max)
      const studioForLimits = Array.from(e.studios)[0] ?? "";
      const wkMax = maxWeeklyHFor(e, studioForLimits);
      // Plafond CDI : on autorise jusqu'au cap dur hebdo (relâché pour réduire
      // les trous). La cible target±tolérance reste utilisée comme garde-fou
      // ailleurs (alertes Passe D), mais Pass A peut grimper jusqu'au cap légal.
      const targetCap = wkMax;
      const remainingH = Math.max(0, targetCap - wkH);
      if (remainingH * 60 < minShiftMin) continue;

      // Pour chaque dispo (≥3h) → placer un shift maximal
      for (const range of ranges) {
        const dispoH = (range.endMin - range.startMin) / 60;
        if (dispoH * 60 < minShiftMin) continue;

        // Trouver le requirement (cells libres) qui chevauche cette dispo et que e couvre
        const fitReqs = requirements.filter((r) =>
          r.date === date &&
          matchStudio(range, r.studio_id) &&
          (reqCandidates.get(r.id) ?? []).some((c) => c.id === e.id) &&
          r.startMin < range.endMin && r.endMin > range.startMin,
        ).sort((a, b) => {
          if (a.is_hybrid !== b.is_hybrid) return a.is_hybrid ? -1 : 1;
          return 0;
        });
        if (fitReqs.length === 0) continue;

        for (const req of fitReqs) {
          if (req.cells.every((c) => c.userId !== null || c.blocked)) continue;
          // Fenêtre ciblée : intersection (dispo, req) ; on essaie de prendre la plus longue plage libre
          const lo = Math.max(req.startMin, range.startMin);
          const hi = Math.min(req.endMin, range.endMin);
          if (hi - lo < CELL_MIN) continue;

          // Trouver le plus long sous-segment libre dans [lo, hi)
          let bestS = -1, bestE = -1, bestLen = 0;
          let curS = -1;
          for (const c of req.cells) {
            if (c.startMin >= lo && c.endMin <= hi && !c.blocked && c.userId === null) {
              if (curS < 0) curS = c.startMin;
              const curE = c.endMin;
              if (curE - curS > bestLen) { bestLen = curE - curS; bestS = curS; bestE = curE; }
            } else {
              curS = -1;
            }
          }
          if (bestLen < minShiftMin) continue;

          // Cap sur max_shift_hours_cdi (sauf solo)
          const maxBlockMin = Math.min(bestLen, maxShiftHFor(e, req.studio_id) * 60, remainingH * 60);
          if (maxBlockMin < minShiftMin) continue;
          const sMin = bestS;
          const eMin = bestS + maxBlockMin;
          if (hasConflict(e, date, sMin, eMin)) continue;
          if (!restOk(e, date, sMin, eMin)) continue;
          assign(req, e, sMin, eMin);
        }
      }
    }
  }
  logs.phases.pA_ms = Date.now() - t_pA;

  // ─── PASSE B : Comblage Étudiants/Flexis ─────────────────────────────────
  const t_pB = Date.now();
  // Tri par rareté (scarcity-first) : on sert d'abord les requirements qui
  // ont peu de candidats réellement dispos. Sinon les shifts faciles à
  // pourvoir (matins) bouffent le cap hebdo des employés et les soirs
  // restent vides. Tie-breaker chronologique pour rester déterministe.
  const scarcityScore = new Map<string, number>();
  for (const r of requirements) {
    const cands = (reqCandidates.get(r.id) ?? []).filter(
      (c) => c.contracts.has("Étudiant") || c.contracts.has("Flexi") || c.contracts.has("CDI"),
    );
    let avail = 0;
    for (const c of cands) {
      const has = availOnFor(c.id, r.date, r.studio_id).some(
        (a) => a.startMin < r.endMin && a.endMin > r.startMin,
      );
      if (has) avail++;
    }
    scarcityScore.set(r.id, avail);
  }
  // Most-constrained-first : les besoins hybrides (polyvalents requis) passent
  // en priorité absolue, sinon la rareté classique décide.
  const sortedReqs = [...requirements].sort((a, b) => {
    if (a.is_hybrid !== b.is_hybrid) return a.is_hybrid ? -1 : 1;
    if (a.is_hybrid && b.is_hybrid) {
      const dr = b.required_roles.length - a.required_roles.length;
      if (dr !== 0) return dr;
    }
    const sa = scarcityScore.get(a.id) ?? 0;
    const sb = scarcityScore.get(b.id) ?? 0;
    if (sa !== sb) return sa - sb;
    return a.date.localeCompare(b.date) || a.startMin - b.startMin;
  });
  for (const req of sortedReqs) {
    for (let i = 0; i < req.cells.length; i++) {
      const cell = req.cells[i];
      if (cell.userId !== null || cell.blocked) continue;
      const window = contiguousFreeWindow(req, i);
      if (!window) continue;
      const cands = (reqCandidates.get(req.id) ?? []).filter(
        (c) => c.contracts.has("Étudiant") || c.contracts.has("Flexi") || c.contracts.has("CDI"),
      );
      if (cands.length === 0) continue;
      const ranked = ranking(cands, req.date);
      let placed = false;
      for (const e of ranked) {
        // Trouver une dispo couvrant au moins min_shift_hours dans window (filtrée par studio)
        const dispos = availOnFor(e.id, req.date, req.studio_id).filter(
          (r) => r.startMin < window.endMin && r.endMin > window.startMin,
        );
        if (dispos.length === 0) {
          if (s.strict_preferences) continue;
          // Pas strict : on autorise sans dispo (rare)
        }
        for (const d of dispos.length ? dispos : [{ startMin: window.startMin, endMin: window.endMin, studioId: null as string | null }]) {
          const lo = Math.max(window.startMin, d.startMin);
          const hi = Math.min(window.endMin, d.endMin);
          const maxH = maxShiftHFor(e, req.studio_id);
          // Plafond hebdo restant
          const wkRemainingH = Math.max(0, maxWeeklyHFor(e, req.studio_id) - weeklyHours(e, req.date));
          const maxAssignableMin = Math.min(maxH * 60, wkRemainingH * 60);
          const shiftWindow = buildAssignableWindow(lo, hi, d, maxAssignableMin);
          if (!shiftWindow) continue;
          const { startMin: sMin, endMin: eMin } = shiftWindow;
          const eMinAligned = Math.floor(eMin / CELL_MIN) * CELL_MIN;
          if (eMinAligned - sMin < minAssignableMinFor(req)) continue;
          if (eMinAligned < hi) continue;
          if (hasConflict(e, req.date, sMin, eMinAligned)) continue;
          if (!restOk(e, req.date, sMin, eMinAligned)) continue;
          assign(req, e, sMin, eMinAligned);
          placed = true;
          // Avance i au-delà des cellules nouvellement remplies
          while (i < req.cells.length - 1 && req.cells[i + 1].userId !== null) i++;
          break;
        }
        if (placed) break;
      }
    }
  }
  logs.phases.pB_ms = Date.now() - t_pB;

  // ─── PASSE C : Optimisation locale (extension de shifts adjacents) ───────
  const t_pC = Date.now();
  let optIters = 0;
  let improved = true;
  while (improved && optIters < MAX_OPT_ITERS) {
    improved = false;
    optIters++;
    for (const req of sortedReqs) {
      for (let i = 0; i < req.cells.length; i++) {
        const cell = req.cells[i];
        if (cell.userId !== null || cell.blocked) continue;
        // Vérifier voisin gauche
        if (i > 0 && req.cells[i - 1].userId) {
          const eId = req.cells[i - 1].userId!;
          const e = employees.get(eId);
          if (e && tryExtendRight(e, req, i, s, employees, hasConflict, restOk, availOn, maxShiftHFor, maxWeeklyHFor, weeklyHours)) {
            improved = true;
            continue;
          }
        }
        // Vérifier voisin droit
        if (i < req.cells.length - 1 && req.cells[i + 1].userId) {
          const eId = req.cells[i + 1].userId!;
          const e = employees.get(eId);
          if (e && tryExtendLeft(e, req, i, s, employees, hasConflict, restOk, availOn, maxShiftHFor, maxWeeklyHFor, weeklyHours)) {
            improved = true;
            continue;
          }
        }
      }
    }
  }
  logs.phases.pC_ms = Date.now() - t_pC;
  logs.optimization_iterations = optIters;

  // ─── PASSE E : Réparation par échange (swap repair) ──────────────────────
  // Pour chaque trou restant, on cherche un employé éligible mais déjà placé
  // ailleurs. Si l'autre shift de cet employé peut être pris par quelqu'un
  // d'autre (sans casser les règles), on échange : ça transforme deux shifts
  // pourvus + un trou en deux shifts pourvus + un trou en moins.
  // C'est exactement la réflexion d'un humain qui fait son planning à la main.
  const t_pE = Date.now();
  let swapCount = 0;
  const MAX_SWAPS = 200;

  const findAvailRangeCovering = (e: Employee, date: string, sMin: number, eMin: number): AvailRange | null => {
    for (const r of availOn(e.id, date)) {
      if (r.startMin <= sMin && r.endMin >= eMin) return r;
    }
    return null;
  };

  // Helper : tente de placer e sur req dans la fenêtre [coverStart,coverEnd]
  // en respectant min_shift et toutes les règles. Retourne la fenêtre choisie.
  const tryPlace = (
    e: Employee,
    req: Requirement,
    coverStart: number,
    coverEnd: number,
    ignoreConflictReqId?: string,
  ): { startMin: number; endMin: number } | null => {
    const avail = findAvailRangeCovering(e, req.date, coverStart, coverEnd);
    if (!avail) return null;
    const maxH = maxShiftHFor(e, req.studio_id);
    const wkRemainingH = Math.max(0, maxWeeklyHFor(e, req.studio_id) - weeklyHours(e, req.date));
    const maxMin = Math.min(maxH * 60, wkRemainingH * 60);
    const w = buildAssignableWindow(coverStart, coverEnd, avail, maxMin);
    if (!w) return null;
    // Conflit (en ignorant éventuellement un shift qu'on vient de retirer)
    for (const a of e.assigned) {
      if (a.date !== req.date) continue;
      if (ignoreConflictReqId && a.reqId === ignoreConflictReqId) continue;
      if (a.startMin < w.endMin && a.endMin > w.startMin) return null;
    }
    if (!restOk(e, req.date, w.startMin, w.endMin)) return null;
    return w;
  };

  outer: for (let pass = 0; pass < 3; pass++) {
    let madeChange = false;
    for (const req of sortedReqs) {
      for (let i = 0; i < req.cells.length; i++) {
        if (req.cells[i].userId !== null || req.cells[i].blocked) continue;
        const window = contiguousFreeWindow(req, i);
        if (!window) continue;
        const cands = ranking(reqCandidates.get(req.id) ?? [], req.date);
        for (const c of cands) {
          // 1) Tentative directe (peut-être qu'un slot s'est libéré ailleurs)
          const direct = tryPlace(c, req, window.startMin, window.endMin);
          if (direct) {
            assign(req, c, direct.startMin, direct.endMin);
            madeChange = true;
            swapCount++;
            break;
          }
          // 2) Tentative de swap : c est occupé sur un shift A qui chevauche
          const conflicts = c.assigned.filter(
            (a) => a.date === req.date && a.startMin < window.endMin && a.endMin > window.startMin,
          );
          if (conflicts.length !== 1) continue; // on ne gère que les conflits simples
          const conflictA = conflicts[0];
          const reqA = requirements.find((r) => r.id === conflictA.reqId);
          if (!reqA) continue;
          // Chercher un remplaçant C2 capable de prendre EXACTEMENT le shift A
          const c2Cands = ranking(
            (reqCandidates.get(reqA.id) ?? []).filter((x) => x.id !== c.id),
            reqA.date,
          );
          let swapped = false;
          for (const c2 of c2Cands) {
            // 2a) C2 peut prendre A directement → swap simple (chaîne longueur 2)
            const place2 = tryPlace(c2, reqA, conflictA.startMin, conflictA.endMin);
            if (place2) {
              unassign(reqA, c, conflictA.startMin, conflictA.endMin);
              const placeC = tryPlace(c, req, window.startMin, window.endMin, reqA.id);
              if (!placeC) {
                assign(reqA, c, conflictA.startMin, conflictA.endMin);
                continue;
              }
              assign(reqA, c2, place2.startMin, place2.endMin);
              assign(req, c, placeC.startMin, placeC.endMin);
              swapped = true;
              madeChange = true;
              swapCount++;
              break;
            }
            // 2b) C2 est occupé sur un shift B qui chevauche A → chaîne à 3
            const conflictsB = c2.assigned.filter(
              (a) => a.date === reqA.date &&
                     a.startMin < conflictA.endMin && a.endMin > conflictA.startMin,
            );
            if (conflictsB.length !== 1) continue;
            const conflictB = conflictsB[0];
            const reqB = requirements.find((r) => r.id === conflictB.reqId);
            if (!reqB || reqB.id === reqA.id) continue;
            // Chercher C3 capable de prendre B exactement
            const c3Cands = ranking(
              (reqCandidates.get(reqB.id) ?? []).filter((x) => x.id !== c.id && x.id !== c2.id),
              reqB.date,
            );
            for (const c3 of c3Cands) {
              const place3 = tryPlace(c3, reqB, conflictB.startMin, conflictB.endMin);
              if (!place3) continue;
              // Tester la chaîne : retirer C de A puis C2 de B
              unassign(reqA, c, conflictA.startMin, conflictA.endMin);
              unassign(reqB, c2, conflictB.startMin, conflictB.endMin);
              const place2chain = tryPlace(c2, reqA, conflictA.startMin, conflictA.endMin, reqB.id);
              const placeCchain = place2chain
                ? tryPlace(c, req, window.startMin, window.endMin, reqA.id)
                : null;
              if (!place2chain || !placeCchain) {
                // Rollback complet
                assign(reqB, c2, conflictB.startMin, conflictB.endMin);
                assign(reqA, c, conflictA.startMin, conflictA.endMin);
                continue;
              }
              // Appliquer la chaîne C3→B, C2→A, C→trou
              assign(reqB, c3, place3.startMin, place3.endMin);
              assign(reqA, c2, place2chain.startMin, place2chain.endMin);
              assign(req, c, placeCchain.startMin, placeCchain.endMin);
              swapped = true;
              madeChange = true;
              swapCount++;
              break;
            }
            if (swapped) break;
          }
          if (swapped) break;
        }
      }
    }
    if (!madeChange) break outer;
  }
  logs.phases.pE_ms = Date.now() - t_pE;
  logs.swap_repairs = swapCount;


  // ─── PASSE D : Ajustement CDI vers target ± tolérance ────────────────────
  const t_pD = Date.now();
  for (const e of cdiList) {
    // Pour chaque semaine couverte par la période
    const weeks = new Set<string>();
    for (const date of eachDate(monthStart, monthEnd)) weeks.add(isoWeekStart(date));
    for (const wk of weeks) {
      const wkH = (e.weeklyMin.get(wk) ?? 0) / 60;
      const studioForLimits = Array.from(e.studios)[0] ?? "";
      const target = s.target_weekly_cdi_hours;
      const tol = s.cdi_hours_tolerance;
      if (wkH >= target - tol && wkH <= target + tol) continue;

      if (wkH < target - tol) {
        // Sous-target : tenter d'étendre un shift existant cette semaine
        // (déjà couvert partiellement par Passe C — ici on alerte si toujours en dessous)
        if (wkH < target - tol) {
          alerts.push({
            type: "cdi_hours",
            severity: "warning",
            user_id: e.id,
            user_name: `${e.first_name} ${e.last_name}`,
            message: `CDI à ${wkH.toFixed(1)}h sur la semaine du ${wk} (cible ${target}h ± ${tol}h)`,
          });
        }
      } else if (wkH > target + tol) {
        // Sur-target : raccourcir un shift non critique (le plus court d'abord)
        const shifts = e.assigned.filter((a) => isoWeekStart(a.date) === wk).sort((a, b) => (a.endMin - a.startMin) - (b.endMin - b.startMin));
        for (const sh of shifts) {
          const excessH = wkH - target;
          if (excessH <= 0) break;
          const shiftH = (sh.endMin - sh.startMin) / 60;
          if (shiftH <= s.min_shift_hours) continue; // ne pas casser sous min
          // On laisse l'alerte plutôt que de retirer (éviter de créer un trou)
          alerts.push({
            type: "cdi_hours",
            severity: "info",
            user_id: e.id,
            user_name: `${e.first_name} ${e.last_name}`,
            message: `CDI à ${wkH.toFixed(1)}h cette semaine (au-dessus de la cible ${target}h)`,
          });
          break;
        }
      }
    }
  }
  logs.phases.pD_ms = Date.now() - t_pD;

  // ─── PHASE 5 — Validation + écriture ─────────────────────────────────────
  const t_p5 = Date.now();

  // Reconstruire les "shifts finaux" à partir des cellules
  const finalShifts: Array<{
    user_id: string | null; studio_id: string; business_role: string;
    shift_date: string; start_time: string; end_time: string;
    status: string; is_locked: boolean; is_manual: boolean;
    created_by_run_id: string;
    role_segments: RoleSegment[] | null;
  }> = [];
  for (const req of requirements) {
    let i = 0;
    while (i < req.cells.length) {
      const c = req.cells[i];
      if (c.blocked) { i++; continue; }

      if (c.userId === null) {
        // Trou matérialisé : shift vide (user_id = null) pour /trous
        let j = i;
        while (j < req.cells.length - 1 &&
               req.cells[j + 1].userId === null &&
               !req.cells[j + 1].blocked &&
               req.cells[j + 1].startMin === req.cells[j].endMin) j++;
        // Préserver role_segments uniquement si le trou couvre l'intégralité du besoin
        const holeFull = req.cells[i].startMin === req.startMin && req.cells[j].endMin === req.endMin;
        finalShifts.push({
          user_id: null,
          studio_id: req.studio_id,
          business_role: req.role,
          shift_date: req.date,
          start_time: `${m2t(req.cells[i].startMin)}:00`,
          end_time: `${m2t(req.cells[j].endMin)}:00`,
          status: "open",
          is_locked: false,
          is_manual: false,
          created_by_run_id: ctx.runId,
          role_segments: req.is_hybrid && holeFull ? req.role_segments : null,
        });
        i = j + 1;
        continue;
      }

      const uid = c.userId;
      let j = i;
      while (j < req.cells.length - 1 &&
             req.cells[j + 1].userId === uid &&
             !req.cells[j + 1].blocked &&
             req.cells[j + 1].startMin === req.cells[j].endMin) j++;
      const assignedEmployee = uid ? employees.get(uid) : null;
      const assignedWindow = assignedEmployee?.assigned.find((a) =>
        a.reqId === req.id &&
        a.startMin <= req.cells[i].startMin &&
        a.endMin >= req.cells[j].endMin,
      );
      const finalStart = assignedWindow?.startMin ?? req.cells[i].startMin;
      const finalEnd = assignedWindow?.endMin ?? req.cells[j].endMin;
      // Préserver role_segments uniquement si le shift final couvre exactement le besoin hybride
      const segmentsForShift = req.is_hybrid && finalStart === req.startMin && finalEnd === req.endMin
        ? req.role_segments
        : null;
      finalShifts.push({
        user_id: uid,
        studio_id: req.studio_id,
        business_role: req.role,
        shift_date: req.date,
        start_time: `${m2t(finalStart)}:00`,
        end_time: `${m2t(finalEnd)}:00`,
        status: "scheduled",
        is_locked: false,
        is_manual: false,
        created_by_run_id: ctx.runId,
        role_segments: segmentsForShift,
      });
      i = j + 1;
    }
  }

  // ─── PASS F — Fusion des résidus dans le shift voisin ──────────────────
  // Tout shift "open" plus court que min_shift_hours est par essence non pourvu
  // (aucun employé ne prendra 15 min isolées). On tente d'étendre un shift
  // assigné adjacent (même date / rôle / studio) pour absorber le résidu,
  // si la dispo de l'employé + ses caps le permettent.
  for (let k = finalShifts.length - 1; k >= 0; k--) {
    const open = finalShifts[k];
    if (open.user_id !== null || open.status !== "open") continue;
    const oStart = t2m(open.start_time);
    const oEnd = t2m(open.end_time);
    const oDur = oEnd - oStart;
    if (oDur >= minShiftMin) continue; // vrai trou actionnable, on garde

    let absorbed = false;
    for (let m = 0; m < finalShifts.length; m++) {
      if (m === k) continue;
      const adj = finalShifts[m];
      if (!adj.user_id) continue;
      if (adj.shift_date !== open.shift_date) continue;
      if (adj.business_role !== open.business_role) continue;
      if (adj.studio_id !== open.studio_id) continue;
      // Ne pas fusionner si l'un des deux est hybride (role_segments deviendrait invalide)
      if (adj.role_segments || open.role_segments) continue;
      const aStart = t2m(adj.start_time);
      const aEnd = t2m(adj.end_time);
      const before = aEnd === oStart;
      const after = aStart === oEnd;
      if (!before && !after) continue;

      const newStart = before ? aStart : oStart;
      const newEnd = before ? oEnd : aEnd;
      const newDur = newEnd - newStart;
      const emp = employees.get(adj.user_id);
      if (!emp) continue;
      if (newDur > maxShiftHFor(emp, adj.studio_id) * 60) continue;
      if (!availCovers(emp, adj.shift_date, newStart, newEnd, adj.studio_id)) continue;
      const addedH = (newDur - (aEnd - aStart)) / 60;
      if (weeklyHours(emp, adj.shift_date) + addedH > maxWeeklyHFor(emp, adj.studio_id)) continue;

      adj.start_time = `${m2t(newStart)}:00`;
      adj.end_time = `${m2t(newEnd)}:00`;
      finalShifts.splice(k, 1);
      absorbed = true;
      break;
    }
    if (!absorbed) finalShifts.splice(k, 1); // impossible à pourvoir
  }




  // Validation : pas de shift < min, sauf si le besoin lui-même est plus court
  // (ex: Accueil PM 2h45 ou Barista 13h30-15h). Ces shifts sont voulus.
  const validation: string[] = [];
  const knownRoleNames = (businessRolesRows ?? []).map((r: any) => r.name);
  for (const sh of finalShifts) {
    const dur = t2m(sh.end_time) - t2m(sh.start_time);
    if (dur < minShiftMin) {
      validation.push(`Shift < min: ${sh.user_id} ${sh.shift_date} ${sh.start_time}-${sh.end_time}`);
    }
    if (sh.role_segments) {
      const v = validateRoleSegments(sh.role_segments, sh.start_time.slice(0, 5), sh.end_time.slice(0, 5), knownRoleNames);
      if (!v.ok) {
        validation.push(`role_segments invalides ${sh.shift_date} ${sh.start_time}: ${v.errors.join("; ")}`);
        sh.role_segments = null; // safety net : on tombe sur mono-rôle plutôt que de crasher l'insert
      } else if (sh.user_id) {
        const emp = employees.get(sh.user_id);
        const required = getRequiredRoles(sh.role_segments, sh.business_role);
        if (emp && !required.every((rr) => emp.roles.has(rr))) {
          validation.push(`Employé ${emp.first_name} ${emp.last_name} sans tous les rôles requis pour shift hybride ${sh.shift_date}`);
        }
      }
    }
  }

  // Trous = besoins non couverts (cellule par cellule, agrégées par requirement)
  const holes: Array<{
    studio_id: string; studio_name: string; date: string;
    start_time: string; end_time: string; business_role: string; reason: string;
  }> = [];
  const holeReasons = new Map<string, number>();
  for (const req of requirements) {
    let i = 0;
    while (i < req.cells.length) {
      if (req.cells[i].userId !== null || req.cells[i].blocked) { i++; continue; }
      let j = i;
      while (j < req.cells.length - 1 && req.cells[j + 1].userId === null && !req.cells[j + 1].blocked) j++;
      const reason = diagnoseReason(req, reqCandidates.get(req.id) ?? [], availOn);
      holes.push({
        studio_id: req.studio_id,
        studio_name: studioName.get(req.studio_id) ?? "—",
        date: req.date,
        start_time: m2t(req.cells[i].startMin),
        end_time: m2t(req.cells[j].endMin),
        business_role: req.role,
        reason,
      });
      holeReasons.set(reason, (holeReasons.get(reason) ?? 0) + 1);
      i = j + 1;
    }
  }

  // Écriture (sauf dry_run)
  let inserted = 0;
  if (!dryRun) {
    // Supprimer les shifts générés précédemment sur la même période/studios
    // (garde manuels ET lockés, peu importe les flags d'input — la sécu vit ici)
    const { error: delErr } = await supabase.from("shifts").delete()
      .gte("shift_date", monthStart).lte("shift_date", monthEnd)
      .in("studio_id", studioIds)
      .eq("is_manual", false).eq("is_locked", false);
    if (delErr) throw new Error(`Erreur suppression : ${delErr.message}`);

    // Batch insert
    const BATCH = 500;
    for (let k = 0; k < finalShifts.length; k += BATCH) {
      const slice = finalShifts.slice(k, k + BATCH);
      const { error } = await supabase.from("shifts").insert(slice);
      if (error) throw new Error(`Erreur insertion : ${error.message}`);
      inserted += slice.length;
    }
  }
  logs.phases.p5_ms = Date.now() - t_p5;

  // Distribution durées
  const durations = finalShifts.map((sh) => (t2m(sh.end_time) - t2m(sh.start_time)) / 60);
  const distrib: Record<string, number> = {};
  for (const d of durations) {
    const bucket = `${d.toFixed(1)}h`;
    distrib[bucket] = (distrib[bucket] ?? 0) + 1;
  }
  // Heures par employé (pour debug équité)
  const hoursByEmployee: Array<{ id: string; name: string; hours: number; contract: string }> = [];
  for (const e of employees.values()) {
    if (e.totalAssignedMin > 0) {
      hoursByEmployee.push({
        id: e.id,
        name: `${e.first_name} ${e.last_name}`,
        hours: +(e.totalAssignedMin / 60).toFixed(1),
        contract: Array.from(e.contracts).join(","),
      });
    }
  }
  hoursByEmployee.sort((a, b) => b.hours - a.hours);

  const top5HoleReasons = Array.from(holeReasons.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([reason, count]) => ({ reason, count }));

  const totalSlotsCovered = totalSlotsNeeded - holes.length;
  const coverage = totalCells > 0
    ? requirements.reduce((a, r) => a + r.cells.filter((c) => c.userId !== null || c.blocked).length, 0) / totalCells
    : 1;

  const status: "success" | "partial" | "failed" =
    coverage >= 0.95 ? "success" : coverage >= 0.5 ? "partial" : "failed";

  logs.duration_distribution = distrib;
  logs.top_hole_reasons = top5HoleReasons;
  logs.hours_by_employee = hoursByEmployee.slice(0, 100);
  logs.validation_warnings = validation;
  logs.dry_run = dryRun;

  return {
    status,
    coverage_rate: +coverage.toFixed(4),
    shifts_generated: finalShifts.filter((sh) => sh.user_id !== null).length,
    total_slots_needed: totalSlotsNeeded,
    total_slots_covered: totalSlotsCovered,
    holes,
    alerts,
    solver_logs: logs,
  };
}

// ─── Helpers de la passe C (factorisés pour lisibilité) ─────────────────────
function tryExtendRight(
  e: Employee, req: Requirement, i: number, s: Settings,
  _employees: Map<string, Employee>,
  hasConflict: (e: Employee, date: string, sMin: number, eMin: number) => boolean,
  restOk: (e: Employee, date: string, sMin: number, eMin: number) => boolean,
  availOn: (uid: string, date: string) => AvailRange[],
  maxShiftHFor: (e: Employee, sId: string) => number,
  maxWeeklyHFor: (e: Employee, sId: string) => number,
  weeklyHours: (e: Employee, date: string) => number,
): boolean {
  const cell = req.cells[i];
  // Cherche le shift à étendre (last assigned for this user on this req)
  const a = [...e.assigned].reverse().find((x) => x.reqId === req.id && x.endMin === cell.startMin);
  if (!a) return false;
  const newEnd = cell.endMin;
  const newDurH = (newEnd - a.startMin) / 60;
  if (newDurH > maxShiftHFor(e, req.studio_id)) return false;
  const wkRemainingH = maxWeeklyHFor(e, req.studio_id) - weeklyHours(e, req.date);
  if ((newEnd - a.endMin) / 60 > wkRemainingH) return false;
  // dispo
  if (!availOn(e.id, req.date).some((r) => r.startMin <= a.startMin && r.endMin >= newEnd)) return false;
  if (hasConflict(e, req.date, a.endMin, newEnd)) return false;
  if (!restOk(e, req.date, a.endMin, newEnd)) return false;
  cell.userId = e.id;
  a.endMin = newEnd;
  e.weeklyMin.set(isoWeekStart(req.date), (e.weeklyMin.get(isoWeekStart(req.date)) ?? 0) + (newEnd - cell.startMin));
  e.totalAssignedMin += (newEnd - cell.startMin);
  return true;
}

function tryExtendLeft(
  e: Employee, req: Requirement, i: number, s: Settings,
  _employees: Map<string, Employee>,
  hasConflict: (e: Employee, date: string, sMin: number, eMin: number) => boolean,
  restOk: (e: Employee, date: string, sMin: number, eMin: number) => boolean,
  availOn: (uid: string, date: string) => AvailRange[],
  maxShiftHFor: (e: Employee, sId: string) => number,
  maxWeeklyHFor: (e: Employee, sId: string) => number,
  weeklyHours: (e: Employee, date: string) => number,
): boolean {
  const cell = req.cells[i];
  const a = e.assigned.find((x) => x.reqId === req.id && x.startMin === cell.endMin);
  if (!a) return false;
  const newStart = cell.startMin;
  const newDurH = (a.endMin - newStart) / 60;
  if (newDurH > maxShiftHFor(e, req.studio_id)) return false;
  const wkRemainingH = maxWeeklyHFor(e, req.studio_id) - weeklyHours(e, req.date);
  if ((a.startMin - newStart) / 60 > wkRemainingH) return false;
  if (!availOn(e.id, req.date).some((r) => r.startMin <= newStart && r.endMin >= a.endMin)) return false;
  if (hasConflict(e, req.date, newStart, a.startMin)) return false;
  if (!restOk(e, req.date, newStart, a.endMin)) return false;
  cell.userId = e.id;
  a.startMin = newStart;
  e.weeklyMin.set(isoWeekStart(req.date), (e.weeklyMin.get(isoWeekStart(req.date)) ?? 0) + (cell.endMin - newStart));
  e.totalAssignedMin += (cell.endMin - newStart);
  return true;
}

// ─── Diagnose pourquoi un slot reste non couvert ─────────────────────────────
function diagnoseReason(
  req: Requirement,
  cands: Employee[],
  availOn: (uid: string, date: string) => AvailRange[],
): string {
  if (cands.length === 0) {
    if (req.is_hybrid) {
      return `Aucun candidat polyvalent (rôles requis : ${req.required_roles.join(" + ")})`;
    }
    return "Aucun employé qualifié (rôle/contrat/studio)";
  }
  const withAvail = cands.filter((c) => availOn(c.id, req.date).length > 0);
  if (withAvail.length === 0) return "Aucun candidat n'a déclaré de disponibilité ce jour";
  const overlapping = withAvail.filter((c) =>
    availOn(c.id, req.date).some((r) => r.startMin < req.endMin && r.endMin > req.startMin),
  );
  if (overlapping.length === 0) return "Dispos déclarées hors créneau";
  return "Tous les candidats déjà saturés (quota hebdo, conflits ou repos 11h)";
}

// ─── Parsing settings avec fallbacks ────────────────────────────────────────
function parseSettings(row: any): Settings {
  return {
    weight_performance: row?.weight_performance ?? 40,
    weight_equity: row?.weight_equity ?? 30,
    weight_preference: row?.weight_preference ?? 20,
    weight_random: row?.weight_random ?? 10,
    enforce_rest_11h: row?.enforce_rest_11h ?? true,
    enforce_max_weekly_cdi: row?.enforce_max_weekly_cdi ?? true,
    enforce_student_quota: row?.enforce_student_quota ?? true,
    strict_preferences: row?.strict_preferences ?? false,
    min_shift_hours: row?.min_shift_hours ?? 3,
    max_shift_hours: row?.max_shift_hours ?? 6,
    max_shift_hours_cdi: row?.max_shift_hours_cdi ?? 8,
    max_shift_hours_student: row?.max_shift_hours_student ?? 6,
    max_shift_hours_flexi: row?.max_shift_hours_flexi ?? 6,
    max_weekly_cdi_hours: row?.max_weekly_cdi_hours ?? 48,
    max_weekly_student_hours: row?.max_weekly_student_hours ?? 15,
    max_weekly_flexi_hours: row?.max_weekly_flexi_hours ?? 20,
    target_weekly_cdi_hours: row?.target_weekly_cdi_hours ?? 35,
    cdi_hours_tolerance: row?.cdi_hours_tolerance ?? 2,
    default_score_when_null: row?.default_score_when_null ?? 7.0,
  };
}
