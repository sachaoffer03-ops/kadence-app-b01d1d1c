import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import fs from "node:fs";
import path from "node:path";

const DOW_LABEL = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const DOW_LABEL_PG = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

export const runDiagnostic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const sb = supabaseAdmin;

    // S1 — staffing_templates cuisine
    const { data: tpl } = await sb
      .from("staffing_templates")
      .select("day_of_week,start_time,end_time,business_role,required_contract,allowed_contracts,allowed_roles,required_count,studio_id,studios(name)")
      .eq("business_role", "Cuisine");
    const s1 = (tpl ?? []).map((t: any) => {
      const [sh, sm] = String(t.start_time).split(":").map(Number);
      const [eh, em] = String(t.end_time).split(":").map(Number);
      const dur = ((eh * 60 + em) - (sh * 60 + sm)) / 60;
      return {
        studio: t.studios?.name ?? "?",
        day_of_week: t.day_of_week,
        jour: DOW_LABEL[t.day_of_week] ?? "?",
        start_time: t.start_time,
        end_time: t.end_time,
        duree_heures: dur,
        required_contract: t.required_contract,
        allowed_contracts: t.allowed_contracts,
        allowed_roles: t.allowed_roles,
        required_count: t.required_count,
      };
    }).sort((a, b) => (a.studio + a.day_of_week + a.start_time).localeCompare(b.studio + b.day_of_week + b.start_time));

    // S2 — profils cuisine
    const { data: cuisineRoles } = await sb.from("user_business_roles").select("user_id").eq("role", "Cuisine");
    const cuisineIds = Array.from(new Set((cuisineRoles ?? []).map((r: any) => r.user_id)));
    let s2: any[] = [];
    if (cuisineIds.length) {
      const { data: profs } = await sb
        .from("profiles")
        .select("id,first_name,last_name,email,score,status,is_test")
        .in("id", cuisineIds);
      const { data: contrs } = await sb.from("user_contracts").select("user_id,contract").in("user_id", cuisineIds);
      const { data: roles } = await sb.from("user_business_roles").select("user_id,role").in("user_id", cuisineIds);
      const { data: us } = await sb.from("user_studios").select("user_id,studio_id,studios(name)").in("user_id", cuisineIds);
      s2 = (profs ?? []).map((p: any) => ({
        nom: `${p.first_name} ${p.last_name}`,
        email: p.email,
        contrats: Array.from(new Set((contrs ?? []).filter((c: any) => c.user_id === p.id).map((c: any) => c.contract))),
        roles: Array.from(new Set((roles ?? []).filter((r: any) => r.user_id === p.id).map((r: any) => r.role))),
        studios: Array.from(new Set((us ?? []).filter((u: any) => u.user_id === p.id).map((u: any) => u.studios?.name).filter(Boolean))),
        score: p.score,
        status: p.status,
        is_test: p.is_test,
      }));
    }

    // S3 — Premier CDI cuisine trouvé : ses dispos sur la 1ʳᵉ semaine
    //       du mois suivant (calcul dynamique, aucun nom en dur)
    const today = new Date();
    const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const nextMonthDay7 = new Date(today.getFullYear(), today.getMonth() + 1, 7);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const periodStart = fmt(nextMonthStart);
    const periodEnd = fmt(nextMonthDay7);

    // Chercher CDI cuisine via flags (rôle is_kitchen + contrat CDI)
    const { data: kitchenRoleRows } = await sb.from("business_roles").select("name").eq("is_kitchen", true);
    const kitchenRoleNames = (kitchenRoleRows ?? []).map((r: any) => r.name);
    let cdiCuisineEmployee: { id: string; nom: string } | null = null;
    if (kitchenRoleNames.length && cuisineIds.length) {
      const { data: cdis } = await sb.from("user_contracts").select("user_id").eq("contract", "CDI").in("user_id", cuisineIds);
      const cdiKitchenIds = Array.from(new Set((cdis ?? []).map((c: any) => c.user_id)));
      if (cdiKitchenIds.length) {
        const { data: p } = await sb.from("profiles").select("id,first_name,last_name").in("id", cdiKitchenIds).limit(1).maybeSingle();
        if (p?.id) cdiCuisineEmployee = { id: p.id, nom: `${p.first_name} ${p.last_name}` };
      }
    }
    let s3: any[] = [];
    if (cdiCuisineEmployee) {
      const { data: av } = await sb
        .from("availabilities")
        .select("avail_date,start_time,end_time")
        .eq("user_id", cdiCuisineEmployee.id)
        .gte("avail_date", periodStart)
        .lte("avail_date", periodEnd)
        .order("avail_date").order("start_time");
      s3 = (av ?? []).map((a: any) => {
        const dow = new Date(a.avail_date + "T00:00:00").getDay();
        const [sh, sm] = String(a.start_time).split(":").map(Number);
        const [eh, em] = String(a.end_time).split(":").map(Number);
        return {
          avail_date: a.avail_date,
          jour: DOW_LABEL_PG[dow],
          start_time: a.start_time,
          end_time: a.end_time,
          duree: ((eh * 60 + em) - (sh * 60 + sm)) / 60,
        };
      });
    }

    // S4 — Dispos week-end de tous les profils qualifiés cuisine non-CDI
    let s4: any[] = [];
    if (cuisineIds.length) {
      const { data: nonCdiContracts } = await sb.from("user_contracts").select("user_id,contract").in("user_id", cuisineIds);
      const nonCdiIds = Array.from(new Set((nonCdiContracts ?? []).filter((c: any) => c.contract !== "CDI").map((c: any) => c.user_id)));
      if (nonCdiIds.length) {
        const { data: profs } = await sb.from("profiles").select("id,first_name,last_name").in("id", nonCdiIds);
        const { data: av } = await sb
          .from("availabilities")
          .select("user_id,avail_date,start_time,end_time")
          .in("user_id", nonCdiIds)
          .gte("avail_date", periodStart)
          .lte("avail_date", periodEnd);
        s4 = (av ?? []).map((a: any) => {
          const p = (profs ?? []).find((x: any) => x.id === a.user_id);
          const dow = new Date(a.avail_date + "T00:00:00").getDay();
          return {
            nom: p ? `${p.first_name} ${p.last_name}` : "?",
            avail_date: a.avail_date,
            jour: DOW_LABEL_PG[dow],
            start_time: a.start_time,
            end_time: a.end_time,
          };
        }).filter((a) => a.jour === "Samedi" || a.jour === "Dimanche")
          .sort((a, b) => (a.nom + a.avail_date).localeCompare(b.nom + b.avail_date));
      }
    }

    // S5 — shifts du CDI cuisine sur la période
    let s5: any[] = [];
    if (cdiCuisineEmployee) {
      const { data: sh } = await sb
        .from("shifts")
        .select("shift_date,start_time,end_time,business_role,studios(name)")
        .eq("user_id", cdiCuisineEmployee.id)
        .gte("shift_date", periodStart)
        .lte("shift_date", periodEnd)
        .order("shift_date").order("start_time");
      s5 = (sh ?? []).map((x: any) => {
        const dow = new Date(x.shift_date + "T00:00:00").getDay();
        const [sh1, sm] = String(x.start_time).split(":").map(Number);
        const [eh, em] = String(x.end_time).split(":").map(Number);
        return {
          shift_date: x.shift_date,
          jour: DOW_LABEL_PG[dow],
          start_time: x.start_time,
          end_time: x.end_time,
          business_role: x.business_role,
          studio: x.studios?.name,
          duree: ((eh * 60 + em) - (sh1 * 60 + sm)) / 60,
        };
      });
    }

    // S6 — code excerpts
    let s6 = { target: "", solo: "", cap: "", path: "src/lib/generate-planning.functions.ts" };
    try {
      const filePath = path.resolve(process.cwd(), "src/lib/generate-planning.functions.ts");
      const src = fs.readFileSync(filePath, "utf8");
      const lines = src.split("\n");
      const slice = (from: number, to: number) =>
        lines.slice(Math.max(0, from - 1), to).map((l, i) => `${from + i}: ${l}`).join("\n");
      // target ~ ligne 595-615
      const tIdx = lines.findIndex((l) => l.includes("targetCap = Math.min"));
      if (tIdx >= 0) s6.target = slice(tIdx - 4, tIdx + 6);
      // solo
      const sIdx = lines.findIndex((l) => l.includes("kitchen_solo"));
      if (sIdx >= 0) s6.solo = slice(sIdx - 2, sIdx + 30);
      // cap
      const cIdx = lines.findIndex((l) => l.includes("max_shift_hours_cdi") && l.includes("return"));
      if (cIdx >= 0) s6.cap = slice(cIdx - 4, cIdx + 6);
    } catch (e: any) {
      s6.path = `Erreur lecture: ${e?.message}`;
    }

    // S7 — settings IA
    const { data: settings } = await sb.from("ai_planning_settings").select("*").limit(1).maybeSingle();

    return { s1, s2, s3, s4, s5, s6, settings, cdi_cuisine_employee: cdiCuisineEmployee, period: { start: periodStart, end: periodEnd } };
  });
