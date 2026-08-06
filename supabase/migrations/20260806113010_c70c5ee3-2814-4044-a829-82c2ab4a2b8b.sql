ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS open_to_all boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS open_message text;

CREATE INDEX IF NOT EXISTS idx_shifts_open_to_all
  ON public.shifts (open_to_all, shift_date)
  WHERE open_to_all = true AND user_id IS NULL;

DROP POLICY IF EXISTS "Employees can view open-to-all shifts" ON public.shifts;
CREATE POLICY "Employees can view open-to-all shifts"
ON public.shifts
FOR SELECT
TO authenticated
USING (
  open_to_all = true
  AND user_id IS NULL
  AND (
    studio_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.user_studios us
      WHERE us.user_id = auth.uid() AND us.studio_id = shifts.studio_id
    )
  )
);