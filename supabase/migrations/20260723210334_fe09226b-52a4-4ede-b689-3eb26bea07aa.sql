DROP POLICY IF EXISTS "Admins upload reference photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins update reference photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins delete reference photos" ON storage.objects;

CREATE POLICY "Admins and managers upload reference photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'checklist-photos'
    AND (storage.foldername(name))[1] = 'references'
    AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
  );

CREATE POLICY "Admins and managers update reference photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'checklist-photos'
    AND (storage.foldername(name))[1] = 'references'
    AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
  );

CREATE POLICY "Admins and managers delete reference photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'checklist-photos'
    AND (storage.foldername(name))[1] = 'references'
    AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
  );