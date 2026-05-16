
-- ============================================================
-- Données de test pour le flow employé E2E (Tom Cruise)
-- Tout est idempotent + facilement supprimable via le bouton
-- "Nettoyer données flow test" sur /admin/qa-test-suite.
-- ============================================================
DO $$
DECLARE
  tom_id uuid;
  v_studio uuid;
  v_role text;
BEGIN
  SELECT id INTO tom_id FROM public.profiles
    WHERE email = 'agorapro.business@gmail.com' LIMIT 1;
  IF tom_id IS NULL THEN
    RAISE NOTICE 'Tom Cruise introuvable, abandon';
    RETURN;
  END IF;

  -- studio
  SELECT us.studio_id INTO v_studio FROM public.user_studios us WHERE us.user_id = tom_id LIMIT 1;
  IF v_studio IS NULL THEN
    SELECT studio_id INTO v_studio FROM public.profiles WHERE id = tom_id;
  END IF;
  IF v_studio IS NULL THEN
    SELECT id INTO v_studio FROM public.studios WHERE deleted_at IS NULL LIMIT 1;
  END IF;

  -- business_role (text)
  SELECT role INTO v_role FROM public.user_business_roles WHERE user_id = tom_id LIMIT 1;
  IF v_role IS NULL THEN
    SELECT name INTO v_role FROM public.business_roles WHERE is_active = true ORDER BY position LIMIT 1;
  END IF;
  IF v_role IS NULL THEN v_role := 'Barista'; END IF;

  -- 1) Shift du jour 10h-16h (publié)
  IF NOT EXISTS (
    SELECT 1 FROM public.shifts
    WHERE user_id = tom_id AND shift_date = CURRENT_DATE AND start_time = '10:00:00'
  ) THEN
    INSERT INTO public.shifts (user_id, studio_id, business_role, shift_date, start_time, end_time, status, is_manual, published_at)
    VALUES (tom_id, v_studio, v_role, CURRENT_DATE, '10:00:00', '16:00:00', 'scheduled', true, now());
  END IF;

  -- 2) Notifs Tom
  IF NOT EXISTS (
    SELECT 1 FROM public.notifications
    WHERE user_id = tom_id AND type = 'planning_published'
      AND created_at > now() - interval '1 hour'
  ) THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (tom_id, 'planning_published',
            'Planning publié',
            'Ton planning du jour est disponible. Tu as un shift aujourd''hui de 10h00 à 16h00.',
            '/staff-app');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.notifications
    WHERE user_id = tom_id AND type = 'shift_reminder'
      AND created_at > now() - interval '1 hour'
  ) THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (tom_id, 'shift_reminder',
            'Ton shift commence bientôt',
            'Rappel : tu commences à 10h00 aujourd''hui. N''oublie pas de pointer ton arrivée.',
            '/staff-app');
  END IF;
END $$;

-- 3) Template checklist test
DO $$
DECLARE
  v_tpl uuid;
  v_role_id uuid;
BEGIN
  SELECT br.id INTO v_role_id
  FROM public.business_roles br
  JOIN public.user_business_roles ubr ON ubr.role = br.name
  JOIN public.profiles p ON p.id = ubr.user_id
  WHERE p.email = 'agorapro.business@gmail.com'
  LIMIT 1;
  IF v_role_id IS NULL THEN
    SELECT id INTO v_role_id FROM public.business_roles WHERE is_active = true ORDER BY position LIMIT 1;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.checklist_templates WHERE name = 'Fin de shift test — Flow complet') THEN
    INSERT INTO public.checklist_templates (name, description, business_role_id, studio_id, is_blocking, is_active)
    VALUES (
      'Fin de shift test — Flow complet',
      'Template de test pour valider le flow complet. Supprimable via le bouton Nettoyer dans /admin/qa-test-suite.',
      v_role_id, NULL, true, true
    ) RETURNING id INTO v_tpl;

    INSERT INTO public.checklist_template_items (template_id, label, description, order_index, is_required) VALUES
      (v_tpl, 'J''ai nettoyé le comptoir et la machine espresso', 'Essuyer avec chiffon humide puis sec. Aucune trace visible.', 1, true),
      (v_tpl, 'J''ai vidé et rincé la poubelle', 'Nouveau sac poubelle mis en place. Poubelle reposée au bon endroit.', 2, true),
      (v_tpl, 'J''ai fermé et rangé le frigo', 'Tout est couvert, bien rangé, température vérifiée.', 3, true),
      (v_tpl, 'J''ai éteint toutes les machines', 'Machine espresso, grinder, chauffe-tasses, lumières du comptoir.', 4, true);

    INSERT INTO public.checklist_template_photos (template_id, label, description, reference_photo_url, order_index, is_required) VALUES
      (v_tpl, 'Photo du comptoir propre',
        'Comptoir vide et essuyé, sans traces ni objets. Photo de face, bien éclairée.',
        'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80', 1, true),
      (v_tpl, 'Photo du frigo fermé',
        'Porte du frigo bien fermée. Vue de face. Aucune condensation visible.',
        'https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?w=800&q=80', 2, true);
  END IF;
END $$;
