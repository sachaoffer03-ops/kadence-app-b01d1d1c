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
