import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdminOrManager } from "./formation.server";

// ============================================
// INDEX (KPIs + list of courses with team stats)
// ============================================
export const getFormationIndex = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdminOrManager(supabase, userId);

    const [coursesRes, modulesRes, sectionsRes, employeesRes, ubrRes, progressRes, attemptsRes, completionsRes] = await Promise.all([
      supabase.from("training_courses").select("*").order("position"),
      supabase.from("training_modules").select("id, section_id, duration_estimate_min"),
      supabase.from("training_sections").select("id, course_id"),
      supabase.from("profiles").select("id").eq("status", "active"),
      supabase.from("user_business_roles").select("user_id, role"),
      supabase.from("training_content_progress").select("user_id, last_accessed_at, status, content_id"),
      supabase.from("training_quiz_attempts").select("attempt_number, passed, completed_at"),
      supabase.from("training_course_completions").select("user_id, course_id"),
    ]);

    const courses = (coursesRes.data ?? []) as any[];
    const modules = (modulesRes.data ?? []) as any[];
    const sections = (sectionsRes.data ?? []) as any[];
    const employees = (employeesRes.data ?? []) as any[];
    const ubr = (ubrRes.data ?? []) as any[];
    const progress = (progressRes.data ?? []) as any[];
    const attempts = (attemptsRes.data ?? []) as any[];
    const completions = (completionsRes.data ?? []) as any[];

    // business_roles map
    const { data: roles } = await supabase.from("business_roles").select("id, name");
    const roleNameById = new Map<string, string>((roles ?? []).map((r: any) => [r.id, r.name]));

    // user role names by user_id
    const userRoles = new Map<string, Set<string>>();
    for (const r of ubr) {
      if (!userRoles.has(r.user_id)) userRoles.set(r.user_id, new Set());
      userRoles.get(r.user_id)!.add(r.role);
    }

    // section -> course
    const sectionToCourse = new Map<string, string>(sections.map((s: any) => [s.id, s.course_id]));
    // modules per course
    const modulesPerCourse = new Map<string, any[]>();
    for (const m of modules) {
      const cid = sectionToCourse.get(m.section_id);
      if (!cid) continue;
      if (!modulesPerCourse.has(cid)) modulesPerCourse.set(cid, []);
      modulesPerCourse.get(cid)!.push(m);
    }

    // completions per course/user
    const completionsByCourse = new Map<string, Set<string>>();
    for (const c of completions) {
      if (!completionsByCourse.has(c.course_id)) completionsByCourse.set(c.course_id, new Set());
      completionsByCourse.get(c.course_id)!.add(c.user_id);
    }

    // KPI 1 — published courses + total modules
    const publishedCourses = courses.filter(c => c.is_published);
    const totalModules = modules.length;

    // KPI 2 — employees in training (active progress in 30 days)
    const cutoff = Date.now() - 30 * 86400_000;
    const activeUsers = new Set(
      progress.filter(p => p.last_accessed_at && new Date(p.last_accessed_at).getTime() > cutoff && p.status !== "completed").map(p => p.user_id)
    );
    const totalEmployees = employees.length || 1;
    const pctInTraining = Math.round((activeUsers.size / totalEmployees) * 100);

    // KPI 3 — average completion rate across published courses
    const ratesPerCourse: number[] = [];
    for (const c of publishedCourses) {
      const targetUsers = c.is_required_for_all
        ? employees
        : c.business_role_id
          ? employees.filter(e => {
              const roleName = roleNameById.get(c.business_role_id);
              return roleName && userRoles.get(e.id)?.has(roleName);
            })
          : [];
      if (targetUsers.length === 0) continue;
      const done = (completionsByCourse.get(c.id)?.size) ?? 0;
      ratesPerCourse.push((done / targetUsers.length) * 100);
    }
    const avgCompletionRate = ratesPerCourse.length > 0
      ? Math.round(ratesPerCourse.reduce((a, b) => a + b, 0) / ratesPerCourse.length)
      : 0;

    // KPI 4 — quiz first-try pass rate (this month)
    const monthAgo = Date.now() - 30 * 86400_000;
    const recentAttempts = attempts.filter(a => a.completed_at && new Date(a.completed_at).getTime() > monthAgo);
    const firstTryPassed = recentAttempts.filter(a => a.attempt_number === 1 && a.passed === true).length;
    const firstTryRate = recentAttempts.length > 0
      ? Math.round((firstTryPassed / recentAttempts.length) * 100)
      : 0;

    // Per-course stats
    const courseCards = courses.map((c: any) => {
      const courseMods = modulesPerCourse.get(c.id) ?? [];
      const totalMin = courseMods.reduce((acc, m) => acc + (m.duration_estimate_min ?? 0), 0);
      const targetUsers = c.is_required_for_all
        ? employees
        : c.business_role_id
          ? employees.filter(e => {
              const roleName = roleNameById.get(c.business_role_id);
              return roleName && userRoles.get(e.id)?.has(roleName);
            })
          : [];
      const done = (completionsByCourse.get(c.id)?.size) ?? 0;
      const pct = targetUsers.length > 0 ? Math.round((done / targetUsers.length) * 100) : 0;
      return {
        ...c,
        moduleCount: courseMods.length,
        totalMinutes: totalMin,
        targetCount: targetUsers.length,
        completedCount: done,
        pct,
        businessRoleName: c.business_role_id ? roleNameById.get(c.business_role_id) ?? null : null,
      };
    });

    return {
      kpis: {
        publishedCourses: publishedCourses.length,
        totalModules,
        inTrainingCount: activeUsers.size,
        totalEmployees: employees.length,
        pctInTraining,
        avgCompletionRate,
        firstTryRate,
      },
      courses: courseCards,
    };
  });

// ============================================
// CRUD
// ============================================
export const createCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    title: z.string().trim().min(1).max(120),
    businessRoleId: z.string().uuid().nullable().optional(),
    isRequiredForAll: z.boolean().optional(),
    icon: z.string().max(8).nullable().optional(),
    color: z.string().max(16).nullable().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdminOrManager(supabase, userId);

    const { data: existing } = await supabase
      .from("training_courses").select("position")
      .order("position", { ascending: false }).limit(1);
    const nextPos = ((existing as any)?.[0]?.position ?? -1) + 1;

    const { data: row, error } = await supabase.from("training_courses").insert({
      title: data.title,
      business_role_id: data.businessRoleId ?? null,
      is_required_for_all: data.isRequiredForAll ?? false,
      icon: data.icon ?? "📚",
      color: data.color ?? "#F0997B",
      position: nextPos,
      is_published: false,
    } as any).select("id").single();

    if (error || !row) throw new Error(error?.message ?? "Création échouée");
    return { id: (row as any).id };
  });

