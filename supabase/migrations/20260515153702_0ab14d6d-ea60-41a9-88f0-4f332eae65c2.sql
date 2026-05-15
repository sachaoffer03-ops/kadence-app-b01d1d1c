-- =========================================================
-- PHASE 1 : Refonte module Checklists
-- =========================================================

-- 1. DROP anciennes tables (cascade pour policies/triggers)
DROP TABLE IF EXISTS public.shift_checklist_items CASCADE;
DROP TABLE IF EXISTS public.checklist_templates CASCADE;

-- =========================================================
-- 2. NOUVELLES TABLES
-- =========================================================

CREATE TABLE public.checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  business_role_id uuid REFERENCES public.business_roles(id) ON DELETE CASCADE,
  studio_id uuid REFERENCES public.studios(id) ON DELETE CASCADE,
  is_blocking boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.checklist_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.checklist_templates(id) ON DELETE CASCADE,
  label text NOT NULL,
  description text,
  order_index integer NOT NULL DEFAULT 0,
  is_required boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.checklist_template_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.checklist_templates(id) ON DELETE CASCADE,
  label text NOT NULL,
  description text,
  reference_photo_url text,
  order_index integer NOT NULL DEFAULT 0,
  is_required boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.checklist_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid NOT NULL,
  user_id uuid NOT NULL,
  template_id uuid NOT NULL REFERENCES public.checklist_templates(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','incomplete_submitted')),
  employee_note text,
  submitted_at timestamptz,
  reviewed_by_admin_at timestamptz,
  reviewed_by_admin_id uuid,
  admin_feedback text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(shift_id, template_id)
);

CREATE TABLE public.checklist_submission_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.checklist_submissions(id) ON DELETE CASCADE,
  template_item_id uuid NOT NULL REFERENCES public.checklist_template_items(id) ON DELETE CASCADE,
  is_checked boolean NOT NULL DEFAULT false,
  checked_at timestamptz,
  UNIQUE(submission_id, template_item_id)
);

CREATE TABLE public.checklist_submission_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.checklist_submissions(id) ON DELETE CASCADE,
  template_photo_id uuid NOT NULL REFERENCES public.checklist_template_photos(id) ON DELETE CASCADE,
  photo_url text,
  uploaded_at timestamptz,
  ai_validation_status text CHECK (ai_validation_status IN ('pending','ok','flagged','not_processed')),
  ai_validation_message text,
  ai_validated_at timestamptz,
  UNIQUE(submission_id, template_photo_id)
);

-- Index
CREATE INDEX idx_checklist_templates_role ON public.checklist_templates(business_role_id);
CREATE INDEX idx_checklist_templates_studio ON public.checklist_templates(studio_id);
CREATE INDEX idx_checklist_template_items_template ON public.checklist_template_items(template_id);
CREATE INDEX idx_checklist_template_photos_template ON public.checklist_template_photos(template_id);
CREATE INDEX idx_checklist_submissions_shift ON public.checklist_submissions(shift_id);
CREATE INDEX idx_checklist_submissions_user ON public.checklist_submissions(user_id);
CREATE INDEX idx_checklist_submissions_status ON public.checklist_submissions(status);
CREATE INDEX idx_checklist_submission_items_sub ON public.checklist_submission_items(submission_id);
CREATE INDEX idx_checklist_submission_photos_sub ON public.checklist_submission_photos(submission_id);

-- updated_at triggers
CREATE TRIGGER trg_checklist_templates_updated BEFORE UPDATE ON public.checklist_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_checklist_submissions_updated BEFORE UPDATE ON public.checklist_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 3. RLS
-- =========================================================
ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_template_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_submission_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_submission_photos ENABLE ROW LEVEL SECURITY;

-- Templates : tous les authentifiés voient les modèles actifs, admins gèrent
CREATE POLICY "Auth read active templates" ON public.checklist_templates
  FOR SELECT TO authenticated USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage templates" ON public.checklist_templates
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Auth read template items" ON public.checklist_template_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage template items" ON public.checklist_template_items
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Auth read template photos" ON public.checklist_template_photos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage template photos" ON public.checklist_template_photos
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Soumissions
CREATE POLICY "Users see own submissions or admin/manager"
  ON public.checklist_submissions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Users create own submissions"
  ON public.checklist_submissions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own submissions or admin"
  ON public.checklist_submissions FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete submissions"
  ON public.checklist_submissions FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users manage own submission items"
  ON public.checklist_submission_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.checklist_submissions s WHERE s.id = submission_id AND (s.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.checklist_submissions s WHERE s.id = submission_id AND (s.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))));

CREATE POLICY "Users manage own submission photos"
  ON public.checklist_submission_photos FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.checklist_submissions s WHERE s.id = submission_id AND (s.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.checklist_submissions s WHERE s.id = submission_id AND (s.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))));

