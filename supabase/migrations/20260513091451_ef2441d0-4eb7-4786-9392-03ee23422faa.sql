
-- Templates de besoins en personnel (combien de shifts par studio/jour/créneau/rôle)
CREATE TABLE public.staffing_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  business_role business_role NOT NULL,
  required_count smallint NOT NULL DEFAULT 1 CHECK (required_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.staffing_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gèrent les templates"
  ON public.staffing_templates FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Tout le monde voit les templates"
  ON public.staffing_templates FOR SELECT TO authenticated
  USING (true);

CREATE TRIGGER trg_staffing_templates_updated_at
  BEFORE UPDATE ON public.staffing_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_staffing_templates_studio_day ON public.staffing_templates(studio_id, day_of_week);

-- Réglages IA (singleton)
CREATE TABLE public.ai_planning_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  weight_performance smallint NOT NULL DEFAULT 40 CHECK (weight_performance BETWEEN 0 AND 100),
  weight_equity smallint NOT NULL DEFAULT 30 CHECK (weight_equity BETWEEN 0 AND 100),
  weight_preference smallint NOT NULL DEFAULT 20 CHECK (weight_preference BETWEEN 0 AND 100),
  weight_random smallint NOT NULL DEFAULT 10 CHECK (weight_random BETWEEN 0 AND 100),
  enforce_student_quota boolean NOT NULL DEFAULT true,
  enforce_rest_11h boolean NOT NULL DEFAULT true,
  enforce_max_weekly_cdi boolean NOT NULL DEFAULT true,
  strict_preferences boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.ai_planning_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gèrent les réglages IA"
  ON public.ai_planning_settings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authentifiés voient les réglages IA"
  ON public.ai_planning_settings FOR SELECT TO authenticated
  USING (true);

CREATE TRIGGER trg_ai_planning_settings_updated_at
  BEFORE UPDATE ON public.ai_planning_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed avec une ligne par défaut
INSERT INTO public.ai_planning_settings (weight_performance, weight_equity, weight_preference, weight_random)
VALUES (40, 30, 20, 10);