export const deleteCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ courseId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdminOrManager(supabase, userId);
    const { error } = await supabase.from("training_courses").delete().eq("id", data.courseId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const duplicateCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ courseId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdminOrManager(supabase, userId);

    const { data: src } = await supabase.from("training_courses").select("*").eq("id", data.courseId).maybeSingle();
    if (!src) throw new Error("Parcours introuvable");
    const s = src as any;
    const { data: copy, error: e1 } = await supabase.from("training_courses").insert({
      title: `${s.title} (copie)`,
      description: s.description,
      icon: s.icon,
      color: s.color,
      business_role_id: s.business_role_id,
      is_required_for_all: s.is_required_for_all,
      required_for_planning: s.required_for_planning,
      passing_quiz_score: s.passing_quiz_score,
      position: s.position + 1,
      is_published: false,
    } as any).select("id").single();
    if (e1 || !copy) throw new Error(e1?.message ?? "Copie échouée");

    const newCourseId = (copy as any).id;

    const { data: sections } = await supabase.from("training_sections").select("*").eq("course_id", data.courseId).order("position");
    for (const sec of (sections ?? []) as any[]) {
      const { data: newSec } = await supabase.from("training_sections").insert({
        course_id: newCourseId, title: sec.title, description: sec.description, position: sec.position,
      } as any).select("id").single();
      if (!newSec) continue;
      const newSecId = (newSec as any).id;

      const { data: modules } = await supabase.from("training_modules").select("*").eq("section_id", sec.id).order("position");
      for (const mod of (modules ?? []) as any[]) {
        const { data: newMod } = await supabase.from("training_modules").insert({
          section_id: newSecId, title: mod.title, description: mod.description, position: mod.position,
          duration_estimate_min: mod.duration_estimate_min, has_final_quiz: mod.has_final_quiz,
        } as any).select("id").single();
        if (!newMod) continue;
        const newModId = (newMod as any).id;

        const { data: contents } = await supabase.from("training_contents").select("*").eq("module_id", mod.id).order("position");
        if (contents && contents.length > 0) {
          await supabase.from("training_contents").insert(
            (contents as any[]).map((c) => ({
              module_id: newModId, type: c.type, title: c.title, description: c.description,
              url: c.url, external_url: c.external_url, text_content: c.text_content,
              duration_seconds: c.duration_seconds, position: c.position,
            }))
          );
        }
      }
    }

    return { id: newCourseId };
  });

// ============================================
// EMPLOYEE TRAINING TRACKING (admin view)
// ============================================
export const getEmployeeTrainingProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ userId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdminOrManager(supabase, userId);

    const [coursesRes, ubrRes, brRes, sectionsRes, modulesRes, contentsRes, quizzesRes, questionsRes, optionsRes, progressRes, attemptsRes, answersRes, completionsRes] = await Promise.all([
      supabase.from("training_courses").select("*").eq("is_published", true).order("position"),
      supabase.from("user_business_roles").select("role").eq("user_id", data.userId),
      supabase.from("business_roles").select("id, name"),
      supabase.from("training_sections").select("*").order("position"),
      supabase.from("training_modules").select("*").order("position"),
      supabase.from("training_contents").select("*").order("position"),
      supabase.from("training_quizzes").select("*"),
      supabase.from("training_quiz_questions").select("*").order("position"),
      supabase.from("training_quiz_options").select("*").order("position"),
      supabase.from("training_content_progress").select("*").eq("user_id", data.userId),
      supabase.from("training_quiz_attempts").select("*").eq("user_id", data.userId).order("attempt_number"),
      supabase.from("training_quiz_answers").select("*"),
      supabase.from("training_course_completions").select("*").eq("user_id", data.userId),
    ]);

    const courses = (coursesRes.data ?? []) as any[];
    const userRoleNames = new Set(((ubrRes.data ?? []) as any[]).map((r: any) => r.role));
    const brById = new Map<string, string>(((brRes.data ?? []) as any[]).map((r: any) => [r.id, r.name]));

    // Filter applicable courses
    const applicable = courses.filter((c: any) =>
      c.is_required_for_all || (c.business_role_id && userRoleNames.has(brById.get(c.business_role_id) ?? ""))
    );

    const allSections = (sectionsRes.data ?? []) as any[];
    const allModules = (modulesRes.data ?? []) as any[];
    const allContents = (contentsRes.data ?? []) as any[];
    const allQuizzes = (quizzesRes.data ?? []) as any[];
    const allQuestions = (questionsRes.data ?? []) as any[];
    const allOptions = (optionsRes.data ?? []) as any[];
    const progressMap = new Map<string, any>(((progressRes.data ?? []) as any[]).map((p: any) => [p.content_id, p]));
    const attemptsByQuiz = new Map<string, any[]>();
    for (const a of (attemptsRes.data ?? []) as any[]) {
      if (!attemptsByQuiz.has(a.quiz_id)) attemptsByQuiz.set(a.quiz_id, []);
      attemptsByQuiz.get(a.quiz_id)!.push(a);
    }
    const answersByAttempt = new Map<string, any[]>();
    for (const ans of (answersRes.data ?? []) as any[]) {
      if (!answersByAttempt.has(ans.attempt_id)) answersByAttempt.set(ans.attempt_id, []);
      answersByAttempt.get(ans.attempt_id)!.push(ans);
    }
    const completedCourseIds = new Set(((completionsRes.data ?? []) as any[]).map((c: any) => c.course_id));
    const completions = (completionsRes.data ?? []) as any[];

    let totalTimeSpent = 0;
    let lastAccess: string | null = null;

    const result = applicable.map((course: any) => {
      const courseSections = allSections.filter((s: any) => s.course_id === course.id);
      let totalContents = 0;
      let completedContents = 0;
      let courseTime = 0;

      const sectionsOut = courseSections.map((sec: any) => {
        const secModules = allModules.filter((m: any) => m.section_id === sec.id);
        const modulesOut = secModules.map((mod: any) => {
          const modContents = allContents.filter((c: any) => c.module_id === mod.id);
          const contentsOut = modContents.map((c: any) => {
            const p = progressMap.get(c.id);
            totalContents++;
            if (p?.status === "completed") completedContents++;
            if (p?.time_spent_seconds) {
              courseTime += p.time_spent_seconds;
              totalTimeSpent += p.time_spent_seconds;
            }
            if (p?.last_accessed_at && (!lastAccess || p.last_accessed_at > lastAccess)) {
              lastAccess = p.last_accessed_at;
            }
            return {
              content: c,
              status: p?.status ?? "not_started",
              progress_pct: p?.progress_pct ?? 0,
              time_spent_seconds: p?.time_spent_seconds ?? 0,
              first_accessed_at: p?.first_accessed_at ?? null,
              last_accessed_at: p?.last_accessed_at ?? null,
              completed_at: p?.completed_at ?? null,
            };
          });

          // Quiz
          const quiz = allQuizzes.find((q: any) => q.module_id === mod.id) ?? null;
          let quizOut: any = null;
          if (quiz) {
            const quizQuestions = allQuestions.filter((q: any) => q.quiz_id === quiz.id);
            const attempts = (attemptsByQuiz.get(quiz.id) ?? []).map((a: any) => {
              const answers = (answersByAttempt.get(a.id) ?? []).map((ans: any) => {
                const q = quizQuestions.find((qq: any) => qq.id === ans.question_id);
                const opts = q ? allOptions.filter((o: any) => o.question_id === q.id) : [];
                return {
                  question: q ? { id: q.id, text: q.question_text, options: opts } : null,
                  selected_option_ids: ans.selected_option_ids,
                  is_correct: ans.is_correct,
                };
              });
              return { ...a, answers };
            });
            const scores = attempts.filter(a => a.score != null).map(a => a.score);
            const passed = attempts.some(a => a.passed === true);
            quizOut = {
              quiz,
              attempts,
              best_score: scores.length > 0 ? Math.max(...scores) : null,
              passed,
            };
          }

          const modCompletedAll = contentsOut.length > 0 && contentsOut.every(c => c.status === "completed");
          const modStatus = modCompletedAll && (!quiz || quizOut?.passed)
            ? "completed"
            : contentsOut.some(c => c.status !== "not_started") || (quizOut?.attempts?.length ?? 0) > 0
              ? "in_progress"
              : "not_started";

          const modPct = contentsOut.length > 0
            ? Math.round((contentsOut.filter(c => c.status === "completed").length / contentsOut.length) * 100)
            : 0;

          return { module: mod, status: modStatus, progress_pct: modPct, contents: contentsOut, quiz: quizOut };
        });
        return { section: sec, modules: modulesOut };
      });

      const courseCompleted = completedCourseIds.has(course.id);
      const courseStatus = courseCompleted
        ? "completed"
        : completedContents > 0
          ? "in_progress"
          : "not_started";
      const coursePct = totalContents > 0 ? Math.round((completedContents / totalContents) * 100) : 0;
      const completion = completions.find((cc: any) => cc.course_id === course.id);

      return {
        course,
        status: courseStatus,
        progress_pct: coursePct,
        total_time_spent_seconds: courseTime,
        total_contents: totalContents,
        completed_contents: completedContents,
        completed_at: completion?.completed_at ?? null,
        sections: sectionsOut,
      };
    });

    const completedCount = result.filter(r => r.status === "completed").length;

    return {
      summary: {
        completedCourses: completedCount,
        totalCourses: result.length,
        totalTimeSpentSeconds: totalTimeSpent,
        lastAccessAt: lastAccess,
      },
      courses: result,
    };
  });

