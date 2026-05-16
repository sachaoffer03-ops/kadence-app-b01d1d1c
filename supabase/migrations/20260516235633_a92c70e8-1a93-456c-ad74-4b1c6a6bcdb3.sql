
-- Garde-fou : employé ne peut modifier QUE clocked_in_at, clocked_out_at, status, notes
CREATE OR REPLACE FUNCTION public.trg_shifts_employee_clock_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Si admin/manager, on laisse passer
  IF public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role) THEN
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
$$;

DROP TRIGGER IF EXISTS shifts_employee_clock_guard ON public.shifts;
CREATE TRIGGER shifts_employee_clock_guard
BEFORE UPDATE ON public.shifts
FOR EACH ROW EXECUTE FUNCTION public.trg_shifts_employee_clock_guard();

-- Policy : employé peut UPDATE son propre shift (le trigger contraint les champs)
CREATE POLICY "Employés pointent leurs shifts"
ON public.shifts
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
