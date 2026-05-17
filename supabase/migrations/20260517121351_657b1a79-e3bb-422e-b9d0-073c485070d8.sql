CREATE OR REPLACE FUNCTION public.get_worked_hours(
  target_user_id uuid,
  period_start date DEFAULT date_trunc('month', CURRENT_DATE)::date,
  period_end date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  total_minutes integer,
  total_hours numeric,
  shift_count integer,
  avg_minutes_late numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(EXTRACT(EPOCH FROM (clocked_out_at - clocked_in_at)) / 60)::integer, 0) AS total_minutes,
    ROUND(COALESCE(SUM(EXTRACT(EPOCH FROM (clocked_out_at - clocked_in_at)) / 3600), 0)::numeric, 2) AS total_hours,
    COUNT(*)::integer AS shift_count,
    ROUND(COALESCE(AVG(minutes_late), 0)::numeric, 1) AS avg_minutes_late
  FROM public.shifts
  WHERE user_id = target_user_id
    AND status = 'completed'
    AND clocked_in_at IS NOT NULL
    AND clocked_out_at IS NOT NULL
    AND shift_date >= period_start
    AND shift_date <= period_end;
END;
$$;

REVOKE ALL ON FUNCTION public.get_worked_hours(uuid, date, date) FROM public;
GRANT EXECUTE ON FUNCTION public.get_worked_hours(uuid, date, date) TO authenticated;