// ============================================
// COURSE BUILDER (full structure + CRUD)
// ============================================
export const getCourseFullStructure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ courseId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdminOrManager(supabase, userId);

    const [courseRes, sectionsRes, modulesRes, contentsRes, quizzesRes, questionsRes, optionsRes, rolesRes] = await Promise.all([
      supabase.from("training_courses").select("*").eq("id", data.courseId).maybeSingle(),
      supabase.from("training_sections").select("*").eq("course_id", data.courseId).order("position"),
      supabase.from("training_modules").select("*").order("position"),
      supabase.from("training_contents").select("*").order("position"),
      supabase.from("training_quizzes").select("*"),
      supabase.from("training_quiz_questions").select("*").order("position"),
      supabase.from("training_quiz_options").select("*").order("position"),
      supabase.from("business_roles").select("id, name"),
    ]);
    if (!courseRes.data) throw new Error("Parcours introuvable");

    const sections = (sectionsRes.data ?? []) as any[];
    const sectionIds = new Set(sections.map((s) => s.id));
    const modules = ((modulesRes.data ?? []) as any[]).filter((m) => sectionIds.has(m.section_id));
    const moduleIds = new Set(modules.map((m) => m.id));
    const contents = ((contentsRes.data ?? []) as any[]).filter((c) => moduleIds.has(c.module_id));
    const quizzes = ((quizzesRes.data ?? []) as any[]).filter((q) => moduleIds.has(q.module_id));
    const quizIds = new Set(quizzes.map((q) => q.id));
    const questions = ((questionsRes.data ?? []) as any[]).filter((q) => quizIds.has(q.quiz_id));
    const questionIds = new Set(questions.map((q) => q.id));
    const options = ((optionsRes.data ?? []) as any[]).filter((o) => questionIds.has(o.question_id));

    return {
      course: courseRes.data as any,
      businessRoles: (rolesRes.data ?? []) as any[],
      sections: sections.map((sec) => {
        const secModules = modules.filter((m) => m.section_id === sec.id);
        return {
          ...sec,
          modules: secModules.map((mod) => {
            const modContents = contents.filter((c) => c.module_id === mod.id);
            const quiz = quizzes.find((q) => q.module_id === mod.id) ?? null;
            const quizQs = quiz ? questions.filter((q) => q.quiz_id === quiz.id) : [];
            return {
              ...mod,
              contents: modContents,
              quiz: quiz
                ? {
                    ...quiz,
                    questions: quizQs.map((qq) => ({
                      ...qq,
                      options: options.filter((o) => o.question_id === qq.id),
                    })),
                  }
                : null,
            };
          }),
        };
      }),
    };
  });

export const updateCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    courseId: z.string().uuid(),
    patch: z.object({
      title: z.string().trim().min(1).max(120).optional(),
      description: z.string().max(2000).nullable().optional(),
      icon: z.string().max(8).nullable().optional(),
      color: z.string().max(16).nullable().optional(),
      business_role_id: z.string().uuid().nullable().optional(),
      is_required_for_all: z.boolean().optional(),
      required_for_planning: z.boolean().optional(),
      passing_quiz_score: z.number().int().min(0).max(100).optional(),
    }),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdminOrManager(supabase, userId);
    const { error } = await supabase.from("training_courses").update(data.patch as any).eq("id", data.courseId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const publishCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ courseId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdminOrManager(supabase, userId);

    const { data: course } = await supabase.from("training_courses").select("*").eq("id", data.courseId).maybeSingle();
    if (!course) throw new Error("Parcours introuvable");

    const { data: sections } = await supabase.from("training_sections").select("id").eq("course_id", data.courseId);
    if (!sections || sections.length === 0) throw new Error("Le parcours est vide, impossible de publier");
    const { data: modules } = await supabase.from("training_modules").select("id, section_id").in("section_id", sections.map((s: any) => s.id));
    if (!modules || modules.length === 0) throw new Error("Le parcours est vide, impossible de publier");
    const { data: contents } = await supabase.from("training_contents").select("id").in("module_id", modules.map((m: any) => m.id));
    if (!contents || contents.length === 0) throw new Error("Le parcours est vide, impossible de publier");

    const { error } = await supabase.from("training_courses").update({ is_published: true } as any).eq("id", data.courseId);
    if (error) throw new Error(error.message);

    // Notify concerned employees
    const c = course as any;
    let targetIds: string[] = [];
    if (c.is_required_for_all) {
      const { data: emps } = await supabase.from("profiles").select("id").eq("status", "active");
      targetIds = (emps ?? []).map((e: any) => e.id);
    } else if (c.business_role_id) {
      const { data: role } = await supabase.from("business_roles").select("name").eq("id", c.business_role_id).maybeSingle();
      if (role) {
        const { data: ubr } = await supabase.from("user_business_roles").select("user_id").eq("role", (role as any).name);
        targetIds = Array.from(new Set((ubr ?? []).map((u: any) => u.user_id)));
      }
    }
    if (targetIds.length > 0) {
      await supabase.from("notifications").insert(
        targetIds.map((uid) => ({
          user_id: uid,
          type: "training_assigned",
          title: "Nouveau parcours de formation",
          body: `${c.icon ?? "📚"} ${c.title} est disponible.`,
          link: "/staff-app?tab=formation",
        })) as any
      );
    }
    return { ok: true, notified: targetIds.length };
  });

