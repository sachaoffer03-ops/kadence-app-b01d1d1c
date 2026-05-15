
-- Workflow publication du planning
ALTER TABLE public.planning_runs 
  ADD COLUMN IF NOT EXISTS workflow_status text 
    CHECK (workflow_status IN ('draft', 'review', 'published', 'unpublished')) 
    DEFAULT 'draft';

ALTER TABLE public.planning_runs
  ADD COLUMN IF NOT EXISTS marked_review_at timestamptz,
  ADD COLUMN IF NOT EXISTS marked_review_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS unpublished_at timestamptz,
  ADD COLUMN IF NOT EXISTS unpublished_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS unpublished_reason text;

UPDATE public.planning_runs SET workflow_status = 'draft' WHERE workflow_status IS NULL;

-- Deadline mensuelle de saisie des dispos
ALTER TABLE public.ai_planning_settings 
  ADD COLUMN IF NOT EXISTS availability_deadline_day integer DEFAULT 20
    CHECK (availability_deadline_day BETWEEN 1 AND 28);
