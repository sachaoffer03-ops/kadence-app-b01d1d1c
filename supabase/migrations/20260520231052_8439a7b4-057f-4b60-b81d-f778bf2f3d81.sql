
-- ============================================
-- DROP ancien système formation
-- ============================================
DROP TABLE IF EXISTS public.formation_completions CASCADE;
DROP TABLE IF EXISTS public.formations CASCADE;
DROP TABLE IF EXISTS public.training_paths CASCADE;
DROP TABLE IF EXISTS public.training_progress CASCADE;
DROP TABLE IF EXISTS public.training_resources CASCADE;
DROP TABLE IF EXISTS public.training_steps CASCADE;
DROP TABLE IF EXISTS public.training_folders CASCADE;

-- ============================================
-- Nouveau schéma
-- ============================================

-- 1. Parcours
CREATE TABLE public.training_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NULL,
  icon text NULL,
  color text NULL,
  business_role_id uuid NULL REFERENCES public.business_roles(id) ON DELETE SET NULL,
  is_required_for_all boolean NOT NULL DEFAULT false,
  required_for_planning boolean NOT NULL DEFAULT true,
  passing_quiz_score int NOT NULL DEFAULT 80 CHECK (passing_quiz_score BETWEEN 0 AND 100),
  position int NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX training_courses_role_idx ON public.training_courses(business_role_id);

-- 2. Sections
CREATE TABLE public.training_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.training_courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NULL,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX training_sections_course_idx ON public.training_sections(course_id, position);

-- 3. Modules
CREATE TABLE public.training_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES public.training_sections(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NULL,
  position int NOT NULL DEFAULT 0,
  duration_estimate_min int NULL,
  has_final_quiz boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX training_modules_section_idx ON public.training_modules(section_id, position);

-- 4. Contents
CREATE TABLE public.training_contents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.training_modules(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('video', 'pdf', 'image', 'text')),
  title text NOT NULL,
  description text NULL,
  url text NULL,
  external_url text NULL,
  text_content text NULL,
  duration_seconds int NULL,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX training_contents_module_idx ON public.training_contents(module_id, position);

-- 5. Quizzes
CREATE TABLE public.training_quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL UNIQUE REFERENCES public.training_modules(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Quiz du module',
  passing_score int NOT NULL DEFAULT 80 CHECK (passing_score BETWEEN 0 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Quiz questions
CREATE TABLE public.training_quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.training_quizzes(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  question_type text NOT NULL DEFAULT 'single_choice'
    CHECK (question_type IN ('single_choice', 'multiple_choice', 'true_false')),
  position int NOT NULL DEFAULT 0,
  explanation text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX training_quiz_questions_quiz_idx ON public.training_quiz_questions(quiz_id, position);

-- 7. Quiz options
CREATE TABLE public.training_quiz_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.training_quiz_questions(id) ON DELETE CASCADE,
  option_text text NOT NULL,
  is_correct boolean NOT NULL DEFAULT false,
  position int NOT NULL DEFAULT 0
);
CREATE INDEX training_quiz_options_question_idx ON public.training_quiz_options(question_id, position);

-- 8. Quiz attempts
CREATE TABLE public.training_quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quiz_id uuid NOT NULL REFERENCES public.training_quizzes(id) ON DELETE CASCADE,
  attempt_number int NOT NULL DEFAULT 1,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL,
  score int NULL,
  passed boolean NULL,
  time_spent_seconds int NULL
);
CREATE INDEX training_quiz_attempts_user_idx ON public.training_quiz_attempts(user_id, quiz_id);

-- 9. Quiz answers
CREATE TABLE public.training_quiz_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES public.training_quiz_attempts(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.training_quiz_questions(id) ON DELETE CASCADE,
  selected_option_ids uuid[] NOT NULL DEFAULT '{}',
  is_correct boolean NOT NULL DEFAULT false,
  answered_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX training_quiz_answers_attempt_idx ON public.training_quiz_answers(attempt_id);

-- 10. Content progress
CREATE TABLE public.training_content_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id uuid NOT NULL REFERENCES public.training_contents(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'in_progress', 'completed')),
  time_spent_seconds int NOT NULL DEFAULT 0,
  progress_pct int NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  first_accessed_at timestamptz NULL,
  last_accessed_at timestamptz NULL,
  completed_at timestamptz NULL,
  UNIQUE(user_id, content_id)
);
CREATE INDEX training_content_progress_user_idx ON public.training_content_progress(user_id);

-- 11. Course completions
CREATE TABLE public.training_course_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.training_courses(id) ON DELETE CASCADE,
  completed_at timestamptz NOT NULL DEFAULT now(),
  total_time_spent_seconds int NOT NULL DEFAULT 0,
  UNIQUE(user_id, course_id)
);
CREATE INDEX training_course_completions_user_idx ON public.training_course_completions(user_id);

-- ============================================
-- RLS
-- ============================================
ALTER TABLE public.training_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_quiz_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_quiz_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_content_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_course_completions ENABLE ROW LEVEL SECURITY;

-- Contenu pédagogique : lecture pour tous authentifiés, écriture admin/manager
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'training_courses','training_sections','training_modules','training_contents',
    'training_quizzes','training_quiz_questions','training_quiz_options'
  ]
  LOOP
    EXECUTE format('CREATE POLICY "Auth read %1$s" ON public.%1$s FOR SELECT TO authenticated USING (true);', t);
    EXECUTE format('CREATE POLICY "Admins/managers manage %1$s" ON public.%1$s FOR ALL TO authenticated USING (has_role(auth.uid(), ''admin''::app_role) OR has_role(auth.uid(), ''manager''::app_role)) WITH CHECK (has_role(auth.uid(), ''admin''::app_role) OR has_role(auth.uid(), ''manager''::app_role));', t);
  END LOOP;
END $$;

-- Progression/tentatives : utilisateur sur ses propres données + admin/manager en lecture
CREATE POLICY "User reads own attempts" ON public.training_quiz_attempts FOR SELECT TO authenticated USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "User inserts own attempts" ON public.training_quiz_attempts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "User updates own attempts" ON public.training_quiz_attempts FOR UPDATE TO authenticated USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "User reads own answers" ON public.training_quiz_answers FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.training_quiz_attempts a WHERE a.id = attempt_id AND (a.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)))
);
CREATE POLICY "User inserts own answers" ON public.training_quiz_answers FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.training_quiz_attempts a WHERE a.id = attempt_id AND a.user_id = auth.uid())
);

CREATE POLICY "User reads own content progress" ON public.training_content_progress FOR SELECT TO authenticated USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "User upserts own content progress" ON public.training_content_progress FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "User updates own content progress" ON public.training_content_progress FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "User reads own course completions" ON public.training_course_completions FOR SELECT TO authenticated USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "User inserts own course completions" ON public.training_course_completions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin manages course completions" ON public.training_course_completions FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Triggers updated_at
CREATE TRIGGER trg_training_courses_updated BEFORE UPDATE ON public.training_courses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_training_sections_updated BEFORE UPDATE ON public.training_sections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_training_modules_updated BEFORE UPDATE ON public.training_modules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_training_quizzes_updated BEFORE UPDATE ON public.training_quizzes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
