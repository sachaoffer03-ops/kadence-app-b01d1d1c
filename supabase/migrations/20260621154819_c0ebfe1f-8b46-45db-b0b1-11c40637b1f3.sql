-- =========================================================
-- Phase 1 : Shifts hybrides — colonnes, validation, garde
-- =========================================================

-- 1) Colonnes role_segments
ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS role_segments JSONB;
COMMENT ON COLUMN public.shifts.role_segments IS
  'Si non null : array de segments [{role, start_time HH:MM, end_time HH:MM}]. Si null : shift mono-rôle, lire business_role.';

ALTER TABLE public.staffing_templates
  ADD COLUMN IF NOT EXISTS role_segments JSONB;
COMMENT ON COLUMN public.staffing_templates.role_segments IS
  'Si non null : besoin hybride, array de segments. Si null : besoin mono-rôle, lire business_role.';

-- 2) Fonction de validation de structure (IMMUTABLE -> utilisable dans un CHECK)
CREATE OR REPLACE FUNCTION public.validate_role_segments_structure(
  segments JSONB,
  shift_start TIME,
  shift_end TIME
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  i INT;
  seg JSONB;
  seg_start TIME;
  seg_end TIME;
  prev_end TIME;
  arr_len INT;
BEGIN
  IF segments IS NULL THEN RETURN TRUE; END IF;
  IF jsonb_typeof(segments) != 'array' THEN RETURN FALSE; END IF;

  arr_len := jsonb_array_length(segments);
  IF arr_len < 2 THEN RETURN FALSE; END IF;

  prev_end := NULL;

  FOR i IN 0..arr_len-1 LOOP
    seg := segments->i;

    IF NOT (seg ? 'role' AND seg ? 'start_time' AND seg ? 'end_time') THEN
      RETURN FALSE;
    END IF;

    BEGIN
      seg_start := (seg->>'start_time')::TIME;
      seg_end := (seg->>'end_time')::TIME;
    EXCEPTION WHEN OTHERS THEN
      RETURN FALSE;
    END;

    -- Granularité 15 min
    IF EXTRACT(MINUTE FROM seg_start)::INT % 15 != 0
       OR EXTRACT(MINUTE FROM seg_end)::INT % 15 != 0
       OR EXTRACT(SECOND FROM seg_start) != 0
       OR EXTRACT(SECOND FROM seg_end) != 0 THEN
      RETURN FALSE;
    END IF;

    IF seg_start >= seg_end THEN RETURN FALSE; END IF;
    IF i = 0 AND seg_start != shift_start THEN RETURN FALSE; END IF;
    IF i = arr_len - 1 AND seg_end != shift_end THEN RETURN FALSE; END IF;
    IF prev_end IS NOT NULL AND seg_start != prev_end THEN RETURN FALSE; END IF;

    prev_end := seg_end;
  END LOOP;

  RETURN TRUE;
END;
$$;

-- 3) CHECK constraints
ALTER TABLE public.shifts
  DROP CONSTRAINT IF EXISTS shifts_role_segments_structure_valid;
ALTER TABLE public.shifts
  ADD CONSTRAINT shifts_role_segments_structure_valid
  CHECK (
    role_segments IS NULL
    OR public.validate_role_segments_structure(role_segments, start_time, end_time)
  );

ALTER TABLE public.staffing_templates
  DROP CONSTRAINT IF EXISTS templates_role_segments_structure_valid;
ALTER TABLE public.staffing_templates
  ADD CONSTRAINT templates_role_segments_structure_valid
  CHECK (
    role_segments IS NULL
    OR public.validate_role_segments_structure(role_segments, start_time, end_time)
  );

-- 4) Trigger pour valider que les rôles référencés existent
CREATE OR REPLACE FUNCTION public.trg_validate_role_segments_roles()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  seg JSONB;
  i INT;
  arr_len INT;
  role_name TEXT;
  role_exists BOOLEAN;
BEGIN
  IF NEW.role_segments IS NULL THEN RETURN NEW; END IF;

  arr_len := jsonb_array_length(NEW.role_segments);
  FOR i IN 0..arr_len-1 LOOP
    seg := NEW.role_segments->i;
    role_name := seg->>'role';

    SELECT EXISTS(
      SELECT 1 FROM public.business_roles WHERE name = role_name
    ) INTO role_exists;

    IF NOT role_exists THEN
      RAISE EXCEPTION 'Rôle inconnu dans role_segments[%]: %', i, role_name
        USING ERRCODE = '23514';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shifts_validate_segments_roles ON public.shifts;
CREATE TRIGGER trg_shifts_validate_segments_roles
  BEFORE INSERT OR UPDATE OF role_segments ON public.shifts
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_validate_role_segments_roles();

DROP TRIGGER IF EXISTS trg_templates_validate_segments_roles ON public.staffing_templates;
CREATE TRIGGER trg_templates_validate_segments_roles
  BEFORE INSERT OR UPDATE OF role_segments ON public.staffing_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_validate_role_segments_roles();

-- 5) Renforce la garde employé : interdit la modification de role_segments
CREATE OR REPLACE FUNCTION public.trg_shifts_employee_clock_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL
     OR public.has_role(auth.uid(), 'admin'::app_role)
     OR public.has_role(auth.uid(), 'manager'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.shift_date IS DISTINCT FROM OLD.shift_date
     OR NEW.start_time IS DISTINCT FROM OLD.start_time
     OR NEW.end_time IS DISTINCT FROM OLD.end_time
     OR NEW.business_role IS DISTINCT FROM OLD.business_role
     OR NEW.studio_id IS DISTINCT FROM OLD.studio_id
     OR NEW.is_locked IS DISTINCT FROM OLD.is_locked
     OR NEW.is_manual IS DISTINCT FROM OLD.is_manual
     OR NEW.published_at IS DISTINCT FROM OLD.published_at
     OR NEW.role_segments IS DISTINCT FROM OLD.role_segments
  THEN
    RAISE EXCEPTION 'Un employé ne peut modifier que son pointage (clocked_in/out, status, notes)';
  END IF;
  RETURN NEW;
END;
$function$;