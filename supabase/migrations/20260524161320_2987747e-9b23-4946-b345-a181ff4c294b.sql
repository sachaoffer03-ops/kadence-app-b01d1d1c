
-- 1. Restrict invitations SELECT to authenticated only (token lookup still works for activation page when user is logged in / token is the secret)
DROP POLICY IF EXISTS "Lecture publique par token (pour activation)" ON public.invitations;
CREATE POLICY "Lecture par token (activation)" ON public.invitations
  FOR SELECT TO authenticated USING (true);

-- 2. Tighten formation-videos storage policies (admin/manager only for write/update/delete)
DROP POLICY IF EXISTS "Anyone can upload formation videos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update formation videos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete formation videos" ON storage.objects;

CREATE POLICY "Admins manage formation videos insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'formation-videos'
    AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role)));

CREATE POLICY "Admins manage formation videos update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'formation-videos'
    AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role)));

CREATE POLICY "Admins manage formation videos delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'formation-videos'
    AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role)));

-- 3. Prevent employees from self-modifying sensitive profile fields via trigger
CREATE OR REPLACE FUNCTION public.trg_profiles_protect_sensitive_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service role or admin: allow everything
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  -- For non-admin updates, lock down sensitive fields back to OLD value
  NEW.iban := OLD.iban;
  NEW.niss := OLD.niss;
  NEW.score := OLD.score;
  NEW.quota_used := OLD.quota_used;
  NEW.quota_max := OLD.quota_max;
  NEW.hourly_rate := OLD.hourly_rate;
  NEW.status := OLD.status;
  NEW.contract := OLD.contract;
  NEW.studio_id := OLD.studio_id;
  NEW.hire_date := OLD.hire_date;
  NEW.is_protected := OLD.is_protected;
  NEW.is_test := OLD.is_test;
  NEW.student_card_valid := OLD.student_card_valid;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_sensitive_fields ON public.profiles;
CREATE TRIGGER profiles_protect_sensitive_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.trg_profiles_protect_sensitive_fields();

-- 4. Add search_path to email queue functions
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;
