
-- 1) closure_questions: allow authenticated users to read
CREATE POLICY "Authenticated read closure questions"
ON public.closure_questions
FOR SELECT
TO authenticated
USING (true);

-- 2) Tighten profiles UPDATE WITH CHECK (defense-in-depth)
DROP POLICY IF EXISTS "Utilisateurs modifient leur propre profil" ON public.profiles;
CREATE POLICY "Utilisateurs modifient leur propre profil"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (
      iban               IS NOT DISTINCT FROM (SELECT p.iban               FROM public.profiles p WHERE p.id = auth.uid())
      AND niss           IS NOT DISTINCT FROM (SELECT p.niss               FROM public.profiles p WHERE p.id = auth.uid())
      AND hourly_rate    IS NOT DISTINCT FROM (SELECT p.hourly_rate        FROM public.profiles p WHERE p.id = auth.uid())
      AND score          IS NOT DISTINCT FROM (SELECT p.score              FROM public.profiles p WHERE p.id = auth.uid())
      AND quota_used     IS NOT DISTINCT FROM (SELECT p.quota_used         FROM public.profiles p WHERE p.id = auth.uid())
      AND quota_max      IS NOT DISTINCT FROM (SELECT p.quota_max          FROM public.profiles p WHERE p.id = auth.uid())
      AND status         IS NOT DISTINCT FROM (SELECT p.status             FROM public.profiles p WHERE p.id = auth.uid())
      AND contract       IS NOT DISTINCT FROM (SELECT p.contract           FROM public.profiles p WHERE p.id = auth.uid())
      AND studio_id      IS NOT DISTINCT FROM (SELECT p.studio_id          FROM public.profiles p WHERE p.id = auth.uid())
      AND hire_date      IS NOT DISTINCT FROM (SELECT p.hire_date          FROM public.profiles p WHERE p.id = auth.uid())
      AND is_protected   IS NOT DISTINCT FROM (SELECT p.is_protected       FROM public.profiles p WHERE p.id = auth.uid())
      AND is_test        IS NOT DISTINCT FROM (SELECT p.is_test            FROM public.profiles p WHERE p.id = auth.uid())
      AND student_card_valid IS NOT DISTINCT FROM (SELECT p.student_card_valid FROM public.profiles p WHERE p.id = auth.uid())
    )
  )
);

-- 3) Studios: revoke sensitive column SELECT from non-admin roles
REVOKE SELECT (current_qr_code, qr_generated_at, internal_notes, lat, lng)
  ON public.studios FROM authenticated;
REVOKE SELECT (current_qr_code, qr_generated_at, internal_notes, lat, lng)
  ON public.studios FROM anon;

-- 4) Admin/manager-only helper for studio internal notes
CREATE OR REPLACE FUNCTION public.get_studio_internal_notes(_studio_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v text;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'manager'::app_role)) THEN
    RETURN NULL;
  END IF;
  SELECT internal_notes INTO v FROM public.studios WHERE id = _studio_id;
  RETURN v;
END;
$$;

REVOKE ALL ON FUNCTION public.get_studio_internal_notes(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_studio_internal_notes(uuid) TO authenticated;
