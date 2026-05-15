
-- 1. Colonne minutes_late sur shifts (via trigger pour rester portable)
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS minutes_late integer;

CREATE OR REPLACE FUNCTION public.shifts_compute_minutes_late()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.clocked_in_at IS NULL THEN
    NEW.minutes_late := NULL;
  ELSE
    NEW.minutes_late := GREATEST(
      0,
      FLOOR(EXTRACT(EPOCH FROM (NEW.clocked_in_at - ((NEW.shift_date::timestamp) + NEW.start_time))) / 60.0)::integer
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shifts_minutes_late ON public.shifts;
CREATE TRIGGER trg_shifts_minutes_late
BEFORE INSERT OR UPDATE OF clocked_in_at, start_time, shift_date ON public.shifts
FOR EACH ROW EXECUTE FUNCTION public.shifts_compute_minutes_late();

-- Backfill
UPDATE public.shifts SET clocked_in_at = clocked_in_at WHERE clocked_in_at IS NOT NULL;

-- 2. Fonction de calcul du score d'un profil
CREATE OR REPLACE FUNCTION public.calculate_profile_score(target_user_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_score numeric;
  lambda numeric := 0.01;
  manager_s numeric;
  punct_s numeric;
  checklist_s numeric;
  manager_w numeric;
  punct_w numeric;
  checklist_w numeric;
  final_s numeric;
BEGIN
  SELECT COALESCE(default_score_when_null, 7.0) INTO default_score
  FROM public.ai_planning_settings LIMIT 1;
  IF default_score IS NULL THEN default_score := 7.0; END IF;

  -- Composante 1 : note manager (feedbacks sur shifts de l'employé)
  SELECT
    SUM((LEAST(f.rating, 5)::numeric * 2.0) * EXP(-lambda * GREATEST(0, EXTRACT(EPOCH FROM (now() - f.created_at)) / 86400.0))),
    SUM(EXP(-lambda * GREATEST(0, EXTRACT(EPOCH FROM (now() - f.created_at)) / 86400.0)))
  INTO manager_s, manager_w
  FROM public.feedbacks f
  JOIN public.shifts s ON s.id = f.shift_id
  WHERE s.user_id = target_user_id
    AND f.author_id <> target_user_id;

  IF manager_w IS NULL OR manager_w = 0 THEN
    manager_s := default_score;
  ELSE
    manager_s := manager_s / manager_w;
  END IF;

  -- Composante 2 : ponctualité (60 derniers shifts passés)
  WITH last_shifts AS (
    SELECT
      sh.shift_date,
      sh.minutes_late,
      sh.clocked_in_at,
      sh.published_at,
      CASE
        WHEN sh.minutes_late IS NULL AND sh.published_at IS NOT NULL
             AND ((sh.shift_date::timestamp) + sh.end_time) < now() THEN 0
        WHEN sh.minutes_late IS NULL THEN NULL
        WHEN sh.minutes_late = 0 THEN 10
        WHEN sh.minutes_late <= 5 THEN 9
        WHEN sh.minutes_late <= 15 THEN 7
        WHEN sh.minutes_late <= 30 THEN 4
        ELSE 1
      END AS pscore
    FROM public.shifts sh
    WHERE sh.user_id = target_user_id
      AND sh.shift_date <= CURRENT_DATE
    ORDER BY sh.shift_date DESC
    LIMIT 60
  )
  SELECT
    SUM(pscore * EXP(-lambda * GREATEST(0, (CURRENT_DATE - shift_date)))),
    SUM(EXP(-lambda * GREATEST(0, (CURRENT_DATE - shift_date))))
  INTO punct_s, punct_w
  FROM last_shifts WHERE pscore IS NOT NULL;

  IF punct_w IS NULL OR punct_w = 0 THEN
    punct_s := default_score;
  ELSE
    punct_s := punct_s / punct_w;
  END IF;

  -- Composante 3 : checklists (% items cochés par shift)
  WITH per_shift AS (
    SELECT
      sh.shift_date,
      COUNT(ci.id) AS total,
      COUNT(ci.checked_at) AS done
    FROM public.shifts sh
    JOIN public.shift_checklist_items ci ON ci.shift_id = sh.id
    WHERE sh.user_id = target_user_id
      AND sh.shift_date <= CURRENT_DATE
    GROUP BY sh.id, sh.shift_date
    HAVING COUNT(ci.id) > 0
    ORDER BY sh.shift_date DESC
    LIMIT 60
  )
  SELECT
    SUM((done::numeric / NULLIF(total,0)) * 10.0 * EXP(-lambda * GREATEST(0, (CURRENT_DATE - shift_date)))),
    SUM(EXP(-lambda * GREATEST(0, (CURRENT_DATE - shift_date))))
  INTO checklist_s, checklist_w
  FROM per_shift;

  IF checklist_w IS NULL OR checklist_w = 0 THEN
    checklist_s := default_score;
  ELSE
    checklist_s := checklist_s / checklist_w;
  END IF;

  final_s := ROUND(((manager_s + punct_s + checklist_s) / 3.0)::numeric, 2);
  RETURN final_s;
END;
$$;

-- 3. Recalcul batch
CREATE OR REPLACE FUNCTION public.recalculate_all_scores()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  r record;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role)) THEN
    RAISE EXCEPTION 'Réservé aux admins/managers';
  END IF;
  FOR r IN SELECT id FROM public.profiles WHERE status = 'active' LOOP
    UPDATE public.profiles
      SET score = public.calculate_profile_score(r.id), updated_at = now()
      WHERE id = r.id;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- 4. Trigger générique de recalcul
CREATE OR REPLACE FUNCTION public.trg_recalculate_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
BEGIN
  IF TG_TABLE_NAME = 'feedbacks' THEN
    SELECT user_id INTO v_user FROM public.shifts WHERE id = COALESCE(NEW.shift_id, OLD.shift_id);
  ELSIF TG_TABLE_NAME = 'shifts' THEN
    v_user := COALESCE(NEW.user_id, OLD.user_id);
  ELSIF TG_TABLE_NAME = 'shift_checklist_items' THEN
    SELECT user_id INTO v_user FROM public.shifts WHERE id = COALESCE(NEW.shift_id, OLD.shift_id);
  END IF;

  IF v_user IS NOT NULL THEN
    UPDATE public.profiles
      SET score = public.calculate_profile_score(v_user), updated_at = now()
      WHERE id = v_user;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_score_feedbacks ON public.feedbacks;
CREATE TRIGGER trg_score_feedbacks
AFTER INSERT OR UPDATE OR DELETE ON public.feedbacks
FOR EACH ROW EXECUTE FUNCTION public.trg_recalculate_score();

DROP TRIGGER IF EXISTS trg_score_shifts ON public.shifts;
CREATE TRIGGER trg_score_shifts
AFTER UPDATE OF clocked_in_at, clocked_out_at ON public.shifts
FOR EACH ROW EXECUTE FUNCTION public.trg_recalculate_score();

DROP TRIGGER IF EXISTS trg_score_checklist ON public.shift_checklist_items;
CREATE TRIGGER trg_score_checklist
AFTER INSERT OR UPDATE OF checked_at OR DELETE ON public.shift_checklist_items
FOR EACH ROW EXECUTE FUNCTION public.trg_recalculate_score();
