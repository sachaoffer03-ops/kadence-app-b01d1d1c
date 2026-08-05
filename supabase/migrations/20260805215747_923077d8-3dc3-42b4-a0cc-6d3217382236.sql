CREATE OR REPLACE FUNCTION public.shifts_compute_minutes_late()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  -- Ponctualité = uniquement l'heure d'arrivée (clock-in).
  -- L'heure de fin (clocked_out_at) n'entre jamais dans le calcul.
  IF NEW.clocked_in_at IS NULL THEN
    NEW.minutes_late := NULL;
  ELSE
    NEW.minutes_late := GREATEST(
      0,
      FLOOR(EXTRACT(EPOCH FROM (
        NEW.clocked_in_at
        - (((NEW.shift_date::timestamp) + NEW.start_time) AT TIME ZONE 'Europe/Brussels')
      )) / 60.0)::integer
    );
  END IF;
  RETURN NEW;
END;
$function$;

UPDATE public.shifts s
SET minutes_late = GREATEST(
  0,
  FLOOR(EXTRACT(EPOCH FROM (
    s.clocked_in_at - (((s.shift_date::timestamp) + s.start_time) AT TIME ZONE 'Europe/Brussels')
  )) / 60.0)::integer
)
WHERE s.clocked_in_at IS NOT NULL;

UPDATE public.profiles p
SET score = public.calculate_profile_score(p.id);