export const unpublishCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ courseId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdminOrManager(supabase, userId);
    const { error } = await supabase.from("training_courses").update({ is_published: false } as any).eq("id", data.courseId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Sections ----------
export const createSection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    courseId: z.string().uuid(),
    title: z.string().trim().min(1).max(120),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdminOrManager(supabase, userId);
    const { data: last } = await supabase.from("training_sections").select("position").eq("course_id", data.courseId).order("position", { ascending: false }).limit(1);
    const nextPos = ((last as any)?.[0]?.position ?? -1) + 1;
    const { data: row, error } = await supabase.from("training_sections").insert({ course_id: data.courseId, title: data.title, position: nextPos } as any).select("id").single();
    if (error || !row) throw new Error(error?.message ?? "Création échouée");
    return { id: (row as any).id };
  });

export const updateSection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    sectionId: z.string().uuid(),
    title: z.string().trim().min(1).max(120).optional(),
    description: z.string().max(2000).nullable().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdminOrManager(supabase, userId);
    const { sectionId, ...patch } = data;
    const { error } = await supabase.from("training_sections").update(patch as any).eq("id", sectionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ sectionId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdminOrManager(supabase, userId);
    const { error } = await supabase.from("training_sections").delete().eq("id", data.sectionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reorderSections = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    courseId: z.string().uuid(),
    orderedIds: z.array(z.string().uuid()).min(1).max(50),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdminOrManager(supabase, userId);
    for (let i = 0; i < data.orderedIds.length; i++) {
      await supabase.from("training_sections").update({ position: i } as any).eq("id", data.orderedIds[i]).eq("course_id", data.courseId);
    }
    return { ok: true };
  });

// ---------- Modules ----------
export const createModule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    sectionId: z.string().uuid(),
    title: z.string().trim().min(1).max(120),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdminOrManager(supabase, userId);
    const { data: last } = await supabase.from("training_modules").select("position").eq("section_id", data.sectionId).order("position", { ascending: false }).limit(1);
    const nextPos = ((last as any)?.[0]?.position ?? -1) + 1;
    const { data: row, error } = await supabase.from("training_modules").insert({ section_id: data.sectionId, title: data.title, position: nextPos } as any).select("id").single();
    if (error || !row) throw new Error(error?.message ?? "Création échouée");
    return { id: (row as any).id };
  });

export const updateModule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    moduleId: z.string().uuid(),
    title: z.string().trim().min(1).max(120).optional(),
    description: z.string().max(2000).nullable().optional(),
    duration_estimate_min: z.number().int().min(0).max(600).nullable().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdminOrManager(supabase, userId);
    const { moduleId, ...patch } = data;
    const { error } = await supabase.from("training_modules").update(patch as any).eq("id", moduleId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteModule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ moduleId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdminOrManager(supabase, userId);
    const { error } = await supabase.from("training_modules").delete().eq("id", data.moduleId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reorderModules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    sectionId: z.string().uuid(),
    orderedIds: z.array(z.string().uuid()).min(1).max(50),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdminOrManager(supabase, userId);
    for (let i = 0; i < data.orderedIds.length; i++) {
      await supabase.from("training_modules").update({ position: i } as any).eq("id", data.orderedIds[i]).eq("section_id", data.sectionId);
    }
    return { ok: true };
  });

// ---------- Contents ----------
const contentTypeSchema = z.enum(["video", "pdf", "image", "text"]);

export const createContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    moduleId: z.string().uuid(),
    type: contentTypeSchema,
    title: z.string().trim().min(1).max(160),
    description: z.string().max(2000).nullable().optional(),
    url: z.string().url().nullable().optional(),
    external_url: z.string().url().nullable().optional(),
    text_content: z.string().max(20000).nullable().optional(),
    duration_seconds: z.number().int().min(0).max(36000).nullable().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdminOrManager(supabase, userId);
    const { data: last } = await supabase.from("training_contents").select("position").eq("module_id", data.moduleId).order("position", { ascending: false }).limit(1);
    const nextPos = ((last as any)?.[0]?.position ?? -1) + 1;
    const { moduleId, ...rest } = data;
    const { data: row, error } = await supabase.from("training_contents").insert({ module_id: moduleId, position: nextPos, ...rest } as any).select("id").single();
    if (error || !row) throw new Error(error?.message ?? "Création échouée");
    return { id: (row as any).id };
  });

export const updateContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    contentId: z.string().uuid(),
    title: z.string().trim().min(1).max(160).optional(),
    description: z.string().max(2000).nullable().optional(),
    url: z.string().url().nullable().optional(),
    external_url: z.string().url().nullable().optional(),
    text_content: z.string().max(20000).nullable().optional(),
    duration_seconds: z.number().int().min(0).max(36000).nullable().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdminOrManager(supabase, userId);
    const { contentId, ...patch } = data;
    const { error } = await supabase.from("training_contents").update(patch as any).eq("id", contentId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ contentId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdminOrManager(supabase, userId);
    const { error } = await supabase.from("training_contents").delete().eq("id", data.contentId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reorderContents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    moduleId: z.string().uuid(),
    orderedIds: z.array(z.string().uuid()).min(1).max(100),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdminOrManager(supabase, userId);
    for (let i = 0; i < data.orderedIds.length; i++) {
      await supabase.from("training_contents").update({ position: i } as any).eq("id", data.orderedIds[i]).eq("module_id", data.moduleId);
    }
    return { ok: true };
  });

// ---------- Quiz ----------
const quizQuestionSchema = z.object({
  question_text: z.string().trim().min(1).max(500),
  question_type: z.enum(["single_choice", "multiple_choice", "true_false"]),
  explanation: z.string().max(1000).nullable().optional(),
  options: z.array(z.object({
    option_text: z.string().trim().min(1).max(300),
    is_correct: z.boolean(),
  })).min(2).max(8),
});

export const createOrUpdateQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    moduleId: z.string().uuid(),
    title: z.string().trim().min(1).max(160),
    passing_score: z.number().int().min(0).max(100),
    questions: z.array(quizQuestionSchema).max(50),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdminOrManager(supabase, userId);

    let quizId: string;
    const { data: existing } = await supabase.from("training_quizzes").select("id").eq("module_id", data.moduleId).maybeSingle();
    if (existing) {
      quizId = (existing as any).id;
      await supabase.from("training_quizzes").update({ title: data.title, passing_score: data.passing_score } as any).eq("id", quizId);
      // wipe existing questions (cascade deletes options)
      await supabase.from("training_quiz_questions").delete().eq("quiz_id", quizId);
    } else {
      const { data: row, error } = await supabase.from("training_quizzes").insert({ module_id: data.moduleId, title: data.title, passing_score: data.passing_score } as any).select("id").single();
      if (error || !row) throw new Error(error?.message ?? "Création échouée");
      quizId = (row as any).id;
      await supabase.from("training_modules").update({ has_final_quiz: true } as any).eq("id", data.moduleId);
    }

    for (let i = 0; i < data.questions.length; i++) {
      const q = data.questions[i];
      const { data: qRow, error: qErr } = await supabase.from("training_quiz_questions").insert({
        quiz_id: quizId,
        question_text: q.question_text,
        question_type: q.question_type,
        explanation: q.explanation ?? null,
        position: i,
      } as any).select("id").single();
      if (qErr || !qRow) throw new Error(qErr?.message ?? "Question");
      const qid = (qRow as any).id;
      if (q.options.length > 0) {
        await supabase.from("training_quiz_options").insert(
          q.options.map((opt, oi) => ({ question_id: qid, option_text: opt.option_text, is_correct: opt.is_correct, position: oi })) as any
        );
      }
    }
    return { ok: true, quizId };
  });

