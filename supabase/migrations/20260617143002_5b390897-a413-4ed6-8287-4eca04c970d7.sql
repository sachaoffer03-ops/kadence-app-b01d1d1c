ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS created_by_run_id uuid
  REFERENCES public.planning_runs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_shifts_created_by_run_id
  ON public.shifts(created_by_run_id)
  WHERE created_by_run_id IS NOT NULL;