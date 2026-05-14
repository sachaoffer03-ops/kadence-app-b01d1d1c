// Diagnostic complet de l'état des données BDD pour le moteur de planning
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fetchAll } from "@/lib/supabase-paginate";

function timeToMin(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

export const runDataDiagnostic = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;

    // Période = mois prochain (à partir d'aujourd'hui +1 mois, 1er du mois → fin)
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const nextMonthEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0);
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const periodStart = fmt(nextMonth);
    const periodEnd = fmt(nextMonthEnd);

    const [
      profiles,
      userContracts,
      userBusinessRoles,
      userStudios,
      staffingTemplates,
      availabilities,
      studios,
      settingsRows,
    ] = await Promise.all([
      fetchAll<any>(supabase, "profiles", "id, first_name, last_name, status, contract"),
      fetchAll<any>(supabase, "user_contracts", "user_id, contract"),
      fetchAll<any>(supabase, "user_business_roles", "user_id, role"),
      fetchAll<any>(supabase, "user_studios", "user_id, studio_id"),
      fetchAll<any>(supabase, "staffing_templates", "id, studio_id, day_of_week, start_time, end_time, required_count"),
      supabase.from("availabilities").select("id, user_id, avail_date, start_time, end_time")
        .gte("avail_date", periodStart).lte("avail_date", periodEnd)
        .then((r) => r.data ?? []),
      fetchAll<any>(supabase, "studios", "id, name"),
      supabase.from("ai_planning_settings").select("*").limit(1).then((r) => r.data ?? []),
    ]);

    const activeProfiles = profiles.filter((p: any) => p.status === "active");

    // 1. Profils actifs par contrat principal
    const byContract: Record<string, number> = {};
    for (const p of activeProfiles) {
      const k = p.contract ?? "(aucun)";
      byContract[k] = (byContract[k] ?? 0) + 1;
    }

    // 2,3,4. Profils avec ≥1 ligne dans tables liées
    const usersWithContract = new Set(userContracts.map((r: any) => r.user_id));
    const usersWithBizRole = new Set(userBusinessRoles.map((r: any) => r.user_id));
    const usersWithStudio = new Set(userStudios.map((r: any) => r.user_id));

    const activeIds = new Set(activeProfiles.map((p: any) => p.id));
    const countActive = (s: Set<string>) => [...s].filter((id) => activeIds.has(id)).length;

    // 5. staffing_templates par studio × jour
    const studioMap = new Map(studios.map((s: any) => [s.id, s.name]));
    const templatesByStudioDay: Array<{ studio: string; day: number; count: number }> = [];
    const grid: Record<string, Record<number, number>> = {};
    for (const t of staffingTemplates) {
      grid[t.studio_id] = grid[t.studio_id] ?? {};
      grid[t.studio_id][t.day_of_week] = (grid[t.studio_id][t.day_of_week] ?? 0) + (t.required_count ?? 1);
    }
    for (const [sid, days] of Object.entries(grid)) {
      for (const [day, count] of Object.entries(days)) {
        templatesByStudioDay.push({ studio: studioMap.get(sid) ?? sid, day: Number(day), count });
      }
    }
    templatesByStudioDay.sort((a, b) => a.studio.localeCompare(b.studio) || a.day - b.day);

    // 6. Dispos mois prochain par employé
    const dispoByUser: Record<string, number> = {};
    for (const a of availabilities as any[]) {
      dispoByUser[a.user_id] = (dispoByUser[a.user_id] ?? 0) + 1;
    }
    const dispoPerEmployee = activeProfiles
      .map((p: any) => ({
        user_id: p.id,
        name: `${p.first_name} ${p.last_name}`.trim(),
        dispo_count: dispoByUser[p.id] ?? 0,
      }))
      .sort((a: any, b: any) => b.dispo_count - a.dispo_count);

    // 7. Employés sans aucune dispo
    const employeesWithoutDispo = dispoPerEmployee.filter((e: any) => e.dispo_count === 0);

    // 8. Heures demandées vs heures dispo par studio
    // Heures demandées = somme des durées * required_count par studio sur 1 semaine
    const demandedByStudio: Record<string, number> = {};
    for (const t of staffingTemplates) {
      const dur = (timeToMin(t.end_time) - timeToMin(t.start_time)) / 60;
      demandedByStudio[t.studio_id] = (demandedByStudio[t.studio_id] ?? 0) + dur * (t.required_count ?? 1);
    }

    // Heures dispo = somme des max contractuels des employés affectés au studio
    const settings = settingsRows[0] ?? {};
    const maxByContract: Record<string, number> = {
      CDI: settings.max_weekly_cdi_hours ?? 48,
      "Étudiant": settings.max_weekly_student_hours ?? 15,
      Flexi: settings.max_weekly_flexi_hours ?? 20,
    };
    const userContractsByUser: Record<string, string[]> = {};
    for (const r of userContracts) {
      userContractsByUser[r.user_id] = userContractsByUser[r.user_id] ?? [];
      userContractsByUser[r.user_id].push(r.contract);
    }
    const studiosByUser: Record<string, string[]> = {};
    for (const r of userStudios) {
      studiosByUser[r.user_id] = studiosByUser[r.user_id] ?? [];
      studiosByUser[r.user_id].push(r.studio_id);
    }
    const availableByStudio: Record<string, number> = {};
    for (const p of activeProfiles) {
      const sids = studiosByUser[p.id] ?? (p.studio_id ? [p.studio_id] : []);
      const contracts = userContractsByUser[p.id] ?? (p.contract ? [p.contract] : []);
      const maxH = Math.max(0, ...contracts.map((c) => maxByContract[c] ?? 0));
      for (const sid of sids) {
        availableByStudio[sid] = (availableByStudio[sid] ?? 0) + maxH;
      }
    }
    const studioCapacity = studios.map((s: any) => ({
      studio: s.name,
      demanded_hours: Math.round((demandedByStudio[s.id] ?? 0) * 10) / 10,
      available_hours: availableByStudio[s.id] ?? 0,
      ratio: availableByStudio[s.id] ? Math.round(((demandedByStudio[s.id] ?? 0) / availableByStudio[s.id]) * 100) : null,
    }));

    // 9. Employés avec rôle Cuisine
    const cuisineUsers = userBusinessRoles.filter((r: any) => r.role === "Cuisine");
    const cuisineActiveCount = cuisineUsers.filter((r: any) => activeIds.has(r.user_id)).length;

    // 10. ai_planning_settings
    const aiSettings = settings;

    return {
      period: { start: periodStart, end: periodEnd },
      counts: {
        total_profiles: profiles.length,
        active_profiles: activeProfiles.length,
        active_with_contract_row: countActive(usersWithContract),
        active_with_business_role: countActive(usersWithBizRole),
        active_with_studio: countActive(usersWithStudio),
      },
      by_contract: byContract,
      templates_by_studio_day: templatesByStudioDay,
      dispo_per_employee: dispoPerEmployee,
      employees_without_dispo: employeesWithoutDispo,
      studio_capacity: studioCapacity,
      cuisine_role_count: cuisineActiveCount,
      ai_settings: aiSettings,
    };
  });
