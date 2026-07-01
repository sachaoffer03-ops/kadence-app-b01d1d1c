ALTER TABLE public.studios
  ADD COLUMN IF NOT EXISTS previous_qr_code text,
  ADD COLUMN IF NOT EXISTS previous_qr_rotated_at timestamptz;