export const deleteQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ moduleId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdminOrManager(supabase, userId);
    await supabase.from("training_quizzes").delete().eq("module_id", data.moduleId);
    await supabase.from("training_modules").update({ has_final_quiz: false } as any).eq("id", data.moduleId);
    return { ok: true };
  });

// ============================================================
// ============== EMPLOYEE SIDE (Prompt C) ====================
// ============================================================

// Helper — applicable courses for a user (in-handler use)
async function applicableCoursesForUser(supabase: any, uid: string) {
  const [{ data: courses }, { data: ubr }, { data: roles }] = await Promise.all([
    supabase.from("training_courses").select("*").eq("is_published", true).order("position"),
    supabase.from("user_business_roles").select("role").eq("user_id", uid),
    supabase.from("business_roles").select("id, name"),
  ]);
  const roleNameById = new Map<string, string>(((roles ?? []) as any[]).map((r: any) => [r.id, r.name]));
  const userRoleNames = new Set(((ubr ?? []) as any[]).map((r: any) => r.role));
  return ((courses ?? []) as any[]).filter((c: any) =>
    c.is_required_for_all || (c.business_role_id && userRoleNames.has(roleNameById.get(c.business_role_id) ?? ""))
  );
}

async function computeAssignedCoursesFor(supabase: any, userId: string) {
  const applicable = await applicableCoursesForUser(supabase, userId);
  if (applicable.length === 0) {
    return { courses: [], summary: { totalCourses: 0, completedCourses: 0, totalModules: 0, completedModules: 0, progressPct: 0, lockedPlanning: false, blockingCourses: [] as any[], lastAccessAt: null as string | null } };
  }
  const courseIds = applicable.map((c: any) => c.id);

  const [{ data: sections }, { data: completions }] = await Promise.all([
    supabase.from("training_sections").select("id, course_id").in("course_id", courseIds),
    supabase.from("training_course_completions").select("course_id, completed_at").eq("user_id", userId),
  ]);
  const sectionIds = ((sections ?? []) as any[]).map((s: any) => s.id);
  const { data: modules } = sectionIds.length > 0
    ? await supabase.from("training_modules").select("id, section_id").in("section_id", sectionIds)
    : { data: [] as any[] };
  const moduleIds = ((modules ?? []) as any[]).map((m: any) => m.id);
  const [{ data: contents }, { data: quizzes }, { data: progress }, { data: attempts }] = await Promise.all([
    moduleIds.length > 0 ? supabase.from("training_contents").select("id, module_id").in("module_id", moduleIds) : Promise.resolve({ data: [] }),
    moduleIds.length > 0 ? supabase.from("training_quizzes").select("id, module_id").in("module_id", moduleIds) : Promise.resolve({ data: [] }),
    supabase.from("training_content_progress").select("content_id, status, last_accessed_at").eq("user_id", userId),
    supabase.from("training_quiz_attempts").select("quiz_id, passed").eq("user_id", userId),
  ]);

  const sectionToCourse = new Map<string, string>(((sections ?? []) as any[]).map((s: any) => [s.id, s.course_id]));
  const modulesByCourse = new Map<string, any[]>();
  for (const m of (modules ?? []) as any[]) {
    const cid = sectionToCourse.get(m.section_id);
    if (!cid) continue;
    const arr = modulesByCourse.get(cid) ?? [];
    arr.push(m);
    modulesByCourse.set(cid, arr);
  }
  const contentsByModule = new Map<string, any[]>();
  for (const c of (contents ?? []) as any[]) {
    const arr = contentsByModule.get(c.module_id) ?? [];
    arr.push(c);
    contentsByModule.set(c.module_id, arr);
  }
  const quizByModule = new Map<string, any>();
  for (const q of (quizzes ?? []) as any[]) quizByModule.set(q.module_id, q);
  const progressByContent = new Map<string, any>(((progress ?? []) as any[]).map((p: any) => [p.content_id, p]));
  const passedQuizzes = new Set(((attempts ?? []) as any[]).filter((a: any) => a.passed).map((a: any) => a.quiz_id));
  const completedCourses = new Set(((completions ?? []) as any[]).map((c: any) => c.course_id));

  let totalModulesAll = 0;
  let completedModulesAll = 0;
  let lastAccess: string | null = null;
  for (const p of (progress ?? []) as any[]) {
    if (p.last_accessed_at && (!lastAccess || p.last_accessed_at > lastAccess)) lastAccess = p.last_accessed_at;
  }

  const courseCards = applicable.map((course: any) => {
    const mods = modulesByCourse.get(course.id) ?? [];
    let modsDone = 0;
    for (const m of mods) {
      const cts = contentsByModule.get(m.id) ?? [];
      const allCtsDone = cts.length > 0 && cts.every((c: any) => progressByContent.get(c.id)?.status === "completed");
      const q = quizByModule.get(m.id);
      const quizDone = !q || passedQuizzes.has(q.id);
      if (allCtsDone && quizDone) modsDone++;
    }
    totalModulesAll += mods.length;
    completedModulesAll += modsDone;
    const isDone = completedCourses.has(course.id) || (mods.length > 0 && modsDone === mods.length);
    const status = isDone ? "completed" : modsDone > 0 ? "in_progress" : "not_started";
    return {
      id: course.id,
      title: course.title,
      icon: course.icon,
      color: course.color,
      description: course.description,
      business_role_id: course.business_role_id,
      required_for_planning: course.required_for_planning,
      moduleCount: mods.length,
      completedModules: modsDone,
      progressPct: mods.length > 0 ? Math.round((modsDone / mods.length) * 100) : 0,
      status,
    };
  });

  const blocking = courseCards.filter((c: any) => c.required_for_planning && c.status !== "completed");
  return {
    courses: courseCards,
    summary: {
      totalCourses: courseCards.length,
      completedCourses: courseCards.filter((c: any) => c.status === "completed").length,
      totalModules: totalModulesAll,
      completedModules: completedModulesAll,
      progressPct: totalModulesAll > 0 ? Math.round((completedModulesAll / totalModulesAll) * 100) : 0,
      lockedPlanning: blocking.length > 0,
      blockingCourses: blocking.map((c: any) => ({ id: c.id, title: c.title, icon: c.icon })),
      lastAccessAt: lastAccess,
    },
  };
}

export const getMyAssignedCourses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    return computeAssignedCoursesFor(supabase, userId);
  });

export const getAssignedCoursesForEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ userId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdminOrManager(supabase, userId);
    return computeAssignedCoursesFor(supabase, data.userId);
  });


