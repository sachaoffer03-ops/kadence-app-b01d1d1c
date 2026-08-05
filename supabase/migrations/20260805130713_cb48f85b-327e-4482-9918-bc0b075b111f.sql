DROP POLICY IF EXISTS "Admins gèrent planning_runs" ON public.planning_runs;
CREATE POLICY "Admins/managers gèrent planning_runs"
ON public.planning_runs FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planning_runs TO authenticated;
GRANT ALL ON public.planning_runs TO service_role;