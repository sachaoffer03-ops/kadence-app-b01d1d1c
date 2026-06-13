ALTER TABLE public.ai_planning_settings
  ADD COLUMN IF NOT EXISTS availability_lock_day integer NOT NULL DEFAULT 25
  CHECK (availability_lock_day BETWEEN 1 AND 28);

COMMENT ON COLUMN public.ai_planning_settings.availability_lock_day IS
  'Jour du mois après lequel les dispos du mois suivant deviennent verrouillées (1-28)';

UPDATE public.ai_planning_settings
  SET availability_lock_day = 25
  WHERE availability_lock_day IS NULL;