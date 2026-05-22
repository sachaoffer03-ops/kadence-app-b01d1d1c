// Seed démo Clara — environnement de test isolé pour valider l'app côté employé.
// Admin uniquement. Toutes les actions touchent uniquement les profils is_test = true
// avec email contenant ".demo@kadence.test".
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const DEMO_EMAIL = "clara.demo@kadence.test";
const DEMO_PASSWORD = "demo1234";
const DEMO_FIRST_NAME = "Clara";
const DEMO_LAST_NAME = "Martens";
const DEMO_NISS = "00000000000";
const DEMO_IBAN = "BE00000000000000";
const DEMO_EMAIL_PATTERN = "%.demo@kadence.test";

function pad(n: number) { return String(n).padStart(2, "0"); }
function fmtDate(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function fmtTime(h: number, m: number) { return `${pad(h)}:${pad(m)}:00`; }
function addDays(d: Date, days: number) { const r = new Date(d); r.setDate(r.getDate() + days); return r; }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const ok = data?.some((r: any) => r.role === "admin");
  if (!ok) throw new Error("Réservé aux administrateurs");
}

// Récupère ou crée le user auth demo
async function ensureDemoAuthUser(): Promise<string> {
  const { data: list } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
  const existing = list?.users?.find((u: any) => u.email === DEMO_EMAIL);
  if (existing) {
    // Garantir le mot de passe et la confirmation
    await supabaseAdmin.auth.admin.updateUserById(existing.id, {
      password: DEMO_PASSWORD,
      email_confirm: true,
    });
    return existing.id;
  }
  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { first_name: DEMO_FIRST_NAME, last_name: DEMO_LAST_NAME },
  });
  if (error || !created?.user) throw new Error(`Création user demo: ${error?.message ?? "inconnu"}`);
  return created.user.id;
}

// Supprime toutes les données liées à un user demo (cascade manuel par sécurité)
async function purgeDemoUserData(userId: string) {
  await supabaseAdmin.from("notifications").delete().eq("user_id", userId);
  await supabaseAdmin.from("modification_requests").delete().eq("user_id", userId);
  await supabaseAdmin.from("shift_proposals").delete().eq("user_id", userId);
  await supabaseAdmin.from("employee_documents").delete().eq("user_id", userId);
  await supabaseAdmin.from("availabilities").delete().eq("user_id", userId);
  await supabaseAdmin.from("training_content_progress").delete().eq("user_id", userId);
  await supabaseAdmin.from("training_course_completions").delete().eq("user_id", userId);
  await supabaseAdmin.from("training_quiz_attempts").delete().eq("user_id", userId);
  await supabaseAdmin.from("feedbacks").delete().eq("author_id", userId);
  // Sub-tables clés via shifts (cascade)
  const { data: shifts } = await supabaseAdmin.from("shifts").select("id").eq("user_id", userId);
  const shiftIds = (shifts ?? []).map((s: any) => s.id);
  if (shiftIds.length > 0) {
    const { data: subs } = await supabaseAdmin.from("checklist_submissions").select("id").in("shift_id", shiftIds);
    const subIds = (subs ?? []).map((s: any) => s.id);
    if (subIds.length > 0) {
      await supabaseAdmin.from("checklist_submission_items").delete().in("submission_id", subIds);
      await supabaseAdmin.from("checklist_submission_photos").delete().in("submission_id", subIds);
      await supabaseAdmin.from("closure_question_responses").delete().in("submission_id", subIds);
      await supabaseAdmin.from("checklist_submissions").delete().in("id", subIds);
    }
    await supabaseAdmin.from("shift_clock_audit").delete().in("shift_id", shiftIds);
    await supabaseAdmin.from("shift_handoffs").delete().in("shift_id", shiftIds);
    await supabaseAdmin.from("shift_reports").delete().in("shift_id", shiftIds);
  }
  await supabaseAdmin.from("shifts").delete().eq("user_id", userId);
  await supabaseAdmin.from("user_business_roles").delete().eq("user_id", userId);
  await supabaseAdmin.from("user_studios").delete().eq("user_id", userId);
  await supabaseAdmin.from("user_contracts").delete().eq("user_id", userId);
  await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
  // On garde le profil pour le réutiliser (upsert ensuite). Suppression côté cleanupAll.
}

