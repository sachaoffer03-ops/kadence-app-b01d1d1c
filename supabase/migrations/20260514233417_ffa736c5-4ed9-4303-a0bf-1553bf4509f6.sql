CREATE OR REPLACE FUNCTION public.migrate_studios_v2(caller_id uuid, pairs jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admin boolean;
  v_pair jsonb;
  v_src uuid;
  v_dst uuid;
  v_shifts_deleted int := 0;
  v_old_templates_deleted int := 0;
  v_templates_moved int := 0;
  v_user_studios_dedup int := 0;
  v_user_studios_moved int := 0;
  v_profiles_moved int := 0;
  v_studios_deleted int := 0;
  v_step text := 'init';
  v_src_ids uuid[] := ARRAY[]::uuid[];
  v_dst_ids uuid[] := ARRAY[]::uuid[];
  v_tmp int;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'caller_id manquant';
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = caller_id AND role = 'admin') INTO v_admin;
  IF NOT v_admin THEN
    RAISE EXCEPTION 'Réservé aux administrateurs (caller_id=%)', caller_id;
  END IF;

  IF pairs IS NULL OR jsonb_array_length(pairs) = 0 THEN
    RAISE EXCEPTION 'Aucune paire fournie';
  END IF;

  FOR v_pair IN SELECT * FROM jsonb_array_elements(pairs) LOOP
    v_src := (v_pair->>'src_id')::uuid;
    v_dst := (v_pair->>'dst_id')::uuid;
    IF v_src IS NULL OR v_dst IS NULL OR v_src = v_dst THEN
      RAISE EXCEPTION 'Paire invalide: %', v_pair;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.studios WHERE id = v_src) THEN
      RAISE EXCEPTION 'Studio source introuvable: %', v_src;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.studios WHERE id = v_dst) THEN
      RAISE EXCEPTION 'Studio destination introuvable: %', v_dst;
    END IF;
    v_src_ids := array_append(v_src_ids, v_src);
    v_dst_ids := array_append(v_dst_ids, v_dst);
  END LOOP;

  v_step := 'A_delete_shifts';
  WITH d AS (DELETE FROM public.shifts WHERE id IS NOT NULL RETURNING 1)
  SELECT count(*) INTO v_shifts_deleted FROM d;

  v_step := 'B_delete_old_templates';
  WITH d AS (
    DELETE FROM public.staffing_templates WHERE studio_id = ANY(v_dst_ids) RETURNING 1
  ) SELECT count(*) INTO v_old_templates_deleted FROM d;

  FOR i IN 1..array_length(v_src_ids, 1) LOOP
    v_src := v_src_ids[i];
    v_dst := v_dst_ids[i];

    v_step := format('C_move_templates[%s->%s]', v_src, v_dst);
    WITH u AS (UPDATE public.staffing_templates SET studio_id = v_dst WHERE studio_id = v_src RETURNING 1)
    SELECT count(*) INTO v_tmp FROM u;
    v_templates_moved := v_templates_moved + v_tmp;

    v_step := format('D1_dedup_user_studios[%s->%s]', v_src, v_dst);
    WITH d AS (
      DELETE FROM public.user_studios us
      WHERE us.studio_id = v_src
        AND EXISTS (SELECT 1 FROM public.user_studios us2 WHERE us2.user_id = us.user_id AND us2.studio_id = v_dst)
      RETURNING 1
    ) SELECT count(*) INTO v_tmp FROM d;
    v_user_studios_dedup := v_user_studios_dedup + v_tmp;

    v_step := format('D2_move_user_studios[%s->%s]', v_src, v_dst);
    WITH u AS (UPDATE public.user_studios SET studio_id = v_dst WHERE studio_id = v_src RETURNING 1)
    SELECT count(*) INTO v_tmp FROM u;
    v_user_studios_moved := v_user_studios_moved + v_tmp;

    v_step := format('E_move_profiles[%s->%s]', v_src, v_dst);
    WITH u AS (UPDATE public.profiles SET studio_id = v_dst WHERE studio_id = v_src RETURNING 1)
    SELECT count(*) INTO v_tmp FROM u;
    v_profiles_moved := v_profiles_moved + v_tmp;

    UPDATE public.invitations SET studio_id = v_dst WHERE studio_id = v_src;
    UPDATE public.invitations
      SET studio_ids = (SELECT ARRAY(SELECT DISTINCT unnest(array_replace(studio_ids, v_src, v_dst))))
      WHERE v_src = ANY(studio_ids);

    UPDATE public.checklist_templates SET studio_id = v_dst WHERE studio_id = v_src;
    UPDATE public.signalements SET studio_id = v_dst WHERE studio_id = v_src;
  END LOOP;

  v_step := 'F_delete_duplicates';
  WITH d AS (DELETE FROM public.studios WHERE id = ANY(v_src_ids) RETURNING 1)
  SELECT count(*) INTO v_studios_deleted FROM d;

  RETURN jsonb_build_object(
    'shifts_deleted', v_shifts_deleted,
    'old_templates_deleted', v_old_templates_deleted,
    'templates_moved', v_templates_moved,
    'user_studios_dedup', v_user_studios_dedup,
    'user_studios_moved', v_user_studios_moved,
    'profiles_moved', v_profiles_moved,
    'studios_deleted', v_studios_deleted
  );
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Migration échouée à l''étape % : %', v_step, SQLERRM;
END;
$$;