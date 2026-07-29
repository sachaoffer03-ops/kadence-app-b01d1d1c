ALTER TABLE public.checklist_templates DROP CONSTRAINT IF EXISTS checklist_templates_phase_check;
ALTER TABLE public.checklist_submissions DROP CONSTRAINT IF EXISTS checklist_submissions_phase_check;

UPDATE public.checklist_templates SET phase = 'transition_out' WHERE phase = 'transition';

ALTER TABLE public.checklist_templates ADD CONSTRAINT checklist_templates_phase_check
  CHECK (phase = ANY (ARRAY['opening','transition_in','transition_out','closing']));
ALTER TABLE public.checklist_submissions ADD CONSTRAINT checklist_submissions_phase_check
  CHECK (phase = ANY (ARRAY['opening','transition','transition_in','transition_out','closing']));