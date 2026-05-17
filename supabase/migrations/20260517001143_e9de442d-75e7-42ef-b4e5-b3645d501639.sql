
CREATE OR REPLACE FUNCTION public.trg_shifts_employee_clock_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Service role (auth.uid() NULL) ou admin/manager : on laisse passer
  IF auth.uid() IS NULL
     OR public.has_role(auth.uid(), 'admin'::app_role)
     OR public.has_role(auth.uid(), 'manager'::app_role) THEN
    RETURN NEW;
  END IF;

  -- Sinon (employé), seuls les champs de pointage sont modifiables
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.shift_date IS DISTINCT FROM OLD.shift_date
     OR NEW.start_time IS DISTINCT FROM OLD.start_time
     OR NEW.end_time IS DISTINCT FROM OLD.end_time
     OR NEW.business_role IS DISTINCT FROM OLD.business_role
     OR NEW.studio_id IS DISTINCT FROM OLD.studio_id
     OR NEW.is_locked IS DISTINCT FROM OLD.is_locked
     OR NEW.is_manual IS DISTINCT FROM OLD.is_manual
     OR NEW.published_at IS DISTINCT FROM OLD.published_at
  THEN
    RAISE EXCEPTION 'Un employé ne peut modifier que son pointage (clocked_in/out, status, notes)';
  END IF;
  RETURN NEW;
END;
$function$;
