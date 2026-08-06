ALTER TABLE public.ai_planning_settings
  ADD COLUMN IF NOT EXISTS overflow_margin_min integer NOT NULL DEFAULT 30;