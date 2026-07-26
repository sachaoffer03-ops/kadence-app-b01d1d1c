ALTER TYPE public.profile_status ADD VALUE IF NOT EXISTS 'deleted';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS anon_id uuid;

CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  anon_id uuid NOT NULL,
  email_hash text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  purge_auth_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  purged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.account_deletion_requests TO authenticated;
GRANT ALL ON public.account_deletion_requests TO service_role;

ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view deletion requests" ON public.account_deletion_requests;
CREATE POLICY "Admins can view deletion requests"
  ON public.account_deletion_requests FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS set_account_deletion_requests_updated_at ON public.account_deletion_requests;
CREATE TRIGGER set_account_deletion_requests_updated_at
  BEFORE UPDATE ON public.account_deletion_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Le garde-fou "champs sensibles" doit laisser passer l'anonymisation RGPD
CREATE OR REPLACE FUNCTION public.trg_profiles_protect_sensitive_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL
     OR public.has_role(auth.uid(), 'admin'::app_role)
     OR coalesce(current_setting('kadence.account_deletion', true), '') = '1' THEN
    RETURN NEW;
  END IF;

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
  NEW.allow_extended_hours := OLD.allow_extended_hours;
  NEW.weekly_hours_cap := OLD.weekly_hours_cap;
  RETURN NEW;
END;
$function$;
