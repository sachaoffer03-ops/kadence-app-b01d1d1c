
-- 1. Enrichir ai_planning_settings
ALTER TABLE public.ai_planning_settings
  ADD COLUMN IF NOT EXISTS max_shift_hours_cdi numeric NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS max_shift_hours_student numeric NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS max_shift_hours_flexi numeric NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS target_weekly_cdi_hours numeric NOT NULL DEFAULT 35,
  ADD COLUMN IF NOT EXISTS cdi_hours_tolerance numeric NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS default_score_when_null numeric NOT NULL DEFAULT 7.0;

-- 2. Table de log des générations
CREATE TABLE IF NOT EXISTS public.planning_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month_start_date date NOT NULL,
  month_end_date date NOT NULL,
  studios_included uuid[] NOT NULL DEFAULT '{}',
  status text NOT NULL CHECK (status IN ('pending', 'running', 'success', 'partial', 'failed')),
  coverage_rate numeric,
  shifts_generated integer NOT NULL DEFAULT 0,
  shifts_with_holes integer NOT NULL DEFAULT 0,
  triggered_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  duration_ms integer,
  solver_logs jsonb,
  alerts jsonb,
  error_message text,
  preserve_manual boolean NOT NULL DEFAULT true,
  preserve_locked boolean NOT NULL DEFAULT true,
  dry_run boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_planning_runs_month ON public.planning_runs(month_start_date);
CREATE INDEX IF NOT EXISTS idx_planning_runs_status ON public.planning_runs(status);
CREATE INDEX IF NOT EXISTS idx_planning_runs_started ON public.planning_runs(started_at DESC);

-- 3. RLS
ALTER TABLE public.planning_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins gèrent planning_runs" ON public.planning_runs;
CREATE POLICY "Admins gèrent planning_runs" ON public.planning_runs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
