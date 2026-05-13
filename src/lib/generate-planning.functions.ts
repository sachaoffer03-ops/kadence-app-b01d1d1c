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
}

interface Candidate {
  id: string;
  first_name: string;
  last_name: string;
  score: number | null;
  contract: string | null;
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

    // 3. Employés + rôles + studios
    const [{ data: profiles }, { data: ubr }, { data: us }] = await Promise.all([
      supabase.from("profiles").select("id, first_name, last_name, score, contract").eq("status", "active"),
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
        // Compter les shifts déjà existants (verrouillés/manuels) qui couvrent ce créneau
        const alreadyCovered = existing.filter(
          (sh) =>
            sh.shift_date === dateStr &&
            sh.studio_id === t.studio_id &&
            sh.business_role === t.business_role &&
            sh.start_time === t.start_time &&
            sh.end_time === t.end_time,
        ).length;

        const stillNeeded = Math.max(0, t.required_count - alreadyCovered);

        for (let i = 0; i < t.required_count; i++) {
          totalRequired++;
        }
        totalCreated += alreadyCovered; // les shifts conservés comptent comme couverts

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
            return true;
          });

          if (eligible.length === 0) {
            unfilled.push({
              date: dateStr,
              time: `${t.start_time.slice(0, 5)} – ${t.end_time.slice(0, 5)}`,
              role: t.business_role,
              studio_id: t.studio_id,
              reason: "Aucun employé éligible (rôle + studio + repos)",
            });
            continue;
          }

          const maxAssigned = Math.max(1, ...eligible.map((c) => c.assigned_count));
          const wTot = s.weight_performance + s.weight_equity + s.weight_preference + s.weight_random || 1;
          const scored = eligible.map((c) => {
            const perf = (c.score ?? 7) / 10;
            const eq = 1 - c.assigned_count / Math.max(maxAssigned, 1);
            const pref = 0.5;
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
