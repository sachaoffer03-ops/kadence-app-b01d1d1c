CREATE POLICY "Managers with staff:invite can view invitations"
ON public.invitations
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'manager'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.manager_permissions mp
    WHERE mp.user_id = auth.uid()
      AND '/staff:invite' = ANY(mp.permissions)
  )
);