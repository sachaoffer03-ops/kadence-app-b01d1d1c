-- Atomic studio merge function. Moves all references from src_id to dst_id
-- and deletes the src studio. Runs in a single transaction (function = txn).
CREATE OR REPLACE FUNCTION public.merge_studio(src_id uuid, dst_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin boolean;
  v_staffing int := 0;
  v_us_moved int := 0;
  v_us_dedup int := 0;
  v_shifts int := 0;
  v_profiles int := 0;
  v_checklists int := 0;
  v_signalements int := 0;
  v_invitations int := 0;
  v_inv_arrays int := 0;
BEGIN
  SELECT public.has_role(auth.uid(), 'admin'::app_role) INTO v_admin;
  IF NOT v_admin THEN
    RAISE EXCEPTION 'Réservé aux administrateurs';
  END IF;
  IF src_id = dst_id THEN
    RAISE EXCEPTION 'src_id et dst_id identiques';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.studios WHERE id = src_id) THEN
    RAISE EXCEPTION 'Studio source introuvable';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.studios WHERE id = dst_id) THEN
    RAISE EXCEPTION 'Studio destination introuvable';
  END IF;

  -- staffing_templates
  WITH u AS (
    UPDATE public.staffing_templates SET studio_id = dst_id WHERE studio_id = src_id RETURNING 1
  ) SELECT count(*) INTO v_staffing FROM u;

  -- user_studios : éviter doublons de jointure
  WITH dedup AS (
    DELETE FROM public.user_studios us
    WHERE us.studio_id = src_id
      AND EXISTS (SELECT 1 FROM public.user_studios us2
                  WHERE us2.user_id = us.user_id AND us2.studio_id = dst_id)
    RETURNING 1
  ) SELECT count(*) INTO v_us_dedup FROM dedup;
  WITH u AS (
    UPDATE public.user_studios SET studio_id = dst_id WHERE studio_id = src_id RETURNING 1
  ) SELECT count(*) INTO v_us_moved FROM u;

  -- shifts
  WITH u AS (
    UPDATE public.shifts SET studio_id = dst_id WHERE studio_id = src_id RETURNING 1
  ) SELECT count(*) INTO v_shifts FROM u;

  -- profiles
  WITH u AS (
    UPDATE public.profiles SET studio_id = dst_id WHERE studio_id = src_id RETURNING 1
  ) SELECT count(*) INTO v_profiles FROM u;

  -- checklist_templates
  WITH u AS (
    UPDATE public.checklist_templates SET studio_id = dst_id WHERE studio_id = src_id RETURNING 1
  ) SELECT count(*) INTO v_checklists FROM u;

  -- signalements
  WITH u AS (
    UPDATE public.signalements SET studio_id = dst_id WHERE studio_id = src_id RETURNING 1
  ) SELECT count(*) INTO v_signalements FROM u;

  -- invitations.studio_id (scalar)
  WITH u AS (
    UPDATE public.invitations SET studio_id = dst_id WHERE studio_id = src_id RETURNING 1
  ) SELECT count(*) INTO v_invitations FROM u;

  -- invitations.studio_ids (array) : remplacer src_id par dst_id, dédupliquer
  WITH u AS (
    UPDATE public.invitations
    SET studio_ids = (
      SELECT ARRAY(SELECT DISTINCT unnest(array_replace(studio_ids, src_id, dst_id)))
    )
    WHERE src_id = ANY(studio_ids)
    RETURNING 1
  ) SELECT count(*) INTO v_inv_arrays FROM u;

  -- Suppression du studio source
  DELETE FROM public.studios WHERE id = src_id;

  RETURN jsonb_build_object(
    'staffing_templates', v_staffing,
    'user_studios_moved', v_us_moved,
    'user_studios_deduped', v_us_dedup,
    'shifts', v_shifts,
    'profiles', v_profiles,
    'checklist_templates', v_checklists,
    'signalements', v_signalements,
    'invitations_scalar', v_invitations,
    'invitations_arrays', v_inv_arrays
  );
END;
$$;

REVOKE ALL ON FUNCTION public.merge_studio(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.merge_studio(uuid, uuid) TO authenticated;