ALTER TABLE public.studio_exceptions
  ADD COLUMN IF NOT EXISTS hours_adjust text,
  ADD COLUMN IF NOT EXISTS date_label text;