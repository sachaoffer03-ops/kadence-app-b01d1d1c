
-- Defaults: tout obligatoire désormais
ALTER TABLE public.closure_questions ALTER COLUMN is_required SET DEFAULT true;

-- Backfill : tout ce qui existe devient obligatoire
UPDATE public.closure_questions SET is_required = true WHERE is_required = false;
UPDATE public.checklist_template_items SET is_required = true WHERE is_required = false;
UPDATE public.checklist_template_photos SET is_required = true WHERE is_required = false;

-- Les checklists deviennent bloquantes (impossible de valider la clôture sans cocher tout)
UPDATE public.checklist_templates SET is_blocking = true WHERE is_blocking = false;