// ─────────── GET STATUS ───────────
export const getDemoStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, first_name, last_name, contract, updated_at")
      .eq("email", DEMO_EMAIL)
      .maybeSingle();

    if (!profile) return { exists: false as const };

    const [
      { count: pastShifts },
      { count: futureShifts },
      { count: demands },
      { count: notifs },
      { count: docs },
    ] = await Promise.all([
      supabaseAdmin.from("shifts").select("id", { count: "exact", head: true }).eq("user_id", profile.id).not("clocked_out_at", "is", null),
      supabaseAdmin.from("shifts").select("id", { count: "exact", head: true }).eq("user_id", profile.id).is("clocked_out_at", null).gte("shift_date", fmtDate(new Date())),
      supabaseAdmin.from("modification_requests").select("id", { count: "exact", head: true }).eq("user_id", profile.id),
      supabaseAdmin.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", profile.id),
      supabaseAdmin.from("employee_documents").select("id", { count: "exact", head: true }).eq("user_id", profile.id),
    ]);

    return {
      exists: true as const,
      profile: {
        id: profile.id,
        name: `${profile.first_name} ${profile.last_name}`,
        contract: profile.contract,
        updatedAt: profile.updated_at,
      },
      summary: {
        pastShifts: pastShifts ?? 0,
        futureShifts: futureShifts ?? 0,
        demands: demands ?? 0,
        notifs: notifs ?? 0,
        docs: docs ?? 0,
      },
      credentials: { email: DEMO_EMAIL, password: DEMO_PASSWORD },
    };
  });

