
DO $$
DECLARE
  v_admin_ids uuid[];
BEGIN
  -- 1. Identifier les admins à conserver
  SELECT array_agg(user_id) INTO v_admin_ids
  FROM public.user_roles WHERE role = 'admin';

  IF v_admin_ids IS NULL THEN
    v_admin_ids := ARRAY[]::uuid[];
  END IF;

  -- 2. Données opérationnelles liées aux shifts
  DELETE FROM public.shift_checklist_items;
  DELETE FROM public.shift_handoffs;
  DELETE FROM public.shift_proposals;
  DELETE FROM public.shift_reports;
  DELETE FROM public.feedbacks;
  DELETE FROM public.modification_requests;
  DELETE FROM public.shifts;

  -- 3. Planning
  DELETE FROM public.planning_runs;
  DELETE FROM public.planning_publications;

  -- 4. Studios & config
  DELETE FROM public.staffing_templates;
  DELETE FROM public.studio_exceptions;
  DELETE FROM public.studio_business_roles;
  DELETE FROM public.checklist_templates;
  DELETE FROM public.signalements;

  -- 5. Formations
  DELETE FROM public.formation_completions;
  DELETE FROM public.formations;
  DELETE FROM public.training_paths;

  -- 6. Communications & dispos
  DELETE FROM public.availabilities;
  DELETE FROM public.messages;
  DELETE FROM public.notifications;
  DELETE FROM public.invitations;

  -- 7. Rôles métier (le client recrée les siens)
  DELETE FROM public.business_roles;

  -- 8. Liaisons employés non-admins
  DELETE FROM public.user_business_roles WHERE user_id <> ALL(v_admin_ids);
  DELETE FROM public.user_contracts     WHERE user_id <> ALL(v_admin_ids);
  DELETE FROM public.user_studios       WHERE user_id <> ALL(v_admin_ids);

  -- 9. Détacher les admins de tout studio
  UPDATE public.profiles SET studio_id = NULL WHERE id = ANY(v_admin_ids);

  -- 10. Studios
  DELETE FROM public.studios;

  -- 11. Profils non-admins
  DELETE FROM public.profiles WHERE id <> ALL(v_admin_ids);

  -- 12. Comptes auth non-admins (cascade rôles)
  DELETE FROM public.user_roles WHERE user_id <> ALL(v_admin_ids);
  DELETE FROM auth.users        WHERE id      <> ALL(v_admin_ids);

  RAISE NOTICE 'Reset terminé. Admins conservés : %', v_admin_ids;
END $$;
