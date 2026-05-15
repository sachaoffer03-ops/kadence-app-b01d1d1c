
DROP POLICY IF EXISTS "Studios visibles par les utilisateurs connectés" ON public.studios;
CREATE POLICY "Studios visibles par les utilisateurs connectés"
  ON public.studios FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);
