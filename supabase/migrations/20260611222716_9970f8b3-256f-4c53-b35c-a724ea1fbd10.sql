
DROP POLICY IF EXISTS "Employés pointent leurs shifts" ON public.shifts;

CREATE POLICY "Employés pointent leurs shifts"
ON public.shifts
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.shifts s
    WHERE s.id = shifts.id
      AND s.user_id        IS NOT DISTINCT FROM shifts.user_id
      AND s.studio_id      IS NOT DISTINCT FROM shifts.studio_id
      AND s.business_role  IS NOT DISTINCT FROM shifts.business_role
      AND s.shift_date     IS NOT DISTINCT FROM shifts.shift_date
      AND s.start_time     IS NOT DISTINCT FROM shifts.start_time
      AND s.end_time       IS NOT DISTINCT FROM shifts.end_time
      AND s.status         IS NOT DISTINCT FROM shifts.status
      AND s.notes          IS NOT DISTINCT FROM shifts.notes
      AND s.is_locked      IS NOT DISTINCT FROM shifts.is_locked
      AND s.is_manual      IS NOT DISTINCT FROM shifts.is_manual
      AND s.published_at   IS NOT DISTINCT FROM shifts.published_at
      AND s.dimona_status  IS NOT DISTINCT FROM shifts.dimona_status
      AND s.clock_admin_note IS NOT DISTINCT FROM shifts.clock_admin_note
  )
);
