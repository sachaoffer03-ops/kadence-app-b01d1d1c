
CREATE OR REPLACE FUNCTION public.has_manager_permission(_user_id uuid, _perm text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.manager_permissions
    WHERE user_id = _user_id
      AND _perm = ANY(permissions)
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_manager_permission(uuid, text) TO authenticated;

DROP POLICY IF EXISTS "Admins and managers upload reference photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins and managers update reference photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins and managers delete reference photos" ON storage.objects;

CREATE POLICY "Admins and permitted managers upload reference photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'checklist-photos'
  AND (storage.foldername(name))[1] = 'references'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (public.has_role(auth.uid(), 'manager'::app_role)
        AND public.has_manager_permission(auth.uid(), '/cloture:edit_checklists'))
  )
);

CREATE POLICY "Admins and permitted managers update reference photos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'checklist-photos'
  AND (storage.foldername(name))[1] = 'references'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (public.has_role(auth.uid(), 'manager'::app_role)
        AND public.has_manager_permission(auth.uid(), '/cloture:edit_checklists'))
  )
);

CREATE POLICY "Admins and permitted managers delete reference photos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'checklist-photos'
  AND (storage.foldername(name))[1] = 'references'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (public.has_role(auth.uid(), 'manager'::app_role)
        AND public.has_manager_permission(auth.uid(), '/cloture:edit_checklists'))
  )
);
