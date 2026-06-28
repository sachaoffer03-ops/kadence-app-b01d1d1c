
-- 1. Fix mutable search_path
ALTER FUNCTION public.validate_role_segments_structure(jsonb, time, time) SET search_path = public;

-- 2. Tighten self-update policy to freeze allow_extended_hours, weekly_hours_cap, ai_contributor
DROP POLICY IF EXISTS "Utilisateurs modifient leur propre profil" ON public.profiles;

CREATE POLICY "Utilisateurs modifient leur propre profil"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR (
      NOT (iban IS DISTINCT FROM (SELECT p.iban FROM profiles p WHERE p.id = auth.uid()))
      AND NOT (niss IS DISTINCT FROM (SELECT p.niss FROM profiles p WHERE p.id = auth.uid()))
      AND NOT (hourly_rate IS DISTINCT FROM (SELECT p.hourly_rate FROM profiles p WHERE p.id = auth.uid()))
      AND NOT (score IS DISTINCT FROM (SELECT p.score FROM profiles p WHERE p.id = auth.uid()))
      AND NOT (quota_used IS DISTINCT FROM (SELECT p.quota_used FROM profiles p WHERE p.id = auth.uid()))
      AND NOT (quota_max IS DISTINCT FROM (SELECT p.quota_max FROM profiles p WHERE p.id = auth.uid()))
      AND NOT (status IS DISTINCT FROM (SELECT p.status FROM profiles p WHERE p.id = auth.uid()))
      AND NOT (contract IS DISTINCT FROM (SELECT p.contract FROM profiles p WHERE p.id = auth.uid()))
      AND NOT (studio_id IS DISTINCT FROM (SELECT p.studio_id FROM profiles p WHERE p.id = auth.uid()))
      AND NOT (hire_date IS DISTINCT FROM (SELECT p.hire_date FROM profiles p WHERE p.id = auth.uid()))
      AND NOT (is_protected IS DISTINCT FROM (SELECT p.is_protected FROM profiles p WHERE p.id = auth.uid()))
      AND NOT (is_test IS DISTINCT FROM (SELECT p.is_test FROM profiles p WHERE p.id = auth.uid()))
      AND NOT (student_card_valid IS DISTINCT FROM (SELECT p.student_card_valid FROM profiles p WHERE p.id = auth.uid()))
      AND NOT (allow_extended_hours IS DISTINCT FROM (SELECT p.allow_extended_hours FROM profiles p WHERE p.id = auth.uid()))
      AND NOT (weekly_hours_cap IS DISTINCT FROM (SELECT p.weekly_hours_cap FROM profiles p WHERE p.id = auth.uid()))
      AND NOT (ai_contributor IS DISTINCT FROM (SELECT p.ai_contributor FROM profiles p WHERE p.id = auth.uid()))
    )
  )
);
