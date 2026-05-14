
-- 1. AVAILABILITIES: plages horaires
ALTER TABLE public.availabilities
  ADD COLUMN IF NOT EXISTS start_time time,
  ADD COLUMN IF NOT EXISTS end_time time;

-- Migrer les slot existants vers des plages par défaut
UPDATE public.availabilities
SET start_time = CASE slot::text
    WHEN 'matin' THEN '07:00'::time
    WHEN 'midi'  THEN '11:00'::time
    WHEN 'soir'  THEN '16:00'::time
  END,
  end_time = CASE slot::text
    WHEN 'matin' THEN '12:00'::time
    WHEN 'midi'  THEN '17:00'::time
    WHEN 'soir'  THEN '23:00'::time
  END
WHERE start_time IS NULL;

ALTER TABLE public.availabilities ALTER COLUMN start_time SET NOT NULL;
ALTER TABLE public.availabilities ALTER COLUMN end_time SET NOT NULL;
ALTER TABLE public.availabilities DROP COLUMN IF EXISTS slot;

CREATE INDEX IF NOT EXISTS idx_availabilities_user_date
  ON public.availabilities(user_id, avail_date);

-- 2. AI SETTINGS: bornes de durée
ALTER TABLE public.ai_planning_settings
  ADD COLUMN IF NOT EXISTS min_shift_hours smallint NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS max_shift_hours smallint NOT NULL DEFAULT 6;

-- 3. STAFFING_TEMPLATES: optionnel + contrat requis
ALTER TABLE public.staffing_templates
  ADD COLUMN IF NOT EXISTS is_optional boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS required_contract contract_type;

