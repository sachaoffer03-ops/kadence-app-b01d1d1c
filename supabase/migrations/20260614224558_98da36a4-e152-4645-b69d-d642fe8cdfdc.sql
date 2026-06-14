
-- 1. Add columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS allow_extended_hours boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS weekly_hours_cap integer;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_weekly_hours_cap_range
  CHECK (weekly_hours_cap IS NULL OR (weekly_hours_cap >= 1 AND weekly_hours_cap <= 48));

-- 2. Update the protect-sensitive-fields trigger to also lock these new fields for non-admins
CREATE OR REPLACE FUNCTION public.trg_profiles_protect_sensitive_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin'::app_role) THEN
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

-- 3. Audit log table
CREATE TABLE IF NOT EXISTS public.extended_hours_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  previous_allowed boolean,
  new_allowed boolean,
  previous_cap integer,
  new_cap integer,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.extended_hours_audit TO authenticated;
GRANT ALL ON public.extended_hours_audit TO service_role;

ALTER TABLE public.extended_hours_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can view audit"
  ON public.extended_hours_audit FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admins and managers can insert audit"
  ON public.extended_hours_audit FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

CREATE INDEX IF NOT EXISTS idx_extended_hours_audit_user ON public.extended_hours_audit(user_id, created_at DESC);