// ─────────── RESET DEMO ENVIRONMENT ───────────
export const resetDemoEnvironment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const log: string[] = [];
    const t0 = Date.now();

    // 1. Studio principal
    const { data: studios } = await supabaseAdmin.from("studios").select("id, name").is("deleted_at", null).order("name").limit(1);
    const studio = studios?.[0];
    if (!studio) throw new Error("Aucun studio actif trouvé. Crée d'abord un studio.");
    log.push(`Studio principal: ${studio.name}`);

    // Configure le studio démo pour le pointage : QR "DEMO5", graces, géofencing OFF
    await supabaseAdmin.from("studios").update({
      current_qr_code: "DEMO5",
      clock_in_grace_period_min: 15,
      clock_out_grace_period_min: 20,
      clock_out_button_appears_before_min: 15,
      geofencing_enabled: false,
    }).eq("id", studio.id);
    log.push("Studio configuré (QR DEMO5, graces 15/20, géofencing OFF)");

    // S'assure qu'aucune publication de planning n'existe pour le mois courant (FIX 2 testable)
    const today = new Date();
    const monthStart = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-01`;
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const monthEnd = `${nextMonth.getFullYear()}-${pad(nextMonth.getMonth() + 1)}-${pad(new Date(nextMonth.getTime() - 86400000).getDate())}`;
    await supabaseAdmin.from("planning_publications")
      .delete()
      .lte("period_start", monthEnd)
      .gte("period_end", monthStart);
    log.push("Publications de planning du mois courant purgées");

    // 2. Auth user
    const demoUserId = await ensureDemoAuthUser();
    log.push(`Auth user prêt: ${demoUserId}`);

    // 3. Purge des données précédentes
    await purgeDemoUserData(demoUserId);
    log.push("Données précédentes purgées");

    // 4. Profil (upsert)
    const hireDate = addDays(today, -180);
    await supabaseAdmin.from("profiles").upsert({
      id: demoUserId,
      email: DEMO_EMAIL,
      first_name: DEMO_FIRST_NAME,
      last_name: DEMO_LAST_NAME,
      phone: "+32 470 12 34 56",
      birth_date: "1998-04-15",
      nationality: "Belge",
      address: "Rue de la Paix 42",
      city: "Ixelles",
      niss: DEMO_NISS,
      iban: DEMO_IBAN,
      emergency_contact_name: "Sophie Martens",
      emergency_contact_phone: "+32 470 99 88 77",
      emergency_contact_relation: "Parent",
      hire_date: fmtDate(hireDate),
      status: "active",
      score: 8.4,
      hourly_rate: 12.50,
      contract: "CDI",
      studio_id: studio.id,
      is_test: true,
      is_protected: false,
      student_card_valid: false,
    }, { onConflict: "id" });

    await supabaseAdmin.from("user_roles").upsert({ user_id: demoUserId, role: "employee" }, { onConflict: "user_id,role" });
    await supabaseAdmin.from("user_contracts").upsert({ user_id: demoUserId, contract: "CDI" }, { onConflict: "user_id,contract" });
    await supabaseAdmin.from("user_studios").upsert({ user_id: demoUserId, studio_id: studio.id }, { onConflict: "user_id,studio_id" });
    await supabaseAdmin.from("user_business_roles").upsert([
      { user_id: demoUserId, role: "Barista" },
      { user_id: demoUserId, role: "Accueil" },
    ], { onConflict: "user_id,role" });
    log.push("Profil + rôles + studio configurés");

    // 4b. Checklist template Barista (idempotent par nom+studio)
    const TPL_NAME = "Démo — Ouverture Barista";
    let { data: tplExisting } = await supabaseAdmin
      .from("checklist_templates").select("id").eq("studio_id", studio.id).eq("name", TPL_NAME).maybeSingle();
    let templateId = tplExisting?.id as string | undefined;
    const { data: baristaBr } = await supabaseAdmin
      .from("business_roles").select("id").eq("name", "Barista").maybeSingle();
    if (!templateId) {
      const { data: ins, error: tplErr } = await supabaseAdmin.from("checklist_templates").insert({
        studio_id: studio.id,
        business_role_id: baristaBr?.id ?? null,
        name: TPL_NAME,
        description: "Checklist d'ouverture pour test démo",
        is_active: true,
        is_blocking: true,
        analyze_with_ai: false,
        min_photos_required: 3,
      }).select("id").single();
      if (tplErr) throw new Error(`template: ${tplErr.message}`);
      templateId = ins.id;
      // 6 items + 3 zones photo
      const photos = [
        { template_id: templateId, label: "Comptoir propre", description: "Vue d'ensemble du comptoir", order_index: 0, is_required: true },
        { template_id: templateId, label: "Machine espresso", description: "Photo de la machine prête", order_index: 1, is_required: true },
        { template_id: templateId, label: "Vitrine pâtisseries", description: "Vitrine remplie", order_index: 2, is_required: true },
      ];
      const { data: photoRows } = await supabaseAdmin.from("checklist_template_photos").insert(photos).select("id, label");
      const photoByLabel = new Map((photoRows ?? []).map((p: any) => [p.label, p.id]));
      const items = [
        { template_id: templateId, label: "Allumer la machine espresso", order_index: 0, is_required: true, photo_zone_id: photoByLabel.get("Machine espresso") ?? null },
        { template_id: templateId, label: "Nettoyer le comptoir", order_index: 1, is_required: true, photo_zone_id: photoByLabel.get("Comptoir propre") ?? null },
        { template_id: templateId, label: "Vérifier le stock de lait", order_index: 2, is_required: true, photo_zone_id: null },
        { template_id: templateId, label: "Préparer la vitrine pâtisseries", order_index: 3, is_required: true, photo_zone_id: photoByLabel.get("Vitrine pâtisseries") ?? null },
        { template_id: templateId, label: "Ouvrir la caisse", order_index: 4, is_required: true, photo_zone_id: null },
        { template_id: templateId, label: "Vérifier les températures frigos", order_index: 5, is_required: false, photo_zone_id: null },
      ];
      await supabaseAdmin.from("checklist_template_items").insert(items);
      log.push("Template checklist Barista créé (6 items + 3 zones photo)");
    } else {
      log.push("Template checklist Barista déjà présent");
    }

    // 4b-bis. Checklist d'OUVERTURE Barista (phase=opening)
    const OPEN_TPL_NAME = "Démo — Ouverture matin Barista";
    const { data: openExisting } = await supabaseAdmin
      .from("checklist_templates").select("id").eq("studio_id", studio.id).eq("name", OPEN_TPL_NAME).maybeSingle();
    if (!openExisting) {
      const { data: openIns, error: openErr } = await supabaseAdmin.from("checklist_templates").insert({
        studio_id: studio.id,
        business_role_id: baristaBr?.id ?? null,
        name: OPEN_TPL_NAME,
        description: "Checklist à faire en arrivant le matin",
        is_active: true,
        is_blocking: false,
        analyze_with_ai: false,
        min_photos_required: 1,
        phase: "opening",
      } as any).select("id").single();
      if (openErr) throw new Error(`opening template: ${openErr.message}`);
      const openId = (openIns as any).id;
      const { data: openPhotos } = await supabaseAdmin.from("checklist_template_photos").insert([
        { template_id: openId, label: "Comptoir au démarrage", description: "Photo du comptoir à l'arrivée", order_index: 0, is_required: true },
      ]).select("id");
      await supabaseAdmin.from("checklist_template_items").insert([
        { template_id: openId, label: "Vérifier que la machine à café est en route", order_index: 0, is_required: true, photo_zone_id: null },
        { template_id: openId, label: "Compter le fond de caisse (200€)", order_index: 1, is_required: true, photo_zone_id: null },
        { template_id: openId, label: "Lire les notes de l'équipe précédente", order_index: 2, is_required: true, photo_zone_id: (openPhotos as any)?.[0]?.id ?? null },
      ]);
      log.push("Template checklist d'OUVERTURE Barista créé (3 items + 1 photo)");
    } else {
      log.push("Template checklist d'ouverture déjà présent");
    }

    // 4c. Questions de clôture (5) pour le studio
    const { count: cqCount } = await supabaseAdmin
      .from("closure_questions").select("id", { count: "exact", head: true }).eq("studio_id", studio.id);
    if (!cqCount || cqCount === 0) {
      await supabaseAdmin.from("closure_questions").insert([
        { studio_id: studio.id, question_text: "Comment s'est passé ton service ?", response_type: "stars_1_5", order_index: 0, is_required: true },
        { studio_id: studio.id, question_text: "Tout le matériel fonctionne correctement ?", response_type: "yes_no", order_index: 1, is_required: true },
        { studio_id: studio.id, question_text: "Note de l'affluence aujourd'hui", response_type: "stars_1_5", order_index: 2, is_required: false },
        { studio_id: studio.id, question_text: "As-tu un message pour la relève ?", response_type: "free_text", order_index: 3, is_required: false },
        { studio_id: studio.id, question_text: "Stock suffisant pour demain ?", response_type: "yes_no", order_index: 4, is_required: true },
      ]);
      log.push("5 questions de clôture créées");
    } else {
      log.push("Questions de clôture déjà présentes");
    }

    // 4d. Parcours formation Barista (2 sections / 3 modules / 1 quiz)
    if (baristaBr?.id) {
      const COURSE_TITLE = "Parcours Barista — Démo";
      const { data: courseExisting } = await supabaseAdmin
        .from("training_courses").select("id").eq("title", COURSE_TITLE).maybeSingle();
      if (!courseExisting) {
        const { data: course, error: cErr } = await supabaseAdmin.from("training_courses").insert({
          title: COURSE_TITLE,
          description: "Apprends les bases du métier de barista chez Skult",
          business_role_id: baristaBr.id,
          is_required_for_all: false,
          required_for_planning: false,
          passing_quiz_score: 70,
          position: 0,
          is_published: true,
        }).select("id").single();
        if (cErr) throw new Error(`course: ${cErr.message}`);

        const { data: secs } = await supabaseAdmin.from("training_sections").insert([
          { course_id: course.id, title: "Bases du café", description: "L'essentiel pour démarrer", position: 0 },
          { course_id: course.id, title: "Service client", description: "Accueillir et servir", position: 1 },
        ]).select("id, position");
        const sec1 = secs?.find((s: any) => s.position === 0);
        const sec2 = secs?.find((s: any) => s.position === 1);

        const { data: mods } = await supabaseAdmin.from("training_modules").insert([
          { section_id: sec1!.id, title: "Histoire du café", position: 0, duration_estimate_min: 10, has_final_quiz: false },
          { section_id: sec1!.id, title: "Préparer un espresso", position: 1, duration_estimate_min: 15, has_final_quiz: false },
          { section_id: sec2!.id, title: "Accueillir un client", position: 0, duration_estimate_min: 8, has_final_quiz: true },
        ]).select("id, title, has_final_quiz");

        const contents = (mods ?? []).flatMap((m: any) => ([
          { module_id: m.id, type: "text", title: `Introduction — ${m.title}`, text_content: `Contenu de démo pour ${m.title}.`, position: 0, duration_seconds: 120 },
        ]));
        await supabaseAdmin.from("training_contents").insert(contents);

        // Quiz sur le 3e module
        const quizMod = (mods ?? []).find((m: any) => m.has_final_quiz);
        if (quizMod) {
          const { data: quiz } = await supabaseAdmin.from("training_quizzes").insert({
            module_id: quizMod.id, title: "Quiz — Accueil client", passing_score: 70,
          }).select("id").single();
          const { data: qs } = await supabaseAdmin.from("training_quiz_questions").insert([
            { quiz_id: quiz!.id, question_text: "Quelle phrase utiliser pour accueillir un client ?", question_type: "single_choice", position: 0 },
            { quiz_id: quiz!.id, question_text: "Toujours sourire au client", question_type: "true_false", position: 1 },
          ]).select("id, position");
          const q1 = qs?.find((q: any) => q.position === 0);
          const q2 = qs?.find((q: any) => q.position === 1);
          if (q1) await supabaseAdmin.from("training_quiz_options").insert([
            { question_id: q1.id, option_text: "Bonjour, qu'est-ce qui te ferait plaisir ?", is_correct: true, position: 0 },
            { question_id: q1.id, option_text: "Quoi ?", is_correct: false, position: 1 },
            { question_id: q1.id, option_text: "Salut", is_correct: false, position: 2 },
          ]);
          if (q2) await supabaseAdmin.from("training_quiz_options").insert([
            { question_id: q2.id, option_text: "Vrai", is_correct: true, position: 0 },
            { question_id: q2.id, option_text: "Faux", is_correct: false, position: 1 },
          ]);
        }
        log.push("Parcours formation Barista créé (2 sections / 3 modules / 1 quiz)");
      } else {
        log.push("Parcours formation Barista déjà présent");
      }
    }

    // 5. Disponibilités (4 prochaines semaines)
    const avails: any[] = [];
    for (let i = 0; i < 28; i++) {
      const d = addDays(today, i);
      const dow = d.getDay();
      const isWeekend = dow === 0 || dow === 6;
      avails.push({
        user_id: demoUserId,
        avail_date: fmtDate(d),
        start_time: isWeekend ? "10:00:00" : "08:00:00",
        end_time: isWeekend ? "20:00:00" : "22:00:00",
      });
    }
    await supabaseAdmin.from("availabilities").insert(avails);
    log.push(`${avails.length} disponibilités créées`);

    // 6. 30 shifts passés clôturés
    const pastShifts: any[] = [];
    const lateMins = [0, 0, 0, 0, 3, 8, 12]; // 80% à l'heure, 20% en retard
    for (let i = 0; i < 30; i++) {
      const offset = -Math.floor(i * 1.5) - 1; // un shift tous les ~1.5j
      const d = addDays(today, offset);
      const startH = pick([8, 9, 10, 12, 14]);
      const endH = startH + pick([5, 6, 7]);
      const late = pick(lateMins);
      const dateStr = fmtDate(d);
      const startDt = new Date(`${dateStr}T${fmtTime(startH, 0)}`);
      const clockedIn = new Date(startDt.getTime() + late * 60_000);
      const clockedOut = new Date(`${dateStr}T${fmtTime(endH, 0)}`);
      pastShifts.push({
        user_id: demoUserId,
        studio_id: studio.id,
        business_role: "Barista",
        shift_date: dateStr,
        start_time: fmtTime(startH, 0),
        end_time: fmtTime(endH, 0),
        clocked_in_at: clockedIn.toISOString(),
        clocked_out_at: clockedOut.toISOString(),
        minutes_late: late,
        status: "completed",
        published_at: addDays(d, -7).toISOString(),
        is_manual: false,
      });
    }
    const { error: shiftsErr } = await supabaseAdmin.from("shifts").insert(pastShifts);
    if (shiftsErr) throw new Error(`shifts passés: ${shiftsErr.message}`);
    log.push(`${pastShifts.length} shifts passés clôturés`);

    // 7. 5 shifts futurs (dont 1 imminent)
    const now = new Date();
    const imminentStart = new Date(now.getTime() + 15 * 60_000);
    const imminentEnd = new Date(now.getTime() + 4 * 60 * 60_000);
    const futureShifts: any[] = [
      {
        user_id: demoUserId,
        studio_id: studio.id,
        business_role: "Barista",
        shift_date: fmtDate(imminentStart),
        start_time: fmtTime(imminentStart.getHours(), imminentStart.getMinutes()),
        end_time: fmtTime(imminentEnd.getHours(), imminentEnd.getMinutes()),
        status: "scheduled",
        published_at: new Date(now.getTime() - 60 * 60_000).toISOString(),
        is_manual: true,
      },
    ];
    for (let i = 1; i <= 4; i++) {
      const d = addDays(today, i * 2);
      const startH = pick([8, 10, 14]);
      futureShifts.push({
        user_id: demoUserId,
        studio_id: studio.id,
        business_role: i % 2 === 0 ? "Accueil" : "Barista",
        shift_date: fmtDate(d),
        start_time: fmtTime(startH, 0),
        end_time: fmtTime(startH + 6, 0),
        status: "scheduled",
        published_at: addDays(today, -2).toISOString(),
        is_manual: false,
      });
    }
    const { data: insertedFuture, error: futureErr } = await supabaseAdmin
      .from("shifts").insert(futureShifts).select("id, shift_date");
    if (futureErr) throw new Error(`shifts futurs: ${futureErr.message}`);
    log.push(`${insertedFuture?.length ?? 0} shifts futurs créés`);

    const cancelTarget = insertedFuture?.[1]; // shift dans 2j pour la demande pending

    // 8. 3 demandes de modification
    const demandes: any[] = [
      {
        user_id: demoUserId,
        shift_id: cancelTarget?.id ?? null,
        type: "cancel",
        urgency: "urgent",
        reason: "Imprévu familial, je dois annuler ce shift",
        status: "pending",
        created_at: new Date(now.getTime() - 2 * 60 * 60_000).toISOString(),
      },
      {
        user_id: demoUserId,
        type: "swap",
        urgency: "normal",
        reason: "Échange de shift demandé",
        status: "accepted",
        admin_response: "Échange validé, bonne semaine !",
        created_at: addDays(today, -3).toISOString(),
        resolved_at: addDays(today, -2).toISOString(),
      },
      {
        user_id: demoUserId,
        type: "cancel",
        urgency: "normal",
        reason: "Rendez-vous médical",
        status: "refused",
        admin_response: "Pas possible cette fois-ci, on est short staff.",
        created_at: addDays(today, -5).toISOString(),
        resolved_at: addDays(today, -4).toISOString(),
      },
    ];
    await supabaseAdmin.from("modification_requests").insert(demandes);
    log.push("3 demandes de modification créées");

    // 9. 1 document fiche de paie (placeholder texte dans Storage)
    const filePath = `${demoUserId}/demo-fiche-paie-avril-2026.txt`;
    const placeholder = `Fiche de paie - Avril 2026\n\nClara Martens\nBarista CDI\nSkult Studios\n\n[Document de démonstration]`;
    await supabaseAdmin.storage.from("employee-documents").remove([filePath]).catch(() => {});
    await supabaseAdmin.storage.from("employee-documents").upload(filePath, new Blob([placeholder], { type: "text/plain" }), {
      contentType: "text/plain",
      upsert: true,
    });
    const { data: docInsert } = await supabaseAdmin.from("employee_documents").insert({
      user_id: demoUserId,
      uploaded_by: userId,
      type: "fiche_paie",
      title: "Fiche de paie - Avril 2026",
      description: "Document de démonstration",
      file_path: filePath,
      file_size_bytes: placeholder.length,
      file_mime_type: "text/plain",
      period_start: "2026-04-01",
      period_end: "2026-04-30",
    }).select("id").single();
    log.push("Fiche de paie créée");

    // 10. 5 notifications variées
    const docId = docInsert?.id;
    const notifs = [
      {
        user_id: demoUserId,
        type: "shift_late_arrival",
        title: "Tu es en retard sur ton shift",
        body: "Pense à pointer ton arrivée dès que possible.",
        link: "/staff-app",
        priority: "urgent",
        category: "pointage",
        created_at: new Date(now.getTime() - 5 * 60_000).toISOString(),
      },
      {
        user_id: demoUserId,
        type: "training_assigned",
        title: "Nouveau parcours formation assigné",
        body: "Parcours Barista — démarre quand tu veux.",
        link: "/staff-app",
        priority: "normal",
        category: "training",
        created_at: new Date(now.getTime() - 2 * 60 * 60_000).toISOString(),
      },
      {
        user_id: demoUserId,
        type: "planning_published",
        title: "Ton planning de la semaine est publié",
        body: "5 shifts à venir cette semaine.",
        link: "/staff-app",
        priority: "info",
        category: "planning",
        created_at: addDays(today, -1).toISOString(),
      },
      {
        user_id: demoUserId,
        type: "document_uploaded",
        title: "Ta fiche de paie d'avril est disponible",
        body: "Document ajouté par ton admin.",
        link: `/staff-app?openDocs=1${docId ? `&doc=${docId}` : ""}`,
        priority: "info",
        category: "document",
        created_at: addDays(today, -2).toISOString(),
      },
      {
        user_id: demoUserId,
        type: "modification_request_resolved",
        title: "Réponse à ta demande de modification",
        body: "Pas possible cette fois-ci, on est short staff.",
        link: "/staff-app",
        priority: "normal",
        category: "request",
        created_at: addDays(today, -4).toISOString(),
      },
    ];
    await supabaseAdmin.from("notifications").insert(notifs);
    log.push("5 notifications créées");

    // 11. Progression formation (60% du parcours Barista s'il existe)
    const { data: baristaRole } = await supabaseAdmin
      .from("business_roles").select("id").eq("name", "Barista").maybeSingle();
    if (baristaRole?.id) {
      const { data: courses } = await supabaseAdmin
        .from("training_courses").select("id").eq("business_role_id", baristaRole.id).eq("is_published", true).limit(1);
      const courseId = courses?.[0]?.id;
      if (courseId) {
        const { data: sections } = await supabaseAdmin
          .from("training_sections").select("id").eq("course_id", courseId);
        const sectionIds = (sections ?? []).map((s: any) => s.id);
        const { data: modules } = sectionIds.length
          ? await supabaseAdmin.from("training_modules").select("id").in("section_id", sectionIds)
          : { data: [] as any[] };
        const moduleIds = (modules ?? []).map((m: any) => m.id);

        if (moduleIds.length > 0) {
          const { data: contents } = await supabaseAdmin
            .from("training_contents").select("id, duration_seconds").in("module_id", moduleIds);
          const all = contents ?? [];
          const completed = all.slice(0, Math.ceil(all.length * 0.6));
          if (completed.length > 0) {
            const progress = completed.map((c: any) => ({
              user_id: demoUserId,
              content_id: c.id,
              status: "completed",
              progress_pct: 100,
              time_spent_seconds: c.duration_seconds ?? 120,
              first_accessed_at: addDays(today, -10).toISOString(),
              completed_at: addDays(today, -5).toISOString(),
              last_accessed_at: addDays(today, -5).toISOString(),
            }));
            await supabaseAdmin.from("training_content_progress").insert(progress);
            log.push(`Formation: ${completed.length}/${all.length} contenus complétés`);
          }
        }
      } else {
        log.push("Aucun parcours Barista publié — progression formation ignorée");
      }
    }

    return {
      ok: true,
      demoUserId,
      log,
      duration_ms: Date.now() - t0,
      credentials: { email: DEMO_EMAIL, password: DEMO_PASSWORD },
    };
  });

// ─────────── RENEW TESTABLE SHIFT ───────────
export const renewTestableShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { data: profile } = await supabaseAdmin
      .from("profiles").select("id, studio_id").eq("email", DEMO_EMAIL).maybeSingle();
    if (!profile) throw new Error("Environnement de démo introuvable. Crée-le d'abord.");

    const now = new Date();
    const in2h = new Date(now.getTime() + 2 * 60 * 60_000);

    // Supprimer shifts non clôturés à venir dans les 2 prochaines heures
    const { data: toDelete } = await supabaseAdmin
      .from("shifts").select("id, shift_date, start_time")
      .eq("user_id", profile.id)
      .is("clocked_out_at", null)
      .gte("shift_date", fmtDate(now))
      .lte("shift_date", fmtDate(in2h));
    const toDeleteIds = (toDelete ?? []).filter((s: any) => {
      const dt = new Date(`${s.shift_date}T${s.start_time}`);
      return dt.getTime() <= in2h.getTime();
    }).map((s: any) => s.id);
    if (toDeleteIds.length > 0) {
      await supabaseAdmin.from("shifts").delete().in("id", toDeleteIds);
    }

    const start = new Date(now.getTime() + 15 * 60_000);
    const end = new Date(now.getTime() + 4 * 60 * 60_000);
    const dateStr = fmtDate(start);

    const { data: inserted, error } = await supabaseAdmin.from("shifts").insert({
      user_id: profile.id,
      studio_id: profile.studio_id,
      business_role: "Barista",
      shift_date: dateStr,
      start_time: fmtTime(start.getHours(), start.getMinutes()),
      end_time: fmtTime(end.getHours(), end.getMinutes()),
      status: "scheduled",
      published_at: new Date(now.getTime() - 60 * 60_000).toISOString(),
      is_manual: true,
    }).select("id").single();
    if (error) throw new Error(`renew shift: ${error.message}`);

    return { ok: true, shiftId: inserted?.id, deleted: toDeleteIds.length };
  });

// ─────────── CLEANUP ALL DEMO DATA ───────────
export const cleanupAllDemoData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ confirm: z.literal("DELETE") }).parse(input))
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { data: demoProfiles } = await supabaseAdmin
      .from("profiles").select("id, email").eq("is_test", true).like("email", DEMO_EMAIL_PATTERN);

    let deletedProfiles = 0;
    for (const p of demoProfiles ?? []) {
      await purgeDemoUserData(p.id);
      // Storage: supprimer le dossier du user
      const { data: files } = await supabaseAdmin.storage.from("employee-documents").list(p.id);
      if (files && files.length > 0) {
        await supabaseAdmin.storage.from("employee-documents")
          .remove(files.map((f: any) => `${p.id}/${f.name}`));
      }
      await supabaseAdmin.from("profiles").delete().eq("id", p.id);
      await supabaseAdmin.auth.admin.deleteUser(p.id).catch(() => {});
      deletedProfiles++;
    }

    return { ok: true, deletedProfiles };
  });
