ALTER TABLE public.checklist_submission_photos
  ADD COLUMN IF NOT EXISTS admin_override_by uuid,
  ADD COLUMN IF NOT EXISTS admin_override_at timestamptz,
  ADD COLUMN IF NOT EXISTS admin_override_reason text;