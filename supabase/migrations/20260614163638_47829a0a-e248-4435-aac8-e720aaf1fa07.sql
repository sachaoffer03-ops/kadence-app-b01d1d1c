-- Promote owner Sacha to admin (he was 'employee', blocking him from saving settings)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM public.profiles WHERE email = 'sachaoffer03@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

DELETE FROM public.user_roles
WHERE role = 'employee'
  AND user_id IN (SELECT id FROM public.profiles WHERE email = 'sachaoffer03@gmail.com');

-- Allow managers to also manage AI planning settings (currently admin-only, which
-- silently blocked saves for non-admin users and explains why the deadline never
-- updated for employees / reminder emails).
DROP POLICY IF EXISTS "Managers gèrent les réglages IA" ON public.ai_planning_settings;
CREATE POLICY "Managers gèrent les réglages IA"
  ON public.ai_planning_settings
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'manager'::app_role));