-- =========================================================
-- 4. STORAGE BUCKET
-- =========================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('checklist-photos', 'checklist-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Lecture : tous les authentifiés
CREATE POLICY "Auth read checklist photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'checklist-photos');

-- Admins uploadent dans references/
CREATE POLICY "Admins upload reference photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'checklist-photos' AND (storage.foldername(name))[1] = 'references' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update reference photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'checklist-photos' AND (storage.foldername(name))[1] = 'references' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete reference photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'checklist-photos' AND (storage.foldername(name))[1] = 'references' AND has_role(auth.uid(), 'admin'::app_role));

-- Employés uploadent dans submissions/{user_id}/
CREATE POLICY "Users upload own submission photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'checklist-photos' AND (storage.foldername(name))[1] = 'submissions' AND (storage.foldername(name))[2] = auth.uid()::text);
CREATE POLICY "Users update own submission photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'checklist-photos' AND (storage.foldername(name))[1] = 'submissions' AND (storage.foldername(name))[2] = auth.uid()::text);
CREATE POLICY "Users delete own submission photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'checklist-photos' AND (storage.foldername(name))[1] = 'submissions' AND ((storage.foldername(name))[2] = auth.uid()::text OR has_role(auth.uid(), 'admin'::app_role)));

-- =========================================================
-- 5. SCORING : refonte composante checklist
-- =========================================================
CREATE OR REPLACE FUNCTION public.calculate_profile_score(target_user_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  -- Composante 1 : note manager
  SELECT
    SUM((LEAST(f.rating, 5)::numeric * 2.0) * EXP(-lambda * GREATEST(0, EXTRACT(EPOCH FROM (now() - f.created_at)) / 86400.0))),
    SUM(EXP(-lambda * GREATEST(0, EXTRACT(EPOCH FROM (now() - f.created_at)) / 86400.0)))
  INTO manager_s, manager_w
  FROM public.feedbacks f
  JOIN public.shifts s ON s.id = f.shift_id
  WHERE s.user_id = target_user_id AND f.author_id <> target_user_id;

  IF manager_w IS NULL OR manager_w = 0 THEN manager_s := default_score;
  ELSE manager_s := manager_s / manager_w; END IF;

  -- Composante 2 : ponctualité
  WITH last_shifts AS (
    SELECT sh.shift_date, sh.minutes_late,
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

  -- Composante 3 : checklists (nouveau modèle — % items cochés par soumission)
  WITH per_sub AS (
    SELECT sh.shift_date,
      COUNT(csi.id) AS total,
      COUNT(*) FILTER (WHERE csi.is_checked) AS done
    FROM public.checklist_submissions sub
    JOIN public.shifts sh ON sh.id = sub.shift_id
    JOIN public.checklist_submission_items csi ON csi.submission_id = sub.id
    WHERE sub.user_id = target_user_id AND sh.shift_date <= CURRENT_DATE
    GROUP BY sub.id, sh.shift_date
    HAVING COUNT(csi.id) > 0
    ORDER BY sh.shift_date DESC LIMIT 60
  )
  SELECT
    SUM((done::numeric / NULLIF(total,0)) * 10.0 * EXP(-lambda * GREATEST(0, (CURRENT_DATE - shift_date)))),
    SUM(EXP(-lambda * GREATEST(0, (CURRENT_DATE - shift_date))))
  INTO checklist_s, checklist_w
  FROM per_sub;

  IF checklist_w IS NULL OR checklist_w = 0 THEN checklist_s := default_score;
  ELSE checklist_s := checklist_s / checklist_w; END IF;

  final_s := ROUND(((manager_s + punct_s + checklist_s) / 3.0)::numeric, 2);
  RETURN final_s;
END;
$function$;

-- Trigger recalcul score sur nouvelles tables
CREATE OR REPLACE FUNCTION public.trg_recalculate_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid;
BEGIN
  IF TG_TABLE_NAME = 'feedbacks' THEN
    SELECT user_id INTO v_user FROM public.shifts WHERE id = COALESCE(NEW.shift_id, OLD.shift_id);
  ELSIF TG_TABLE_NAME = 'shifts' THEN
    v_user := COALESCE(NEW.user_id, OLD.user_id);
  ELSIF TG_TABLE_NAME = 'checklist_submission_items' THEN
    SELECT user_id INTO v_user FROM public.checklist_submissions WHERE id = COALESCE(NEW.submission_id, OLD.submission_id);
  ELSIF TG_TABLE_NAME = 'checklist_submissions' THEN
    v_user := COALESCE(NEW.user_id, OLD.user_id);
  END IF;

  IF v_user IS NOT NULL THEN
    UPDATE public.profiles
      SET score = public.calculate_profile_score(v_user), updated_at = now()
      WHERE id = v_user;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;

CREATE TRIGGER trg_recalc_score_on_checklist_items
AFTER INSERT OR UPDATE OR DELETE ON public.checklist_submission_items
FOR EACH ROW EXECUTE FUNCTION public.trg_recalculate_score();

CREATE TRIGGER trg_recalc_score_on_checklist_subs
AFTER INSERT OR UPDATE OR DELETE ON public.checklist_submissions
FOR EACH ROW EXECUTE FUNCTION public.trg_recalculate_score();

-- =========================================================
-- 6. FORCE_DELETE_STUDIO : nettoyage nouvelles tables
-- =========================================================
CREATE OR REPLACE FUNCTION public.force_delete_studio(_studio_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_admin boolean;
  v_shifts int := 0;
  v_templates int := 0;
  v_user_studios int := 0;
  v_checklists int := 0;
  v_signalements int := 0;
  v_exceptions int := 0;
  v_business_roles int := 0;
  v_invitations_scalar int := 0;
  v_invitations_arrays int := 0;
  v_profiles_nulled int := 0;
BEGIN
  SELECT public.has_role(auth.uid(), 'admin'::app_role) INTO v_admin;
  IF NOT v_admin THEN RAISE EXCEPTION 'Réservé aux administrateurs'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.studios WHERE id = _studio_id) THEN
    RAISE EXCEPTION 'Studio introuvable';
  END IF;

  -- Nouveau : supprime soumissions checklist liées aux shifts du studio
  DELETE FROM public.checklist_submissions
    WHERE shift_id IN (SELECT id FROM public.shifts WHERE studio_id = _studio_id);

  DELETE FROM public.shift_handoffs
    WHERE shift_id IN (SELECT id FROM public.shifts WHERE studio_id = _studio_id);
  DELETE FROM public.shift_proposals
    WHERE shift_id IN (SELECT id FROM public.shifts WHERE studio_id = _studio_id);
  DELETE FROM public.shift_reports
    WHERE shift_id IN (SELECT id FROM public.shifts WHERE studio_id = _studio_id);
  DELETE FROM public.feedbacks
    WHERE shift_id IN (SELECT id FROM public.shifts WHERE studio_id = _studio_id);
  DELETE FROM public.modification_requests
    WHERE shift_id IN (SELECT id FROM public.shifts WHERE studio_id = _studio_id);

  DELETE FROM public.shifts WHERE studio_id = _studio_id;
  GET DIAGNOSTICS v_shifts = ROW_COUNT;

  DELETE FROM public.staffing_templates WHERE studio_id = _studio_id;
  GET DIAGNOSTICS v_templates = ROW_COUNT;

  DELETE FROM public.user_studios WHERE studio_id = _studio_id;
  GET DIAGNOSTICS v_user_studios = ROW_COUNT;

  DELETE FROM public.checklist_templates WHERE studio_id = _studio_id;
  GET DIAGNOSTICS v_checklists = ROW_COUNT;

  DELETE FROM public.signalements WHERE studio_id = _studio_id;
  GET DIAGNOSTICS v_signalements = ROW_COUNT;

  DELETE FROM public.studio_exceptions WHERE studio_id = _studio_id;
  GET DIAGNOSTICS v_exceptions = ROW_COUNT;

  DELETE FROM public.studio_business_roles WHERE studio_id = _studio_id;
  GET DIAGNOSTICS v_business_roles = ROW_COUNT;

  UPDATE public.profiles SET studio_id = NULL WHERE studio_id = _studio_id;
  GET DIAGNOSTICS v_profiles_nulled = ROW_COUNT;

  DELETE FROM public.invitations WHERE studio_id = _studio_id;
  GET DIAGNOSTICS v_invitations_scalar = ROW_COUNT;

  UPDATE public.invitations
    SET studio_ids = (SELECT ARRAY(SELECT x FROM unnest(studio_ids) x WHERE x <> _studio_id))
    WHERE _studio_id = ANY(studio_ids);
  GET DIAGNOSTICS v_invitations_arrays = ROW_COUNT;

  DELETE FROM public.studios WHERE id = _studio_id;

  RETURN jsonb_build_object(
    'shifts', v_shifts,
    'staffing_templates', v_templates,
    'user_studios', v_user_studios,
    'checklist_templates', v_checklists,
    'signalements', v_signalements,
    'studio_exceptions', v_exceptions,
    'studio_business_roles', v_business_roles,
    'profiles_nulled', v_profiles_nulled,
    'invitations_scalar', v_invitations_scalar,
    'invitations_arrays', v_invitations_arrays
  );
END;
$function$;