export const getCourseForEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ courseId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // ensure course is applicable
    const applicable = await applicableCoursesForUser(supabase, userId);
    const course = applicable.find((c: any) => c.id === data.courseId);
    if (!course) throw new Error("Parcours non disponible");

    const [{ data: sections }, { data: completion }] = await Promise.all([
      supabase.from("training_sections").select("*").eq("course_id", data.courseId).order("position"),
      supabase.from("training_course_completions").select("*").eq("user_id", userId).eq("course_id", data.courseId).maybeSingle(),
    ]);
    const sectionIds = ((sections ?? []) as any[]).map((s: any) => s.id);
    const { data: modules } = sectionIds.length > 0
      ? await supabase.from("training_modules").select("*").in("section_id", sectionIds).order("position")
      : { data: [] as any[] };
    const moduleIds = ((modules ?? []) as any[]).map((m: any) => m.id);
    const [{ data: contents }, { data: quizzes }, { data: questions }, { data: options }, { data: progress }, { data: attempts }] = await Promise.all([
      moduleIds.length > 0 ? supabase.from("training_contents").select("*").in("module_id", moduleIds).order("position") : Promise.resolve({ data: [] }),
      moduleIds.length > 0 ? supabase.from("training_quizzes").select("*").in("module_id", moduleIds) : Promise.resolve({ data: [] }),
      supabase.from("training_quiz_questions").select("*").order("position"),
      supabase.from("training_quiz_options").select("*").order("position"),
      supabase.from("training_content_progress").select("*").eq("user_id", userId),
      supabase.from("training_quiz_attempts").select("*").eq("user_id", userId).order("attempt_number"),
    ]);

    const progressMap = new Map<string, any>(((progress ?? []) as any[]).map((p: any) => [p.content_id, p]));
    const attemptsByQuiz = new Map<string, any[]>();
    for (const a of (attempts ?? []) as any[]) {
      const arr = attemptsByQuiz.get(a.quiz_id) ?? [];
      arr.push(a);
      attemptsByQuiz.set(a.quiz_id, arr);
    }

    const out = ((sections ?? []) as any[]).map((sec: any) => {
      const secMods = ((modules ?? []) as any[]).filter((m: any) => m.section_id === sec.id);
      const secModsOut = secMods.map((mod: any) => {
        const cts = ((contents ?? []) as any[])
          .filter((c: any) => c.module_id === mod.id)
          .map((c: any) => {
            const p = progressMap.get(c.id);
            return {
              ...c,
              status: p?.status ?? "not_started",
              progress_pct: p?.progress_pct ?? 0,
              time_spent_seconds: p?.time_spent_seconds ?? 0,
            };
          });
        const quizRow = ((quizzes ?? []) as any[]).find((q: any) => q.module_id === mod.id);
        let quiz: any = null;
        if (quizRow) {
          const qs = ((questions ?? []) as any[]).filter((q: any) => q.quiz_id === quizRow.id);
          const qIds = new Set(qs.map((q: any) => q.id));
          const opts = ((options ?? []) as any[]).filter((o: any) => qIds.has(o.question_id));
          const myAttempts = attemptsByQuiz.get(quizRow.id) ?? [];
          const passed = myAttempts.some((a: any) => a.passed);
          const bestScore = myAttempts.length > 0 ? Math.max(...myAttempts.map((a: any) => a.score ?? 0)) : null;
          quiz = {
            ...quizRow,
            questions: qs.map((q: any) => ({
              ...q,
              // hide is_correct for security — only revealed on attempt result
              options: opts.filter((o: any) => o.question_id === q.id).map((o: any) => ({ id: o.id, option_text: o.option_text, question_id: o.question_id })),
            })),
            attempts: myAttempts,
            attemptCount: myAttempts.length,
            passed,
            bestScore,
          };
        }
        const allCtsDone = cts.length > 0 && cts.every((c: any) => c.status === "completed");
        const quizDone = !quiz || quiz.passed;
        const status = allCtsDone && quizDone ? "completed"
          : cts.some((c: any) => c.status !== "not_started") || (quiz?.attemptCount ?? 0) > 0 ? "in_progress"
          : "not_started";
        return { ...mod, contents: cts, quiz, status };
      });
      return { ...sec, modules: secModsOut };
    });

    // Compute locked flags: a module is locked if any previous module in course order isn't completed
    const flatMods: any[] = [];
    for (const sec of out) for (const m of sec.modules) flatMods.push(m);
    for (let i = 0; i < flatMods.length; i++) {
      const prev = i > 0 ? flatMods[i - 1] : null;
      flatMods[i].locked = !!prev && prev.status !== "completed";
      flatMods[i].position_global = i + 1;
    }

    const totalMods = flatMods.length;
    const doneMods = flatMods.filter((m: any) => m.status === "completed").length;
    return {
      course,
      sections: out,
      totalModules: totalMods,
      completedModules: doneMods,
      progressPct: totalMods > 0 ? Math.round((doneMods / totalMods) * 100) : 0,
      completedAt: (completion as any)?.completed_at ?? null,
    };
  });

export const updateContentProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    contentId: z.string().uuid(),
    progress_pct: z.number().int().min(0).max(100),
    time_spent_increment: z.number().int().min(0).max(3600).optional(),
    completed: z.boolean().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("training_content_progress").select("*")
      .eq("user_id", userId).eq("content_id", data.contentId).maybeSingle();
    const now = new Date().toISOString();
    const inc = data.time_spent_increment ?? 0;
    const wantCompleted = data.completed === true || data.progress_pct >= 90;
    if (!existing) {
      const { error } = await supabase.from("training_content_progress").insert({
        user_id: userId,
        content_id: data.contentId,
        status: wantCompleted ? "completed" : "in_progress",
        progress_pct: data.progress_pct,
        time_spent_seconds: inc,
        first_accessed_at: now,
        last_accessed_at: now,
        completed_at: wantCompleted ? now : null,
      } as any);
      if (error) throw new Error(error.message);
    } else {
      const e = existing as any;
      const newPct = Math.max(e.progress_pct ?? 0, data.progress_pct);
      const newTime = (e.time_spent_seconds ?? 0) + inc;
      const alreadyDone = e.status === "completed";
      const nowDone = alreadyDone || wantCompleted;
      const { error } = await supabase.from("training_content_progress").update({
        progress_pct: newPct,
        time_spent_seconds: newTime,
        status: nowDone ? "completed" : "in_progress",
        last_accessed_at: now,
        completed_at: nowDone ? (e.completed_at ?? now) : null,
      } as any).eq("id", e.id);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const startQuizAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ quizId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: prev } = await supabase.from("training_quiz_attempts").select("attempt_number")
      .eq("user_id", userId).eq("quiz_id", data.quizId).order("attempt_number", { ascending: false }).limit(1);
    const nextNum = (((prev as any)?.[0]?.attempt_number) ?? 0) + 1;
    if (nextNum > 3) throw new Error("Tentatives épuisées");
    const { data: row, error } = await supabase.from("training_quiz_attempts").insert({
      user_id: userId, quiz_id: data.quizId, attempt_number: nextNum, started_at: new Date().toISOString(),
    } as any).select("id").single();
    if (error || !row) throw new Error(error?.message ?? "Échec démarrage");
    return { attemptId: (row as any).id, attemptNumber: nextNum };
  });

