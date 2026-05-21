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

    // 2. Auth user
    const demoUserId = await ensureDemoAuthUser();
    log.push(`Auth user prêt: ${demoUserId}`);

    // 3. Purge des données précédentes
    await purgeDemoUserData(demoUserId);
    log.push("Données précédentes purgées");

    // 4. Profil (upsert)
    const today = new Date();
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
        const { data: modules } = await supabaseAdmin
          .from("training_modules").select("id").eq("course_id", courseId);
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
