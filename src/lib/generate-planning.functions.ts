import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type BusinessRole = "Barista" | "Accueil" | "Host" | "Cuisine";

interface TemplateRow {
  id: string;
  studio_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  business_role: BusinessRole;
  required_count: number;
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
}

const MAX_WEEKLY_CDI_HOURS = 38; // plafond hebdo CDI (Belgique)

function durationHours(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return ((eh * 60 + em) - (sh * 60 + sm)) / 60;
}

// Lundi de la semaine ISO contenant `dateStr` (YYYY-MM-DD)
function isoWeekStart(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  const dow = d.getDay(); // 0 dim
  const offset = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + offset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type Slot = "matin" | "midi" | "soir";

// Mapping créneau template -> slot dispo employé selon l'heure de début
function slotForStart(startTime: string): Slot {
  const h = parseInt(startTime.slice(0, 2), 10);
  if (h < 11) return "matin";
  if (h < 16) return "midi";
  return "soir";
}

interface Candidate {
  id: string;
  first_name: string;
  last_name: string;
  score: number | null;
  contract: string | null;
  quota_max: number | null;
  quota_used: number | null;
  studio_ids: Set<string>;
  roles: Set<BusinessRole>;
  assigned_count: number;
}

const GenerateInput = z
  .object({
    // Mode 1 : mois entier (raccourci)
    year: z.number().int().min(2024).max(2100).optional(),
    month: z.number().int().min(0).max(11).optional(),
    // Mode 2 : période personnalisée
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

export const generatePlanning = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => GenerateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { year, month, replaceExisting } = data;

    // Vérifie admin
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isAdmin = roleRows?.some((r: any) => r.role === "admin");
    if (!isAdmin) {
      throw new Error("Seuls les admins peuvent générer un planning");
    }

    // 1. Réglages IA
    const { data: settingsRows } = await supabase
      .from("ai_planning_settings")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1);
    const s: Settings = settingsRows?.[0] ?? {
      weight_performance: 40,
      weight_equity: 30,
      weight_preference: 20,
      weight_random: 10,
      enforce_rest_11h: true,
      strict_preferences: false,
      enforce_max_weekly_cdi: true,
      enforce_student_quota: true,
    } as Settings;

    // 2. Templates (besoins par studio/jour/créneau)
    const { data: templates } = await supabase
      .from("staffing_templates")
      .select("*");
    const tpls = (templates ?? []) as TemplateRow[];
    if (tpls.length === 0) {
      return {
        ok: false,
        error: "Aucun template de besoins défini. Configurez les besoins par studio dans Réglages > Algorithme IA.",
        created: 0, holes: 0, totalRequired: 0, candidatesPool: 0,
        kpis: { coverage: 0, equity: 0, fairness: 0 },
        unfilled: [], alerts: [],
      };
    }

    // 3. Employés + rôles + studios + dispos
    // On charge les dispos uniquement sur la période (perf + pertinence)
    // Note: on a besoin de la période donc on calcule firstDay/lastDay AVANT (déplacé ci-dessous)
    const [{ data: profiles }, { data: ubr }, { data: us }] = await Promise.all([
      supabase.from("profiles").select("id, first_name, last_name, score, contract, quota_max, quota_used").eq("status", "active"),
      supabase.from("user_business_roles").select("user_id, role"),
      supabase.from("user_studios").select("user_id, studio_id"),
    ]);

    const candidates: Map<string, Candidate> = new Map();
    for (const p of profiles ?? []) {
      candidates.set(p.id, {
        id: p.id,
        first_name: p.first_name ?? "",
        last_name: p.last_name ?? "",
        score: p.score ?? null,
        contract: p.contract ?? null,
        quota_max: (p as any).quota_max ?? null,
        quota_used: (p as any).quota_used ?? null,
        studio_ids: new Set(),
        roles: new Set(),
        assigned_count: 0,
      });
    }
    for (const r of (ubr ?? []) as any[]) {
      const c = candidates.get(r.user_id);
      if (c) c.roles.add(r.role);
    }
    for (const r of (us ?? []) as any[]) {
      const c = candidates.get(r.user_id);
      if (c) c.studio_ids.add(r.studio_id);
    }

    // 4. Calcul de la plage de dates
    let firstDay: string;
    let lastDay: string;
    if (data.startDate && data.endDate) {
      firstDay = data.startDate;
      lastDay = data.endDate;
      if (firstDay > lastDay) {
        throw new Error("startDate doit être <= endDate");
      }
    } else {
      const y = data.year as number;
      const m = data.month as number;
      const ld = new Date(y, m + 1, 0);
      firstDay = `${y}-${String(m + 1).padStart(2, "0")}-01`;
      lastDay = `${y}-${String(m + 1).padStart(2, "0")}-${String(ld.getDate()).padStart(2, "0")}`;
    }

    if (replaceExisting) {
      // On ne supprime QUE les shifts non verrouillés et non manuels
      await supabase
        .from("shifts")
        .delete()
        .gte("shift_date", firstDay)
        .lte("shift_date", lastDay)
        .eq("is_locked", false)
        .eq("is_manual", false);
    }

    // 5. Charger shifts existants restants (verrouillés/manuels conservés)
    // Servent à : (a) éviter de doubler une attribution, (b) repos 11h, (c) compter "déjà couverts"
    const { data: existingShifts } = await supabase
      .from("shifts")
      .select("user_id, shift_date, start_time, end_time, studio_id, business_role")
      .gte("shift_date", firstDay)
      .lte("shift_date", lastDay);
    const existing = (existingShifts ?? []) as any[];

    // 5b. Disponibilités sur la période -> Map<userId, Map<date, Set<slot>>>
    const { data: avails } = await supabase
      .from("availabilities")
      .select("user_id, avail_date, slot")
      .gte("avail_date", firstDay)
      .lte("avail_date", lastDay);
    const availMap = new Map<string, Map<string, Set<Slot>>>();
    for (const a of (avails ?? []) as any[]) {
      let byDate = availMap.get(a.user_id);
      if (!byDate) { byDate = new Map(); availMap.set(a.user_id, byDate); }
      let set = byDate.get(a.avail_date);
      if (!set) { set = new Set(); byDate.set(a.avail_date, set); }
      set.add(a.slot as Slot);
    }
    const isAvailable = (uid: string, date: string, slot: Slot) =>
      availMap.get(uid)?.get(date)?.has(slot) ?? false;
    const hasAnyAvailForUser = (uid: string) => (availMap.get(uid)?.size ?? 0) > 0;

    // 6. Boucle jours
    const toInsert: any[] = [];
    const unfilled: { date: string; time: string; role: string; studio_id: string; reason: string }[] = [];
    const studioNames = new Map<string, string>();
    const { data: studiosData } = await supabase.from("studios").select("id, name");
    for (const st of studiosData ?? []) studioNames.set(st.id, st.name);

    let totalRequired = 0;
    let totalCreated = 0;

    const startD = new Date(`${firstDay}T00:00:00`);
    const endD = new Date(`${lastDay}T00:00:00`);
    for (let cur = new Date(startD); cur <= endD; cur.setDate(cur.getDate() + 1)) {
      const y = cur.getFullYear();
      const m = cur.getMonth();
      const day = cur.getDate();
      const jsDow = cur.getDay();
      const dow = (jsDow + 6) % 7;
      const dateStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

      const todaysTemplates = tpls.filter((t) => t.day_of_week === dow);

      for (const t of todaysTemplates) {
        const tSlot = slotForStart(t.start_time);
        // Compter les shifts conservés qui chevauchent ce créneau (même studio + rôle)
        const alreadyCovered = existing.filter((sh) => {
          if (sh.shift_date !== dateStr) return false;
          if (sh.studio_id !== t.studio_id) return false;
          if (sh.business_role !== t.business_role) return false;
          // Chevauchement : sh.start < t.end ET sh.end > t.start
          return String(sh.start_time) < String(t.end_time) && String(sh.end_time) > String(t.start_time);
        }).length;

        const stillNeeded = Math.max(0, t.required_count - alreadyCovered);

        totalRequired += t.required_count;
        totalCreated += Math.min(alreadyCovered, t.required_count);

        for (let i = 0; i < stillNeeded; i++) {
          // Filtrer candidats éligibles
          const eligible = Array.from(candidates.values()).filter((c) => {
            if (!c.roles.has(t.business_role)) return false;
            if (c.studio_ids.size > 0 && !c.studio_ids.has(t.studio_id)) return false;
            // Pas déjà sur ce jour
            const sameDay = [...existing, ...toInsert].some(
              (sh) => sh.user_id === c.id && sh.shift_date === dateStr,
            );
            if (sameDay) return false;
            // Repos 11h
            if (s.enforce_rest_11h) {
              const refDateTime = new Date(`${dateStr}T${t.start_time}`);
              const conflict = [...existing, ...toInsert].some((sh) => {
                if (sh.user_id !== c.id) return false;
                const endDt = new Date(`${sh.shift_date}T${sh.end_time}`);
                const diffH = (refDateTime.getTime() - endDt.getTime()) / 3600000;
                return diffH >= 0 && diffH < 11;
              });
              if (conflict) return false;
            }
            // Dispos : si mode strict, on exige une dispo positive sur le slot.
            if (s.strict_preferences && hasAnyAvailForUser(c.id) && !isAvailable(c.id, dateStr, tSlot)) {
              return false;
            }
            const shiftDur = durationHours(t.start_time, t.end_time);
            // Plafond hebdo CDI (38h)
            if (s.enforce_max_weekly_cdi && c.contract === "CDI") {
              const wkStart = isoWeekStart(dateStr);
              const wkEndDate = new Date(`${wkStart}T00:00:00`);
              wkEndDate.setDate(wkEndDate.getDate() + 6);
              const wkEnd = wkEndDate.toISOString().slice(0, 10);
              const weekHours = [...existing, ...toInsert]
                .filter((sh) => sh.user_id === c.id && sh.shift_date >= wkStart && sh.shift_date <= wkEnd)
                .reduce((acc, sh) => acc + durationHours(String(sh.start_time), String(sh.end_time)), 0);
              if (weekHours + shiftDur > MAX_WEEKLY_CDI_HOURS) return false;
            }
            // Quota étudiant (heures restantes sur la période, basé sur quota_max - quota_used)
            if (s.enforce_student_quota && c.contract === "Étudiant" && c.quota_max != null) {
              const used = c.quota_used ?? 0;
              const periodHours = [...toInsert]
                .filter((sh) => sh.user_id === c.id)
                .reduce((acc, sh) => acc + durationHours(String(sh.start_time), String(sh.end_time)), 0);
              if (used + periodHours + shiftDur > Number(c.quota_max)) return false;
            }
            return true;
          });

          if (eligible.length === 0) {
            unfilled.push({
              date: dateStr,
              time: `${t.start_time.slice(0, 5)} – ${t.end_time.slice(0, 5)}`,
              role: t.business_role,
              studio_id: t.studio_id,
              reason: s.strict_preferences
                ? "Aucun employé disponible (rôle + studio + repos + dispos)"
                : "Aucun employé éligible (rôle + studio + repos)",
            });
            continue;
          }

          const maxAssigned = Math.max(1, ...eligible.map((c) => c.assigned_count));
          const wTot = s.weight_performance + s.weight_equity + s.weight_preference + s.weight_random || 1;
          const scored = eligible.map((c) => {
            const perf = (c.score ?? 7) / 10;
            const eq = 1 - c.assigned_count / Math.max(maxAssigned, 1);
            // pref : 1 si dispo déclarée sur ce slot, 0.3 si l'employé a déclaré
            // des dispos mais PAS celle-ci (pénalité), 0.5 s'il n'a rien déclaré (neutre).
            let pref: number;
            if (isAvailable(c.id, dateStr, tSlot)) pref = 1;
            else if (hasAnyAvailForUser(c.id)) pref = 0.3;
            else pref = 0.5;
            const rnd = Math.random();
            const total =
              (s.weight_performance * perf +
                s.weight_equity * eq +
                s.weight_preference * pref +
                s.weight_random * rnd) /
              wTot;
            return { c, total };
          });
          scored.sort((a, b) => b.total - a.total);
          const winner = scored[0].c;
          winner.assigned_count++;

          toInsert.push({
            user_id: winner.id,
            studio_id: t.studio_id,
            business_role: t.business_role,
            shift_date: dateStr,
            start_time: t.start_time,
            end_time: t.end_time,
            status: "draft", // brouillon : visible admin uniquement, pas de notif
            is_locked: false,
            is_manual: false,
          });
          totalCreated++;
        }
      }
    }

    // 7. Insert en batch (par 500 pour éviter les limites)
    const BATCH = 500;
    for (let i = 0; i < toInsert.length; i += BATCH) {
      const slice = toInsert.slice(i, i + BATCH);
      const { error } = await supabase.from("shifts").insert(slice);
      if (error) {
        return {
          ok: false,
          error: `Erreur d'insertion : ${error.message}`,
          created: i, holes: unfilled.length, totalRequired,
          candidatesPool: candidates.size,
          kpis: { coverage: 0, equity: 0, fairness: 0 },
          unfilled: [], alerts: [],
        };
      }
    }

    // 8. KPIs
    const coverage = totalRequired > 0 ? Math.round((totalCreated / totalRequired) * 100) : 100;
    const counts = Array.from(candidates.values()).map((c) => c.assigned_count).filter((n) => n > 0);
    const avg = counts.length ? counts.reduce((a, b) => a + b, 0) / counts.length : 0;
    const variance = counts.length ? counts.reduce((s, n) => s + Math.pow(n - avg, 2), 0) / counts.length : 0;
    const equity = avg > 0 ? Math.max(0, Math.min(10, 10 - Math.sqrt(variance))) : 10;

    // Alertes : employés actifs sans aucun shift attribué
    const alerts: { name: string; detail: string; level: "danger" | "warning" }[] = [];
    for (const c of candidates.values()) {
      if (c.roles.size > 0 && c.assigned_count === 0) {
        alerts.push({
          name: `${c.first_name} ${c.last_name}`,
          detail: "0 shift attribué — vérifier rôles et studios",
          level: "warning",
        });
      }
    }

    return {
      ok: true,
      created: totalCreated,
      holes: unfilled.length,
      totalRequired,
      candidatesPool: candidates.size,
      kpis: {
        coverage,
        equity: Number(equity.toFixed(1)),
        fairness: counts.length,
      },
      unfilled: unfilled.slice(0, 20).map((u) => ({
        ...u,
        studio: studioNames.get(u.studio_id) ?? "—",
      })),
      alerts: alerts.slice(0, 10),
    };
  });
