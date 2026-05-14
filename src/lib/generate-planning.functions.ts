import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fetchAll } from "@/lib/supabase-paginate";

// ─── Types ────────────────────────────────────────────────────────────
type BusinessRole = string;
type ContractType = "Étudiant" | "Flexi" | "CDI" | null;

interface TemplateRow {
  id: string;
  studio_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  business_role: BusinessRole;
  required_count: number;
  is_optional: boolean;
  required_contract: ContractType;
  allowed_contracts: string[] | null;
  allowed_roles: string[] | null;
}

interface Settings {
  weight_performance: number;
  weight_equity: number;
  weight_preference: number;
  weight_random: number;
  enforce_rest_11h: boolean;
  strict_preferences: boolean;
  enforce_max_weekly_cdi: boolean;
  enforce_student_quota: boolean;
  min_shift_hours: number;
  max_shift_hours: number;
  max_weekly_cdi_hours: number;
  max_weekly_student_hours: number;
  max_weekly_flexi_hours: number;
}

interface Candidate {
  id: string;
  first_name: string;
  last_name: string;
  score: number | null;
  contract: ContractType;
  quota_max: number | null;
  quota_used: number | null;
  studio_ids: Set<string>;
  roles: Set<BusinessRole>;
  contracts: Set<string>; // user_contracts (un employé peut cumuler)
  assigned_count: number;
}
const SLOT_GRANULARITY_MIN = 30;

// ─── Helpers temps ────────────────────────────────────────────────────
const t2m = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const m2t = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const isoWeekStart = (dateStr: string): string => {
  const d = new Date(`${dateStr}T00:00:00`);
  const dow = d.getDay();
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
  return d.toISOString().slice(0, 10);
};

// ─── Input ────────────────────────────────────────────────────────────
const GenerateInput = z
  .object({
    year: z.number().int().min(2024).max(2100).optional(),
    month: z.number().int().min(0).max(11).optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    replaceExisting: z.boolean().default(true),
  })
  .refine(
    (v) =>
      (v.year !== undefined && v.month !== undefined) ||
      (v.startDate && v.endDate),
    { message: "Fournis (year+month) ou (startDate+endDate)" },
  );

