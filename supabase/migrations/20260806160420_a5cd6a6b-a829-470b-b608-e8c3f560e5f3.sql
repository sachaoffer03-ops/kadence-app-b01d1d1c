DROP POLICY IF EXISTS "Employés pointent leurs shifts" ON public.shifts;

CREATE POLICY "Employés pointent leurs shifts"
ON public.shifts
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);