export const submitQuizAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    attemptId: z.string().uuid(),
    answers: z.array(z.object({
      questionId: z.string().uuid(),
      selectedOptionIds: z.array(z.string().uuid()).min(0).max(8),
    })).min(1).max(50),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: attempt } = await supabase.from("training_quiz_attempts").select("*").eq("id", data.attemptId).maybeSingle();
    if (!attempt || (attempt as any).user_id !== userId) throw new Error("Tentative introuvable");
    if ((attempt as any).completed_at) throw new Error("Déjà soumis");

    const { data: quiz } = await supabase.from("training_quizzes").select("*, training_modules!inner(id, section_id, training_sections!inner(course_id))").eq("id", (attempt as any).quiz_id).maybeSingle();
    if (!quiz) throw new Error("Quiz introuvable");
    const passingScore = (quiz as any).passing_score ?? 80;

    const { data: questions } = await supabase.from("training_quiz_questions").select("*").eq("quiz_id", (attempt as any).quiz_id);
    const qIds = ((questions ?? []) as any[]).map((q: any) => q.id);
    const { data: options } = qIds.length > 0
      ? await supabase.from("training_quiz_options").select("*").in("question_id", qIds)
      : { data: [] as any[] };

    const optByQ = new Map<string, any[]>();
    for (const o of (options ?? []) as any[]) {
      const arr = optByQ.get(o.question_id) ?? [];
      arr.push(o);
      optByQ.set(o.question_id, arr);
    }

    let correct = 0;
    const answerRows: any[] = [];
    const explanations: { questionId: string; questionText: string; correctIds: string[]; explanation: string | null; wasCorrect: boolean }[] = [];
    for (const q of (questions ?? []) as any[]) {
      const ans = data.answers.find((a) => a.questionId === q.id);
      const selected = new Set(ans?.selectedOptionIds ?? []);
      const opts = optByQ.get(q.id) ?? [];
      const correctIds = opts.filter((o) => o.is_correct).map((o) => o.id);
      const isCorrect = selected.size === correctIds.length && correctIds.every((id) => selected.has(id));
      if (isCorrect) correct++;
      answerRows.push({
        attempt_id: data.attemptId,
        question_id: q.id,
        selected_option_ids: Array.from(selected),
        is_correct: isCorrect,
      });
      explanations.push({
        questionId: q.id,
        questionText: q.question_text,
        correctIds,
        explanation: q.explanation,
        wasCorrect: isCorrect,
      });
    }

    const total = ((questions ?? []) as any[]).length;
    const score = total > 0 ? Math.round((correct / total) * 100) : 0;
    const passed = score >= passingScore;

    if (answerRows.length > 0) await supabase.from("training_quiz_answers").insert(answerRows as any);
    await supabase.from("training_quiz_attempts").update({
      completed_at: new Date().toISOString(),
      score, passed,
      correct_count: correct,
      total_count: total,
    } as any).eq("id", data.attemptId);

    // Notifications admins
    const courseId = (quiz as any).training_modules?.training_sections?.course_id;
    if (passed) {
      // optionally notify admin module passed — keep silent to avoid spam
    } else if ((attempt as any).attempt_number === 3) {
      // notify admins+managers
      const { data: admins } = await supabase.from("user_roles").select("user_id, role").in("role", ["admin", "manager"]);
      const adminIds = Array.from(new Set(((admins ?? []) as any[]).map((a: any) => a.user_id)));
      if (adminIds.length > 0) {
        const { data: prof } = await supabase.from("profiles").select("first_name, last_name").eq("id", userId).maybeSingle();
        const name = prof ? `${(prof as any).first_name} ${(prof as any).last_name}`.trim() : "Un employé";
        await supabase.from("notifications").insert(adminIds.map((aid) => ({
          user_id: aid,
          type: "training_blocked",
          title: "Formation bloquée",
          body: `${name} a échoué 3 fois au quiz "${(quiz as any).title}".`,
          link: "/formation",
        })) as any);
      }
    }

    // If passed, check if whole course is now completed
    let courseCompleted = false;
    if (passed && courseId) {
      const completedNow = await maybeCompleteCourse(supabase, userId, courseId);
      courseCompleted = completedNow;
    }

    return {
      score, passed, correctCount: correct, totalCount: total, passingScore,
      explanations,
      attemptNumber: (attempt as any).attempt_number,
      courseCompleted,
    };
  });

async function maybeCompleteCourse(supabase: any, userId: string, courseId: string): Promise<boolean> {
  const { data: existingCompletion } = await supabase.from("training_course_completions")
    .select("id").eq("user_id", userId).eq("course_id", courseId).maybeSingle();
  if (existingCompletion) return false;

  const { data: sections } = await supabase.from("training_sections").select("id").eq("course_id", courseId);
  const secIds = ((sections ?? []) as any[]).map((s: any) => s.id);
  if (secIds.length === 0) return false;
  const { data: modules } = await supabase.from("training_modules").select("id").in("section_id", secIds);
  const modIds = ((modules ?? []) as any[]).map((m: any) => m.id);
  if (modIds.length === 0) return false;
  const [{ data: contents }, { data: quizzes }, { data: progress }, { data: attempts }] = await Promise.all([
    supabase.from("training_contents").select("id, module_id").in("module_id", modIds),
    supabase.from("training_quizzes").select("id, module_id").in("module_id", modIds),
    supabase.from("training_content_progress").select("content_id, status").eq("user_id", userId),
    supabase.from("training_quiz_attempts").select("quiz_id, passed").eq("user_id", userId),
  ]);
  const doneCt = new Set(((progress ?? []) as any[]).filter((p: any) => p.status === "completed").map((p: any) => p.content_id));
  const passedQ = new Set(((attempts ?? []) as any[]).filter((a: any) => a.passed).map((a: any) => a.quiz_id));
  for (const m of modIds) {
    const cts = ((contents ?? []) as any[]).filter((c: any) => c.module_id === m);
    if (cts.length === 0) return false;
    if (!cts.every((c: any) => doneCt.has(c.id))) return false;
    const q = ((quizzes ?? []) as any[]).find((qq: any) => qq.module_id === m);
    if (q && !passedQ.has(q.id)) return false;
  }
  // Mark complete
  const totalTime = ((progress ?? []) as any[]).reduce((acc: number, p: any) => acc + (p.time_spent_seconds ?? 0), 0);
  await supabase.from("training_course_completions").insert({
    user_id: userId, course_id: courseId, completed_at: new Date().toISOString(), total_time_spent_seconds: totalTime,
  } as any);

  // Notify admins+managers
  const [{ data: admins }, { data: prof }, { data: course }] = await Promise.all([
    supabase.from("user_roles").select("user_id, role").in("role", ["admin", "manager"]),
    supabase.from("profiles").select("first_name, last_name").eq("id", userId).maybeSingle(),
    supabase.from("training_courses").select("title, icon").eq("id", courseId).maybeSingle(),
  ]);
  const adminIds = Array.from(new Set(((admins ?? []) as any[]).map((a: any) => a.user_id)));
  if (adminIds.length > 0) {
    const name = prof ? `${(prof as any).first_name} ${(prof as any).last_name}`.trim() : "Un employé";
    const c = course as any;
    await supabase.from("notifications").insert(adminIds.map((aid) => ({
      user_id: aid,
      type: "training_completed",
      title: "Formation terminée",
      body: `${name} a terminé "${c?.title ?? "un parcours"}".`,
      link: "/formation",
    })) as any);
  }
  return true;
}

