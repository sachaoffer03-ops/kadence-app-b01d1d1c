CREATE OR REPLACE FUNCTION public.delete_my_account(_email_confirmation text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_anon uuid;
  v_purge timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  SELECT email INTO v_email FROM public.profiles WHERE id = v_uid;
  IF v_email IS NULL THEN
    SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
  END IF;

  IF v_email IS NULL
     OR lower(trim(coalesce(_email_confirmation, ''))) <> lower(trim(v_email)) THEN
    RAISE EXCEPTION 'Adresse email de confirmation incorrecte';
  END IF;

  v_anon := gen_random_uuid();
  v_purge := now() + interval '30 days';

  PERFORM set_config('kadence.account_deletion', '1', true);

  -- Documents personnels : suppression des références (fichiers purgés côté serveur)
  DELETE FROM public.employee_documents WHERE user_id = v_uid;

  -- Coupe tout accès applicatif restant
  DELETE FROM public.user_roles WHERE user_id = v_uid;
  DELETE FROM public.manager_permissions WHERE user_id = v_uid;
  DELETE FROM public.availabilities WHERE user_id = v_uid;
  DELETE FROM public.shift_proposals WHERE user_id = v_uid;
  DELETE FROM public.notifications WHERE user_id = v_uid;
  DELETE FROM public.unavailability_periods WHERE user_id = v_uid;
  DELETE FROM public.ai_chat_messages WHERE user_id = v_uid;
  DELETE FROM public.email_unsubscribe_tokens WHERE user_id = v_uid;
  UPDATE public.invitations SET status = 'revoked' WHERE lower(email) = lower(v_email) AND status = 'pending';

  -- Anonymisation du profil (historique comptable conservé 7 ans, sans identité)
  UPDATE public.profiles SET
    first_name = 'Employé',
    last_name = 'supprimé',
    email = NULL,
    phone = NULL,
    address = NULL,
    city = NULL,
    nationality = NULL,
    birth_date = NULL,
    niss = NULL,
    iban = NULL,
    avatar_url = NULL,
    emergency_contact_name = NULL,
    emergency_contact_phone = NULL,
    emergency_contact_relation = NULL,
    calendar_token = gen_random_uuid(),
    status = 'deleted'::profile_status,
    deleted_at = now(),
    anon_id = v_anon,
    updated_at = now()
  WHERE id = v_uid;

  INSERT INTO public.account_deletion_requests (user_id, anon_id, email_hash, purge_auth_at)
  VALUES (v_uid, v_anon, encode(digest(lower(v_email), 'sha256'), 'hex'), v_purge);

  RETURN jsonb_build_object('ok', true, 'anon_id', v_anon, 'purge_auth_at', v_purge);
EXCEPTION WHEN undefined_function THEN
  -- pgcrypto absent : on enregistre sans empreinte email
  INSERT INTO public.account_deletion_requests (user_id, anon_id, purge_auth_at)
  VALUES (v_uid, v_anon, v_purge);
  RETURN jsonb_build_object('ok', true, 'anon_id', v_anon, 'purge_auth_at', v_purge);
END;
$function$;

REVOKE ALL ON FUNCTION public.delete_my_account(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_pending_auth_purges()
RETURNS TABLE(user_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT r.user_id FROM public.account_deletion_requests r
  WHERE r.purged_at IS NULL AND r.purge_auth_at <= now();
$function$;

REVOKE ALL ON FUNCTION public.list_pending_auth_purges() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_pending_auth_purges() TO service_role;

CREATE OR REPLACE FUNCTION public.mark_auth_purged(_user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  UPDATE public.account_deletion_requests
     SET purged_at = now()
   WHERE user_id = _user_id AND purged_at IS NULL;
$function$;

REVOKE ALL ON FUNCTION public.mark_auth_purged(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_auth_purged(uuid) TO service_role;
