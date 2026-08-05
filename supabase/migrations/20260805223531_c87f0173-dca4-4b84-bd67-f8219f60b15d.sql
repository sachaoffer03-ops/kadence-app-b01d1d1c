ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS late_reason_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS clock_out_reason_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS reason_reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reason_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reason_review_note text;

ALTER TABLE public.shifts
  DROP CONSTRAINT IF EXISTS shifts_late_reason_status_check,
  ADD CONSTRAINT shifts_late_reason_status_check CHECK (late_reason_status IN ('pending','accepted','refused'));
ALTER TABLE public.shifts
  DROP CONSTRAINT IF EXISTS shifts_clock_out_reason_status_check,
  ADD CONSTRAINT shifts_clock_out_reason_status_check CHECK (clock_out_reason_status IN ('pending','accepted','refused'));

CREATE INDEX IF NOT EXISTS idx_shifts_late_reason_pending
  ON public.shifts (shift_date DESC)
  WHERE late_reason IS NOT NULL OR clock_out_reason IS NOT NULL;

CREATE OR REPLACE FUNCTION public.calculate_profile_score(target_user_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  default_score numeric;
  cutoff date;
  lambda numeric := 0.01;
  manager_s numeric; punct_s numeric; checklist_s numeric;
  manager_w numeric; punct_w numeric; checklist_w numeric;
  final_s numeric;
BEGIN
  SELECT COALESCE(default_score_when_null, 7.0), COALESCE(score_start_date, '2026-07-01'::date)
    INTO default_score, cutoff
  FROM public.ai_planning_settings LIMIT 1;
  IF default_score IS NULL THEN default_score := 7.0; END IF;
  IF cutoff IS NULL THEN cutoff := '2026-07-01'::date; END IF;

  SELECT
    SUM(LEAST(GREATEST(f.rating::numeric, 0), 10) * EXP(-lambda * GREATEST(0, EXTRACT(EPOCH FROM (now() - f.created_at)) / 86400.0))),
    SUM(EXP(-lambda * GREATEST(0, EXTRACT(EPOCH FROM (now() - f.created_at)) / 86400.0)))
  INTO manager_s, manager_w
  FROM public.feedbacks f
  JOIN public.shifts s ON s.id = f.shift_id
  WHERE s.user_id = target_user_id AND f.author_id <> target_user_id;
  IF manager_w IS NULL OR manager_w = 0 THEN manager_s := default_score;
  ELSE manager_s := manager_s / manager_w; END IF;

  -- Ponctualité : retard justifié ET accepté => ignoré (non comptabilisé).
  WITH last_shifts AS (
    SELECT sh.shift_date, sh.minutes_late,
      CASE
        WHEN sh.minutes_late IS NOT NULL
             AND sh.late_reason IS NOT NULL
             AND sh.late_reason_status = 'accepted' THEN NULL
        WHEN sh.minutes_late IS NULL THEN
          CASE WHEN sh.shift_date >= cutoff
                AND sh.published_at IS NOT NULL
                AND ((sh.shift_date::timestamp) + sh.end_time) < now()
                AND sh.status <> 'cancelled'
               THEN 0 ELSE NULL END
        WHEN sh.minutes_late = 0 THEN 10
        WHEN sh.minutes_late <= 5 THEN 9
        WHEN sh.minutes_late <= 15 THEN 7
        WHEN sh.minutes_late <= 30 THEN 4
        ELSE 1
      END AS pscore
    FROM public.shifts sh
    WHERE sh.user_id = target_user_id AND sh.shift_date <= CURRENT_DATE
    ORDER BY sh.shift_date DESC LIMIT 60
  )
  SELECT
    SUM(pscore * EXP(-lambda * GREATEST(0, (CURRENT_DATE - shift_date)))),
    SUM(EXP(-lambda * GREATEST(0, (CURRENT_DATE - shift_date))))
  INTO punct_s, punct_w
  FROM last_shifts WHERE pscore IS NOT NULL;
  IF punct_w IS NULL OR punct_w = 0 THEN punct_s := default_score;
  ELSE punct_s := punct_s / punct_w; END IF;

  WITH past_shifts AS (
    SELECT sh.id, sh.shift_date, sh.studio_id
    FROM public.shifts sh
    WHERE sh.user_id = target_user_id
      AND sh.shift_date <= CURRENT_DATE
      AND ((sh.shift_date::timestamp) + sh.end_time) < now()
      AND sh.published_at IS NOT NULL
      AND sh.status <> 'cancelled'
    ORDER BY sh.shift_date DESC LIMIT 60
  ),
  per_submission AS (
    SELECT
      sub.id AS submission_id,
      sub.shift_id,
      (SELECT COUNT(*) FROM public.checklist_template_items WHERE template_id = sub.template_id)
      + (SELECT COUNT(*) FROM public.checklist_template_photos WHERE template_id = sub.template_id) AS total_units,
      (SELECT COUNT(*) FROM public.checklist_submission_items csi WHERE csi.submission_id = sub.id AND csi.is_checked)
      + (SELECT COUNT(*) FROM public.checklist_submission_photos csp
         WHERE csp.submission_id = sub.id
           AND csp.photo_url IS NOT NULL
           AND (COALESCE(csp.ai_validation_status,'ok') NOT IN ('flagged','rejected') OR csp.admin_override_by IS NOT NULL)
        ) AS done_units
    FROM public.checklist_submissions sub
    WHERE sub.user_id = target_user_id
      AND sub.shift_id IN (SELECT id FROM past_shifts)
  ),
  per_shift AS (
    SELECT ps.shift_date,
      COALESCE(
        (SELECT
           CASE WHEN SUM(total_units) = 0 THEN NULL
                ELSE SUM(done_units)::numeric / SUM(total_units)::numeric * 10
           END
         FROM per_submission psub WHERE psub.shift_id = ps.id),
        CASE WHEN ps.shift_date >= cutoff
              AND EXISTS (SELECT 1 FROM public.checklist_templates ct
                          WHERE ct.studio_id = ps.studio_id AND ct.is_active)
             THEN 0 ELSE NULL END
      ) AS cscore
    FROM past_shifts ps
  )
  SELECT
    SUM(cscore * EXP(-lambda * GREATEST(0, (CURRENT_DATE - shift_date)))),
    SUM(EXP(-lambda * GREATEST(0, (CURRENT_DATE - shift_date))))
  INTO checklist_s, checklist_w
  FROM per_shift WHERE cscore IS NOT NULL;
  IF checklist_w IS NULL OR checklist_w = 0 THEN checklist_s := default_score;
  ELSE checklist_s := checklist_s / checklist_w; END IF;

  final_s := ROUND(((manager_s + punct_s + checklist_s) / 3.0)::numeric, 2);
  RETURN final_s;
END;
$function$;