// Manual recompute / fallback (employee can request)
export const completeCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ courseId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ok = await maybeCompleteCourse(supabase, userId, data.courseId);
    return { completed: ok };
  });

// Formation notifications (proactive, rule-based) for staff home screen
export const getFormationNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const applicable = await applicableCoursesForUser(supabase, userId);
    if (applicable.length === 0) return { items: [] as any[] };

    const courseIds = applicable.map((c: any) => c.id);
    const [{ data: sections }, { data: completions }] = await Promise.all([
      supabase.from("training_sections").select("id, course_id").in("course_id", courseIds),
      supabase.from("training_course_completions").select("course_id").eq("user_id", userId),
    ]);
    const secIds = ((sections ?? []) as any[]).map((s: any) => s.id);
    const { data: modules } = secIds.length > 0
      ? await supabase.from("training_modules").select("id, section_id").in("section_id", secIds)
      : { data: [] as any[] };
    const modIds = ((modules ?? []) as any[]).map((m: any) => m.id);
    const [{ data: contents }, { data: quizzes }, { data: progress }, { data: attempts }] = await Promise.all([
      modIds.length > 0 ? supabase.from("training_contents").select("id, module_id").in("module_id", modIds) : Promise.resolve({ data: [] }),
      modIds.length > 0 ? supabase.from("training_quizzes").select("id, module_id, title").in("module_id", modIds) : Promise.resolve({ data: [] }),
      supabase.from("training_content_progress").select("content_id, last_accessed_at, status").eq("user_id", userId),
      supabase.from("training_quiz_attempts").select("quiz_id, attempt_number, passed, completed_at").eq("user_id", userId),
    ]);

    const sectionToCourse = new Map<string, string>(((sections ?? []) as any[]).map((s: any) => [s.id, s.course_id]));
    const modulesByCourse = new Map<string, any[]>();
    for (const m of (modules ?? []) as any[]) {
      const cid = sectionToCourse.get(m.section_id);
      if (!cid) continue;
      const arr = modulesByCourse.get(cid) ?? [];
      arr.push(m);
      modulesByCourse.set(cid, arr);
    }
    const ctsByMod = new Map<string, any[]>();
    for (const c of (contents ?? []) as any[]) {
      const arr = ctsByMod.get(c.module_id) ?? [];
      arr.push(c);
      ctsByMod.set(c.module_id, arr);
    }
    const quizByMod = new Map<string, any>();
    for (const q of (quizzes ?? []) as any[]) quizByMod.set(q.module_id, q);
    const progressByCt = new Map<string, any>(((progress ?? []) as any[]).map((p: any) => [p.content_id, p]));
    const passedQ = new Set(((attempts ?? []) as any[]).filter((a: any) => a.passed).map((a: any) => a.quiz_id));
    const completedC = new Set(((completions ?? []) as any[]).map((c: any) => c.course_id));

    let lastAccessGlobal: number | null = null;
    for (const p of (progress ?? []) as any[]) {
      if (p.last_accessed_at) {
        const t = new Date(p.last_accessed_at).getTime();
        if (lastAccessGlobal === null || t > lastAccessGlobal) lastAccessGlobal = t;
      }
    }

    const items: any[] = [];

    // Rule 5 — all complete
    const allDone = applicable.every((c: any) => completedC.has(c.id));
    if (allDone) {
      items.push({ id: "all_done", priority: 1, variant: "success", title: "Tous tes parcours sont validés 🎉", body: "Ton planning est complètement débloqué.", cta: null });
      return { items };
    }

    for (const course of applicable) {
      if (completedC.has(course.id)) continue;
      const mods = modulesByCourse.get(course.id) ?? [];
      let modsDone = 0;
      let hasAnyProgress = false;
      for (const m of mods) {
        const cts = ctsByMod.get(m.id) ?? [];
        const allCtsDone = cts.length > 0 && cts.every((c: any) => progressByCt.get(c.id)?.status === "completed");
        const q = quizByMod.get(m.id);
        const quizDone = !q || passedQ.has(q.id);
        if (allCtsDone && quizDone) modsDone++;
        if (cts.some((c: any) => progressByCt.get(c.id))) hasAnyProgress = true;
      }
      const remaining = mods.length - modsDone;
      const pct = mods.length > 0 ? Math.round((modsDone / mods.length) * 100) : 0;

      // Rule 1 — not started
      if (!hasAnyProgress && mods.length > 0) {
        items.push({
          id: `start_${course.id}`,
          priority: 10,
          variant: "primary",
          title: `Nouveau parcours : ${course.title}`,
          body: course.required_for_planning ? "Termine-le pour débloquer ton planning." : "Disponible dès maintenant.",
          cta: { label: "Commencer →", courseId: course.id },
        });
        continue;
      }
      // Rule 4 — near completion (>=70%)
      if (pct >= 70 && remaining > 0) {
        items.push({
          id: `almost_${course.id}`,
          priority: 8,
          variant: "success-light",
          title: `Plus que ${remaining} module${remaining > 1 ? "s" : ""} sur ${course.title}`,
          body: `Tu es à ${pct}%. Tu y es presque !`,
          cta: { label: "Continuer →", courseId: course.id },
        });
        continue;
      }
      // Rule 2 — paused > 3 days
      if (hasAnyProgress && lastAccessGlobal !== null) {
        const daysSince = Math.floor((Date.now() - lastAccessGlobal) / 86400_000);
        if (daysSince >= 3) {
          items.push({
            id: `paused_${course.id}`,
            priority: 7,
            variant: "warning",
            title: `Reprends "${course.title}"`,
            body: `Pas avancé depuis ${daysSince} jours. Plus que ${remaining} modules.`,
            cta: { label: "Reprendre →", courseId: course.id },
          });
        }
      }
    }

    // Rule 3 — failed quiz twice
    const failsByQuiz = new Map<string, number>();
    for (const a of (attempts ?? []) as any[]) {
      if (a.completed_at && a.passed === false) failsByQuiz.set(a.quiz_id, (failsByQuiz.get(a.quiz_id) ?? 0) + 1);
    }
    for (const [qid, fails] of failsByQuiz) {
      if (fails >= 2 && !passedQ.has(qid)) {
        const q = ((quizzes ?? []) as any[]).find((qq: any) => qq.id === qid);
        if (!q) continue;
        items.push({
          id: `failed_${qid}`,
          priority: 9,
          variant: "danger",
          title: `Quiz raté 2 fois`,
          body: `Revois la vidéo calmement, tu y arriveras à la 3ème.`,
          cta: { label: "Revoir →", courseId: null },
        });
      }
    }

    items.sort((a, b) => b.priority - a.priority);
    return { items };
  });