-- 4. Seed des besoins Châtelain (efface l'existant pour ce studio)
DELETE FROM public.staffing_templates
WHERE studio_id = '28bff1f3-d1d9-477a-8439-aa1e908e8430';

-- ACCUEIL (lun-ven : 2 shifts ; sam-dim : 1 shift)
INSERT INTO public.staffing_templates (studio_id, day_of_week, start_time, end_time, business_role, required_count, is_optional, required_contract) VALUES
('28bff1f3-d1d9-477a-8439-aa1e908e8430', 0, '06:30', '13:30', 'Accueil', 1, false, NULL),
('28bff1f3-d1d9-477a-8439-aa1e908e8430', 0, '16:30', '21:30', 'Accueil', 1, false, NULL),
('28bff1f3-d1d9-477a-8439-aa1e908e8430', 1, '06:30', '13:30', 'Accueil', 1, false, NULL),
('28bff1f3-d1d9-477a-8439-aa1e908e8430', 1, '16:30', '21:30', 'Accueil', 1, false, NULL),
('28bff1f3-d1d9-477a-8439-aa1e908e8430', 2, '06:30', '13:30', 'Accueil', 1, false, NULL),
('28bff1f3-d1d9-477a-8439-aa1e908e8430', 2, '16:30', '21:30', 'Accueil', 1, false, NULL),
('28bff1f3-d1d9-477a-8439-aa1e908e8430', 3, '06:30', '13:30', 'Accueil', 1, false, NULL),
('28bff1f3-d1d9-477a-8439-aa1e908e8430', 3, '16:30', '21:30', 'Accueil', 1, false, NULL),
('28bff1f3-d1d9-477a-8439-aa1e908e8430', 4, '06:30', '13:30', 'Accueil', 1, false, NULL),
('28bff1f3-d1d9-477a-8439-aa1e908e8430', 4, '16:30', '21:30', 'Accueil', 1, false, NULL),
('28bff1f3-d1d9-477a-8439-aa1e908e8430', 5, '08:30', '16:30', 'Accueil', 1, false, NULL),
('28bff1f3-d1d9-477a-8439-aa1e908e8430', 6, '08:30', '16:30', 'Accueil', 1, false, NULL);

-- BAR semaine : CDI 07:45-15:45 obligatoire + couverture étudiant 15:45-20:00
INSERT INTO public.staffing_templates (studio_id, day_of_week, start_time, end_time, business_role, required_count, is_optional, required_contract) VALUES
('28bff1f3-d1d9-477a-8439-aa1e908e8430', 0, '07:45', '15:45', 'Barista', 1, false, 'CDI'),
('28bff1f3-d1d9-477a-8439-aa1e908e8430', 0, '15:45', '20:00', 'Barista', 1, false, NULL),
('28bff1f3-d1d9-477a-8439-aa1e908e8430', 1, '07:45', '15:45', 'Barista', 1, false, 'CDI'),
('28bff1f3-d1d9-477a-8439-aa1e908e8430', 1, '15:45', '20:00', 'Barista', 1, false, NULL),
('28bff1f3-d1d9-477a-8439-aa1e908e8430', 2, '07:45', '15:45', 'Barista', 1, false, 'CDI'),
('28bff1f3-d1d9-477a-8439-aa1e908e8430', 2, '15:45', '20:00', 'Barista', 1, false, NULL),
('28bff1f3-d1d9-477a-8439-aa1e908e8430', 3, '07:45', '15:45', 'Barista', 1, false, 'CDI'),
('28bff1f3-d1d9-477a-8439-aa1e908e8430', 3, '15:45', '20:00', 'Barista', 1, false, NULL),
('28bff1f3-d1d9-477a-8439-aa1e908e8430', 4, '07:45', '15:45', 'Barista', 1, false, 'CDI'),
('28bff1f3-d1d9-477a-8439-aa1e908e8430', 4, '15:45', '20:00', 'Barista', 1, false, NULL);

-- BAR semaine renforts optionnels (Shake = Barista, Host)
INSERT INTO public.staffing_templates (studio_id, day_of_week, start_time, end_time, business_role, required_count, is_optional, required_contract) VALUES
('28bff1f3-d1d9-477a-8439-aa1e908e8430', 0, '10:00', '14:00', 'Barista', 1, true, 'Étudiant'),
('28bff1f3-d1d9-477a-8439-aa1e908e8430', 1, '10:00', '14:00', 'Barista', 1, true, 'Étudiant'),
('28bff1f3-d1d9-477a-8439-aa1e908e8430', 2, '10:00', '14:00', 'Barista', 1, true, 'Étudiant'),
('28bff1f3-d1d9-477a-8439-aa1e908e8430', 3, '10:00', '14:00', 'Barista', 1, true, 'Étudiant'),
('28bff1f3-d1d9-477a-8439-aa1e908e8430', 4, '10:00', '14:00', 'Barista', 1, true, 'Étudiant'),
('28bff1f3-d1d9-477a-8439-aa1e908e8430', 0, '10:30', '13:30', 'Host', 1, true, 'Étudiant'),
('28bff1f3-d1d9-477a-8439-aa1e908e8430', 1, '10:30', '13:30', 'Host', 1, true, 'Étudiant'),
('28bff1f3-d1d9-477a-8439-aa1e908e8430', 2, '10:30', '13:30', 'Host', 1, true, 'Étudiant'),
('28bff1f3-d1d9-477a-8439-aa1e908e8430', 3, '10:30', '13:30', 'Host', 1, true, 'Étudiant'),
('28bff1f3-d1d9-477a-8439-aa1e908e8430', 4, '10:30', '13:30', 'Host', 1, true, 'Étudiant');

-- BAR week-end : 08:30-18:30 + renforts
INSERT INTO public.staffing_templates (studio_id, day_of_week, start_time, end_time, business_role, required_count, is_optional, required_contract) VALUES
('28bff1f3-d1d9-477a-8439-aa1e908e8430', 5, '08:30', '18:30', 'Barista', 1, false, NULL),
('28bff1f3-d1d9-477a-8439-aa1e908e8430', 6, '08:30', '18:30', 'Barista', 1, false, NULL),
('28bff1f3-d1d9-477a-8439-aa1e908e8430', 5, '10:00', '14:00', 'Barista', 1, true, 'Étudiant'),
('28bff1f3-d1d9-477a-8439-aa1e908e8430', 6, '10:00', '14:00', 'Barista', 1, true, 'Étudiant'),
('28bff1f3-d1d9-477a-8439-aa1e908e8430', 5, '10:00', '14:30', 'Host', 1, true, 'Étudiant'),
('28bff1f3-d1d9-477a-8439-aa1e908e8430', 6, '10:00', '14:30', 'Host', 1, true, 'Étudiant');

-- CUISINE semaine (CDI obligatoire)
INSERT INTO public.staffing_templates (studio_id, day_of_week, start_time, end_time, business_role, required_count, is_optional, required_contract) VALUES
('28bff1f3-d1d9-477a-8439-aa1e908e8430', 0, '07:00', '15:30', 'Cuisine', 1, false, 'CDI'),
('28bff1f3-d1d9-477a-8439-aa1e908e8430', 1, '07:00', '14:30', 'Cuisine', 1, false, 'CDI'),
('28bff1f3-d1d9-477a-8439-aa1e908e8430', 2, '07:00', '14:30', 'Cuisine', 1, false, 'CDI'),
('28bff1f3-d1d9-477a-8439-aa1e908e8430', 3, '07:00', '14:30', 'Cuisine', 1, false, 'CDI'),
('28bff1f3-d1d9-477a-8439-aa1e908e8430', 4, '07:00', '16:30', 'Cuisine', 1, false, 'CDI');

-- CUISINE week-end : 1 étudiant base + 1 renfort
INSERT INTO public.staffing_templates (studio_id, day_of_week, start_time, end_time, business_role, required_count, is_optional, required_contract) VALUES
('28bff1f3-d1d9-477a-8439-aa1e908e8430', 5, '08:30', '14:00', 'Cuisine', 1, false, 'Étudiant'),
('28bff1f3-d1d9-477a-8439-aa1e908e8430', 6, '08:30', '14:00', 'Cuisine', 1, false, 'Étudiant'),
('28bff1f3-d1d9-477a-8439-aa1e908e8430', 5, '08:30', '15:30', 'Cuisine', 1, true, 'Étudiant'),
('28bff1f3-d1d9-477a-8439-aa1e908e8430', 6, '08:30', '15:30', 'Cuisine', 1, true, 'Étudiant');
