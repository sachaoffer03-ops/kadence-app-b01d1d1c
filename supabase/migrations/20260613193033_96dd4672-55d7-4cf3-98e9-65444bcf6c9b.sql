
CREATE OR REPLACE FUNCTION public.process_avail_reminders()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_lock_day int;
  v_now timestamptz := now();
  v_deadline timestamptz;
  v_days_left numeric;
  v_threshold text;
  v_user record;
  v_count_notifs int := 0;
BEGIN
  SELECT COALESCE(availability_lock_day, 25) INTO v_lock_day
    FROM public.ai_planning_settings
    ORDER BY updated_at DESC NULLS LAST
    LIMIT 1;
  IF v_lock_day IS NULL THEN v_lock_day := 25; END IF;

  v_deadline := date_trunc('month', v_now)
    + ((v_lock_day - 1) || ' days')::interval
    + interval '23 hours 59 minutes 59 seconds';

  IF v_now > v_deadline THEN
    v_deadline := date_trunc('month', v_now + interval '1 month')
      + ((v_lock_day - 1) || ' days')::interval
      + interval '23 hours 59 minutes 59 seconds';
  END IF;

  v_days_left := EXTRACT(EPOCH FROM (v_deadline - v_now)) / 86400.0;

  IF v_days_left <= 0 THEN
    RETURN json_build_object('skipped', 'deadline_passed');
  ELSIF v_days_left < 0.0417 THEN
    v_threshold := '1h';
  ELSIF v_days_left < 0.208 THEN
    v_threshold := '5h';
  ELSIF v_days_left < 1 THEN
    v_threshold := '24h';
  ELSIF v_days_left < 2 THEN
    v_threshold := '2d';
  ELSIF v_days_left < 3 THEN
    v_threshold := '3d';
  ELSE
    RETURN json_build_object('skipped', 'too_far', 'days_left', v_days_left);
  END IF;

  FOR v_user IN
    SELECT p.id, p.first_name
    FROM public.profiles p
    WHERE p.status = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = p.id AND ur.role IN ('admin', 'manager')
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.availabilities a
        WHERE a.user_id = p.id
          AND a.avail_date >= date_trunc('month', v_now + interval '1 month')::date
          AND a.avail_date < (date_trunc('month', v_now + interval '1 month') + interval '1 month')::date
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = p.id
          AND n.type = 'dispo_reminder_' || v_threshold
          AND n.created_at > v_deadline - interval '7 days'
      )
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, link, priority, category)
    VALUES (
      v_user.id,
      'dispo_reminder_' || v_threshold,
      CASE v_threshold
        WHEN '3d' THEN 'Plus que 3 jours pour tes dispos'
        WHEN '2d' THEN 'Plus que 2 jours pour tes dispos'
        WHEN '24h' THEN 'Plus que 24h pour tes dispos'
        WHEN '5h' THEN '5h restantes pour tes dispos'
        WHEN '1h' THEN 'Dernière heure pour tes dispos'
      END,
      'N''oublie pas de remplir tes dispos pour le mois prochain.',
      '/staff-app?tab=accueil',
      CASE WHEN v_threshold IN ('5h','1h','24h') THEN 'urgent' ELSE 'normal' END,
      'general'
    );
    v_count_notifs := v_count_notifs + 1;
  END LOOP;

  RETURN json_build_object(
    'threshold', v_threshold,
    'deadline', v_deadline,
    'notifs_sent', v_count_notifs
  );
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.process_avail_reminders() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_avail_reminders() TO service_role;
