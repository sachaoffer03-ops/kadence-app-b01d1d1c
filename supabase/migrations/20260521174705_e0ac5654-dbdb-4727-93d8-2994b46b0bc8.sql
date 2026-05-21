ALTER TABLE public.checklist_templates
  ADD COLUMN IF NOT EXISTS phase text NOT NULL DEFAULT 'closing'
  CHECK (phase IN ('opening', 'closing'));

CREATE INDEX IF NOT EXISTS checklist_templates_phase_idx
  ON public.checklist_templates(studio_id, business_role_id, phase);

ALTER TABLE public.checklist_submissions
  ADD COLUMN IF NOT EXISTS phase text NOT NULL DEFAULT 'closing'
  CHECK (phase IN ('opening', 'closing'));

CREATE INDEX IF NOT EXISTS checklist_submissions_user_phase_idx
  ON public.checklist_submissions(user_id, shift_id, phase);