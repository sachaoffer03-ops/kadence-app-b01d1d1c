ALTER TABLE public.availabilities
  ADD COLUMN IF NOT EXISTS studio_id uuid REFERENCES public.studios(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_avail_user_studio_date
  ON public.availabilities(user_id, studio_id, avail_date);