// ─── Server function ──────────────────────────────────────────────────
export const generatePlanning = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => GenerateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { replaceExisting } = data;

    // — Vérifier admin
    const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    if (!roleRows?.some((r: any) => r.role === "admin")) {
      throw new Error("Seuls les admins peuvent générer un planning");
    }

    // — Réglages
    const { data: settingsRows } = await supabase
      .from("ai_planning_settings").select("*")
      .order("updated_at", { ascending: false }).limit(1);
    const s: Settings = (settingsRows?.[0] as any) ?? {
      weight_performance: 40, weight_equity: 30, weight_preference: 20, weight_random: 10,
      enforce_rest_11h: true, strict_preferences: false,
      enforce_max_weekly_cdi: true, enforce_student_quota: true,
      min_shift_hours: 3, max_shift_hours: 6,
      max_weekly_cdi_hours: 48, max_weekly_student_hours: 15, max_weekly_flexi_hours: 20,
    };
    s.max_weekly_cdi_hours = s.max_weekly_cdi_hours ?? 48;
    s.max_weekly_student_hours = s.max_weekly_student_hours ?? 15;
    s.max_weekly_flexi_hours = s.max_weekly_flexi_hours ?? 20;
    const minMin = Math.max(60, (s.min_shift_hours ?? 3) * 60);
    const maxMin = Math.max(minMin, (s.max_shift_hours ?? 6) * 60);

    // — Templates
    const { data: templates } = await supabase.from("staffing_templates").select("*");
    const tpls = (templates ?? []) as TemplateRow[];
    if (tpls.length === 0) {
      return {
        ok: false,
        error: "Aucun template de besoins défini. Configurez les besoins dans Réglages > Algorithme IA.",
        created: 0, holes: 0, totalRequired: 0, candidatesPool: 0,
        kpis: { coverage: 0, equity: 0, fairness: 0 }, unfilled: [], alerts: [],
      };
    }

    // — Candidats
    const [profiles, ubr, us, uc] = await Promise.all([
      fetchAll<any>(supabase.from("profiles")
        .select("id, first_name, last_name, score, contract, quota_max, quota_used")
        .eq("status", "active")),
      fetchAll<any>(supabase.from("user_business_roles").select("user_id, role")),
      fetchAll<any>(supabase.from("user_studios").select("user_id, studio_id")),
      fetchAll<any>(supabase.from("user_contracts").select("user_id, contract")),
    ]);

    const candidates = new Map<string, Candidate>();
    for (const p of profiles) {
      candidates.set(p.id, {
        id: p.id,
        first_name: p.first_name ?? "", last_name: p.last_name ?? "",
        score: p.score ?? null, contract: (p.contract ?? null) as ContractType,
        quota_max: p.quota_max ?? null, quota_used: p.quota_used ?? null,
        studio_ids: new Set(), roles: new Set(), contracts: new Set(),
        assigned_count: 0,
      });
    }
    for (const r of ubr) { const c = candidates.get(r.user_id); if (c) c.roles.add(r.role); }
    for (const r of us)  { const c = candidates.get(r.user_id); if (c) c.studio_ids.add(r.studio_id); }
    for (const r of uc)  { const c = candidates.get(r.user_id); if (c) c.contracts.add(r.contract); }
    // Le contract du profil compte aussi
    for (const c of candidates.values()) if (c.contract) c.contracts.add(c.contract);

    // — Période
    let firstDay: string, lastDay: string;
    if (data.startDate && data.endDate) {
      firstDay = data.startDate; lastDay = data.endDate;
      if (firstDay > lastDay) throw new Error("startDate doit être <= endDate");
    } else {
      const y = data.year as number, m = data.month as number;
      const ld = new Date(y, m + 1, 0);
      firstDay = `${y}-${String(m + 1).padStart(2, "0")}-01`;
      lastDay = `${y}-${String(m + 1).padStart(2, "0")}-${String(ld.getDate()).padStart(2, "0")}`;
    }

    if (replaceExisting) {
      await supabase.from("shifts").delete()
        .gte("shift_date", firstDay).lte("shift_date", lastDay)
        .eq("is_locked", false).eq("is_manual", false);
    }

    // — Existing
    const existing = await fetchAll<any>(
      supabase.from("shifts")
        .select("user_id, shift_date, start_time, end_time, studio_id, business_role")
        .gte("shift_date", firstDay).lte("shift_date", lastDay)
    );

    // — Disponibilités (plages réelles)
    const avails = await fetchAll<any>(
      supabase.from("availabilities")
        .select("user_id, avail_date, start_time, end_time")
        .gte("avail_date", firstDay).lte("avail_date", lastDay)
    );
    // Map<userId, Map<date, [{startMin, endMin}]>>
    const availMap = new Map<string, Map<string, { s: number; e: number }[]>>();
    for (const a of avails) {
      let byDate = availMap.get(a.user_id);
      if (!byDate) { byDate = new Map(); availMap.set(a.user_id, byDate); }
      const arr = byDate.get(a.avail_date) ?? [];
      arr.push({ s: t2m(String(a.start_time).slice(0, 5)), e: t2m(String(a.end_time).slice(0, 5)) });
      byDate.set(a.avail_date, arr);
    }
    const candidateAvail = (uid: string, date: string) => availMap.get(uid)?.get(date) ?? [];
    const hasAnyAvail = (uid: string) => (availMap.get(uid)?.size ?? 0) > 0;

    // ─── 1. BESOINS ATOMIQUES ───────────────────────────────────────
    interface Need {
      date: string;
      studio_id: string;
      role: BusinessRole;
      contract: ContractType;
      allowed_contracts: string[];
      allowed_roles: string[];
      is_optional: boolean;
      startMin: number;
      endMin: number;
      slotIndex: number; // pour required_count > 1
    }
    const needs: Need[] = [];
    const studioNames = new Map<string, string>();
    const { data: studiosData } = await supabase.from("studios").select("id, name");
    for (const st of studiosData ?? []) studioNames.set(st.id, st.name);

    const startD = new Date(`${firstDay}T00:00:00`);
    const endD = new Date(`${lastDay}T00:00:00`);
    for (let cur = new Date(startD); cur <= endD; cur.setDate(cur.getDate() + 1)) {
      const dow = (cur.getDay() + 6) % 7;
      const dateStr = cur.toISOString().slice(0, 10);
      for (const t of tpls.filter((x) => x.day_of_week === dow)) {
        for (let k = 0; k < t.required_count; k++) {
          needs.push({
            date: dateStr, studio_id: t.studio_id, role: t.business_role,
            contract: t.required_contract, is_optional: t.is_optional,
            allowed_contracts: t.allowed_contracts ?? [],
            allowed_roles: t.allowed_roles ?? [],
            startMin: t2m(t.start_time.slice(0, 5)), endMin: t2m(t.end_time.slice(0, 5)),
            slotIndex: k,
          });
        }
      }
    }

    // ─── 2. POOL ÉLIGIBLE PAR BESOIN (filtres durs sans dispo) ──────
    const eligibleFor = (n: Need): Candidate[] =>
      Array.from(candidates.values()).filter((c) => {
        // Rôle : si allowed_roles défini, l'employé doit savoir au moins l'un d'eux
        if (n.allowed_roles.length > 0) {
          if (!n.allowed_roles.some((r) => c.roles.has(r))) return false;
        } else {
          if (!c.roles.has(n.role)) return false;
        }
        if (c.studio_ids.size > 0 && !c.studio_ids.has(n.studio_id)) return false;
        // Contrat : si allowed_contracts défini, l'employé doit avoir au moins l'un d'eux
        if (n.allowed_contracts.length > 0) {
          if (!n.allowed_contracts.some((ct) => c.contracts.has(ct))) return false;
        } else if (n.contract) {
          if (!c.contracts.has(n.contract)) return false;
        }
        return true;
      });

    // ─── 3. DIFFICULTÉ : trier besoins du plus dur au plus facile ───
    const scored = needs.map((n) => {
      const pool = eligibleFor(n);
      const availSum = pool.reduce((acc, c) => {
        const ranges = candidateAvail(c.id, n.date);
        return acc + ranges.reduce((a, r) => {
          const inter = Math.max(0, Math.min(r.e, n.endMin) - Math.max(r.s, n.startMin));
          return a + inter;
        }, 0);
      }, 0);
      // difficulté faible = peu de candidats × peu d'heures dispo
      const difficulty = (pool.length || 1) * Math.max(1, availSum);
      // bonus prio shift obligatoire
      const priority = n.is_optional ? 1 : 0;
      return { n, pool, difficulty, priority };
    });
    scored.sort((a, b) => a.priority - b.priority || a.difficulty - b.difficulty);

    // ─── 4. COUVERTURE GLOUTONNE ────────────────────────────────────
    const toInsert: any[] = [];
    const totalRequiredMin = needs.reduce((acc, n) => acc + (n.endMin - n.startMin), 0);
    let totalCoveredMin = 0;
    let totalCreated = 0;

    // helpers pour conflits / quotas (incluent existing + toInsert)
    const allShifts = () => existing.concat(toInsert);

    const candidateConflict = (c: Candidate, date: string, sMin: number, eMin: number): boolean => {
      for (const sh of allShifts()) {
        if (sh.user_id !== c.id) continue;
        if (sh.shift_date !== date) continue;
        const ss = t2m(String(sh.start_time).slice(0, 5));
        const ee = t2m(String(sh.end_time).slice(0, 5));
        if (ss < eMin && ee > sMin) return true;
      }
      return false;
    };

    const checkRest11 = (c: Candidate, date: string, sMin: number, eMin: number): boolean => {
      if (!s.enforce_rest_11h) return true;
      const ref = new Date(`${date}T${m2t(sMin)}:00`).getTime();
      const refEnd = new Date(`${date}T${m2t(eMin)}:00`).getTime();
      for (const sh of allShifts()) {
        if (sh.user_id !== c.id) continue;
        const eDt = new Date(`${sh.shift_date}T${String(sh.end_time).slice(0, 5)}:00`).getTime();
        const sDt = new Date(`${sh.shift_date}T${String(sh.start_time).slice(0, 5)}:00`).getTime();
        const diff1 = (ref - eDt) / 3600000;
        const diff2 = (sDt - refEnd) / 3600000;
        if (diff1 >= 0 && diff1 < 11) return false;
        if (diff2 >= 0 && diff2 < 11) return false;
      }
      return true;
    };

    const weeklyHoursFor = (c: Candidate, date: string): number => {
      const wkStart = isoWeekStart(date);
      const wkEnd = new Date(`${wkStart}T00:00:00`);
      wkEnd.setDate(wkEnd.getDate() + 6);
      const wkEndStr = wkEnd.toISOString().slice(0, 10);
      return allShifts()
        .filter((sh) => sh.user_id === c.id && sh.shift_date >= wkStart && sh.shift_date <= wkEndStr)
        .reduce((acc, sh) => acc + (t2m(String(sh.end_time).slice(0, 5)) - t2m(String(sh.start_time).slice(0, 5))) / 60, 0);
    };

    const checkWeeklyCDI = (c: Candidate, date: string, durH: number): boolean => {
      if (!s.enforce_max_weekly_cdi || c.contract !== "CDI") return true;
      return weeklyHoursFor(c, date) + durH <= s.max_weekly_cdi_hours;
    };

    const checkWeeklyStudent = (c: Candidate, date: string, durH: number): boolean => {
      if (c.contract !== "Étudiant") return true;
      return weeklyHoursFor(c, date) + durH <= s.max_weekly_student_hours;
    };

    const checkWeeklyFlexi = (c: Candidate, date: string, durH: number): boolean => {
      if (c.contract !== "Flexi") return true;
      return weeklyHoursFor(c, date) + durH <= s.max_weekly_flexi_hours;
    };

    const checkStudentQuota = (c: Candidate, durH: number): boolean => {
      if (!s.enforce_student_quota || c.contract !== "Étudiant" || c.quota_max == null) return true;
      const used = c.quota_used ?? 0;
      const periodH = toInsert
        .filter((sh) => sh.user_id === c.id)
        .reduce((acc, sh) => acc + (t2m(String(sh.end_time).slice(0, 5)) - t2m(String(sh.start_time).slice(0, 5))) / 60, 0);
      return used + periodH + durH <= Number(c.quota_max);
    };

    for (const { n, pool } of scored) {
      let pointer = n.startMin;
      let lastMaxAssigned = Math.max(1, ...Array.from(candidates.values()).map((c) => c.assigned_count));

      // ─── MODE ATOMIQUE : besoin avec contrat fixe (ex. CDI cuisine/bar)
      // → un seul employé couvre tout le créneau, sans découpe ni min/max.
      const atomic = !!n.contract;
      if (atomic) {
        const fullDurH = (n.endMin - n.startMin) / 60;
        type AtomOpt = { c: Candidate; score: number };
        const opts: AtomOpt[] = [];
        for (const c of pool) {
          if (candidateConflict(c, n.date, n.startMin, n.endMin)) continue;
          if (!checkRest11(c, n.date, n.startMin, n.endMin)) continue;
          // CDI : on respecte uniquement le plafond hebdo (contrat fixe peut dépasser max_shift_hours)
          if (!checkWeeklyCDI(c, n.date, fullDurH)) continue;
          if (!checkWeeklyStudent(c, n.date, fullDurH)) continue;
          if (!checkWeeklyFlexi(c, n.date, fullDurH)) continue;
          if (!checkStudentQuota(c, fullDurH)) continue;
          const perf = (c.score ?? 7) / 10;
          const eq = 1 - c.assigned_count / Math.max(lastMaxAssigned, 1);
          const ranges = candidateAvail(c.id, n.date);
          const covers = ranges.some((r) => r.s <= n.startMin && r.e >= n.endMin);
          const pref = covers ? 1 : hasAnyAvail(c.id) ? 0.3 : 0.5;
          const wTot = (s.weight_performance + s.weight_equity + s.weight_preference + s.weight_random) || 1;
          const score = (s.weight_performance * perf + s.weight_equity * eq + s.weight_preference * pref + s.weight_random * Math.random()) / wTot;
          opts.push({ c, score });
        }
        if (opts.length === 0) {
          toInsert.push({
            user_id: null, studio_id: n.studio_id, business_role: n.role,
            shift_date: n.date,
            start_time: `${m2t(n.startMin)}:00`,
            end_time: `${m2t(n.endMin)}:00`,
            status: "scheduled", is_locked: false, is_manual: false,
          });
        } else {
          opts.sort((a, b) => b.score - a.score);
          const best = opts[0];
          toInsert.push({
            user_id: best.c.id, studio_id: n.studio_id, business_role: n.role,
            shift_date: n.date,
            start_time: `${m2t(n.startMin)}:00`,
            end_time: `${m2t(n.endMin)}:00`,
            status: "draft", is_locked: false, is_manual: false,
          });
          best.c.assigned_count++;
          totalCreated++;
          totalCoveredMin += n.endMin - n.startMin;
        }
        continue;
      }

      while (pointer < n.endMin) {
        // Pour chaque candidat éligible, lister les blocs valides commençant à pointer
        type Option = { c: Candidate; blockEnd: number; score: number };
        const options: Option[] = [];

        for (const c of pool) {
          const ranges = candidateAvail(c.id, n.date);
          // Si strict_preferences et l'employé n'a déclaré aucune dispo → on l'ignore
          // Si strict_preferences et l'employé a déclaré des dispos mais pas sur pointer → on l'ignore
          const containsPointer = ranges.find((r) => r.s <= pointer && r.e > pointer);
          if (s.strict_preferences) {
            if (!containsPointer) continue;
          }

          // Calculer la fin max possible pour ce candidat
          // = min(end de sa dispo qui couvre pointer, n.endMin, pointer + maxMin)
          let availEnd: number | null = containsPointer ? containsPointer.e : null;
          // Si pas dispo couvrant pointer mais on n'est PAS strict, on autorise quand même (pénalité de score)
          if (!availEnd) availEnd = n.endMin; // laisse l'algo essayer le bloc complet

          const maxBlockEnd = Math.min(availEnd, n.endMin, pointer + maxMin);
          // bloc minimum
          const minBlockEnd = pointer + minMin;
          if (minBlockEnd > maxBlockEnd) continue;

          // Tester tailles de bloc par pas de granularité, du plus grand au plus petit
          // Préférer le bloc le plus long qui satisfait toutes les contraintes
          for (let blockEnd = Math.floor(maxBlockEnd / SLOT_GRANULARITY_MIN) * SLOT_GRANULARITY_MIN;
               blockEnd >= minBlockEnd;
               blockEnd -= SLOT_GRANULARITY_MIN) {
            if (blockEnd <= pointer) break;
            const durH = (blockEnd - pointer) / 60;
            if (candidateConflict(c, n.date, pointer, blockEnd)) continue;
            if (!checkRest11(c, n.date, pointer, blockEnd)) continue;
            if (!checkWeeklyCDI(c, n.date, durH)) continue;
            if (!checkWeeklyStudent(c, n.date, durH)) continue;
            if (!checkWeeklyFlexi(c, n.date, durH)) continue;
            if (!checkStudentQuota(c, durH)) continue;

            // Score
            const perf = (c.score ?? 7) / 10;
            const eq = 1 - c.assigned_count / Math.max(lastMaxAssigned, 1);
            let pref: number;
            if (containsPointer) pref = 1;
            else if (hasAnyAvail(c.id)) pref = 0.3;
            else pref = 0.5;
            // Bonus longueur bloc (préfère couvrir plus)
            const lenBonus = (blockEnd - pointer) / maxMin;
            const rnd = Math.random();
            const wTot = (s.weight_performance + s.weight_equity + s.weight_preference + s.weight_random) || 1;
            const score = (
              s.weight_performance * perf +
              s.weight_equity * eq +
              s.weight_preference * pref +
              s.weight_random * rnd
            ) / wTot + 0.15 * lenBonus;
            options.push({ c, blockEnd, score });
            break; // 1 option par candidat (le plus long valide)
          }
        }

        if (options.length === 0) {
          // Trouver le prochain start dispo pour clore le trou
          let nextAvailStart = n.endMin;
          for (const c of pool) {
            for (const r of candidateAvail(c.id, n.date)) {
              if (r.s > pointer && r.s < nextAvailStart) nextAvailStart = r.s;
            }
          }
          const gapEnd = Math.min(nextAvailStart, n.endMin);
          // Insérer un trou (user_id = null)
          toInsert.push({
            user_id: null, studio_id: n.studio_id, business_role: n.role,
            shift_date: n.date,
            start_time: `${m2t(pointer)}:00`,
            end_time: `${m2t(gapEnd)}:00`,
            status: "scheduled", is_locked: false, is_manual: false,
          });
          pointer = gapEnd;
          continue;
        }

        // Choisir la meilleure option
        options.sort((a, b) => b.score - a.score);
        const best = options[0];
        toInsert.push({
          user_id: best.c.id, studio_id: n.studio_id, business_role: n.role,
          shift_date: n.date,
          start_time: `${m2t(pointer)}:00`,
          end_time: `${m2t(best.blockEnd)}:00`,
          status: "draft", is_locked: false, is_manual: false,
        });
        best.c.assigned_count++;
        totalCreated++;
        totalCoveredMin += best.blockEnd - pointer;
        pointer = best.blockEnd;
        lastMaxAssigned = Math.max(lastMaxAssigned, best.c.assigned_count);
      }
    }

    // ─── 5. INSERT ──────────────────────────────────────────────────
    const BATCH = 500;
    for (let i = 0; i < toInsert.length; i += BATCH) {
      const slice = toInsert.slice(i, i + BATCH);
      const { error } = await supabase.from("shifts").insert(slice);
      if (error) {
        return {
          ok: false, error: `Erreur d'insertion : ${error.message}`,
          created: i, holes: toInsert.filter((x) => x.user_id === null).length,
          totalRequired: needs.length, candidatesPool: candidates.size,
          kpis: { coverage: 0, equity: 0, fairness: 0 }, unfilled: [], alerts: [],
        };
      }
    }

    // ─── 6. KPIs ────────────────────────────────────────────────────
    const coverage = totalRequiredMin > 0 ? Math.round((totalCoveredMin / totalRequiredMin) * 100) : 100;
    const counts = Array.from(candidates.values()).map((c) => c.assigned_count).filter((n) => n > 0);
    const avg = counts.length ? counts.reduce((a, b) => a + b, 0) / counts.length : 0;
    const variance = counts.length ? counts.reduce((s, n) => s + Math.pow(n - avg, 2), 0) / counts.length : 0;
    const equity = avg > 0 ? Math.max(0, Math.min(10, 10 - Math.sqrt(variance))) : 10;

    const holes = toInsert.filter((x) => x.user_id === null);
    const unfilled = holes.slice(0, 20).map((h) => ({
      date: h.shift_date,
      time: `${String(h.start_time).slice(0, 5)} – ${String(h.end_time).slice(0, 5)}`,
      role: h.business_role,
      studio_id: h.studio_id,
      studio: studioNames.get(h.studio_id) ?? "—",
      reason: "Aucun candidat éligible disponible sur ce créneau",
    }));

    const alerts: { name: string; detail: string; level: "danger" | "warning" }[] = [];
    for (const c of candidates.values()) {
      if (c.roles.size > 0 && c.assigned_count === 0) {
        alerts.push({
          name: `${c.first_name} ${c.last_name}`,
          detail: "0 shift attribué — vérifier rôles, studios ou dispos",
          level: "warning",
        });
      }
    }

    return {
      ok: true,
      created: totalCreated,
      holes: holes.length,
      totalRequired: needs.length,
      candidatesPool: candidates.size,
      kpis: {
        coverage,
        equity: Number(equity.toFixed(1)),
        fairness: counts.length,
      },
      unfilled,
      alerts: alerts.slice(0, 10),
    };
  });
