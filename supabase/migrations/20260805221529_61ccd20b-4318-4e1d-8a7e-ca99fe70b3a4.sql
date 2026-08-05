ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS late_reason text,
  ADD COLUMN IF NOT EXISTS clock_out_reason text,
  ADD COLUMN IF NOT EXISTS clock_out_deviation_min integer;

COMMENT ON COLUMN public.shifts.late_reason IS 'Motif obligatoire saisi par l''employé quand son arrivée dépasse la tolérance du studio';
COMMENT ON COLUMN public.shifts.clock_out_reason IS 'Motif obligatoire saisi quand la sortie est hors de la fenêtre tolérée (trop tôt / trop tard)';
COMMENT ON COLUMN public.shifts.clock_out_deviation_min IS 'Écart en minutes entre la sortie pointée et la fin prévue (négatif = parti plus tôt)';