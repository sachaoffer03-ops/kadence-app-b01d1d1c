
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal';

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'general';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'notifications_priority_check'
  ) THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_priority_check
      CHECK (priority IN ('urgent', 'normal', 'info'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'notifications_category_check'
  ) THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_category_check
      CHECK (category IN ('planning', 'shift', 'training', 'request', 'document', 'pointage', 'general'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS notifications_user_priority_idx
  ON public.notifications(user_id, priority, created_at DESC)
  WHERE read_at IS NULL;

-- Backfill priorities and categories for existing notifications
UPDATE public.notifications SET priority = 'urgent', category = 'pointage'
  WHERE type IN ('shift_late_arrival', 'shift_no_show_suspected');

UPDATE public.notifications SET priority = 'normal', category = 'request'
  WHERE type = 'modification_request_new';

UPDATE public.notifications SET priority = 'normal', category = 'shift'
  WHERE type IN ('shift_proposal', 'shift_added');

UPDATE public.notifications SET priority = 'normal', category = 'training'
  WHERE type IN ('training_assigned');

UPDATE public.notifications SET priority = 'info', category = 'planning'
  WHERE type IN ('planning_published', 'shift_published');

UPDATE public.notifications SET priority = 'info', category = 'shift'
  WHERE type IN ('shift_removed', 'shift_updated', 'proposal_accepted', 'replacement_accepted');

UPDATE public.notifications SET priority = 'info', category = 'training'
  WHERE type IN ('training_completed', 'training_module_passed');

UPDATE public.notifications SET priority = 'info', category = 'request'
  WHERE type LIKE 'modification_request_%' AND type <> 'modification_request_new';

UPDATE public.notifications SET priority = 'info', category = 'document'
  WHERE type = 'document_uploaded';

UPDATE public.notifications SET priority = 'normal', category = 'pointage'
  WHERE type = 'shift_clock_out_missing';

UPDATE public.notifications SET category = 'general'
  WHERE type IN ('new_message', 'feedback_received') AND category = 'general';

-- Update PG triggers to set priority/category
CREATE OR REPLACE FUNCTION public.trg_notify_on_shift_published()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.user_id IS NULL OR NEW.published_at IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.published_at IS NOT NULL THEN RETURN NEW; END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link, priority, category)
  VALUES (
    NEW.user_id,
    'shift_published',
    'Nouveau shift planifié',
    to_char(NEW.shift_date, 'DD/MM') || ' · ' || to_char(NEW.start_time, 'HH24:MI') || '–' || to_char(NEW.end_time, 'HH24:MI') || ' · ' || NEW.business_role,
    '/staff-app?tab=planning',
    'info', 'planning'
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_notify_on_modreq_resolved()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_title text;
  v_status text;
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;
  v_status := NEW.status::text;
  IF v_status NOT IN ('accepted','refused','cancelled') THEN RETURN NEW; END IF;

  v_title := CASE v_status
    WHEN 'accepted' THEN 'Demande acceptée'
    WHEN 'refused'  THEN 'Demande refusée'
    ELSE 'Demande annulée'
  END;

  INSERT INTO public.notifications (user_id, type, title, body, link, priority, category)
  VALUES (
    NEW.user_id,
    'modification_request_' || v_status,
    v_title,
    COALESCE(NULLIF(TRIM(NEW.admin_response), ''),
             'Votre demande a été ' ||
             CASE v_status WHEN 'accepted' THEN 'acceptée' WHEN 'refused' THEN 'refusée' ELSE 'annulée' END || '.'),
    '/staff-app?tab=demandes',
    'info', 'request'
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_notify_admins_on_modreq()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_studio_id uuid;
  v_first_name text;
  v_type_label text;
  v_urg_emoji text;
  v_title text;
  v_body text;
  v_link text;
  v_recipient uuid;
  v_priority text;
BEGIN
  IF NEW.shift_id IS NOT NULL THEN
    SELECT studio_id INTO v_studio_id FROM public.shifts WHERE id = NEW.shift_id;
  END IF;

  SELECT COALESCE(NULLIF(TRIM(first_name), ''), 'Quelqu''un')
    INTO v_first_name FROM public.profiles WHERE id = NEW.user_id;

  v_type_label := CASE NEW.type::text
    WHEN 'cancel' THEN 'Annulation'
    WHEN 'time_change' THEN 'Changement d''horaire'
    WHEN 'unavailable' THEN 'Indispo future'
    WHEN 'swap' THEN 'Échange'
    ELSE NEW.type::text
  END;

  v_urg_emoji := CASE NEW.urgency::text
    WHEN 'critique' THEN '🔴'
    WHEN 'urgent' THEN '🟠'
    ELSE '🟢'
  END;

  v_priority := CASE NEW.urgency::text
    WHEN 'critique' THEN 'urgent'
    WHEN 'urgent' THEN 'urgent'
    ELSE 'normal'
  END;

  v_title := v_urg_emoji || ' ' || COALESCE(v_first_name, 'Employé') || ' demande : ' || v_type_label;
  v_body := COALESCE(LEFT(NEW.reason, 120), '');
  v_link := '/demandes?req=' || NEW.id::text;

  FOR v_recipient IN
    SELECT DISTINCT ur.user_id
    FROM public.user_roles ur
    LEFT JOIN public.user_studios us ON us.user_id = ur.user_id
    WHERE ur.role IN ('admin','manager')
      AND (v_studio_id IS NULL OR us.studio_id = v_studio_id OR ur.role = 'admin')
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, link, priority, category)
    VALUES (v_recipient, 'modification_request_new', v_title, v_body, v_link, v_priority, 'request');
  END LOOP;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_notify_on_feedback()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid;
  v_author_name text;
BEGIN
  IF NEW.shift_id IS NULL THEN RETURN NEW; END IF;
  SELECT user_id INTO v_user FROM public.shifts WHERE id = NEW.shift_id;
  IF v_user IS NULL OR v_user = NEW.author_id THEN RETURN NEW; END IF;

  SELECT COALESCE(NULLIF(TRIM(first_name || ' ' || last_name), ''), 'Votre manager')
    INTO v_author_name
    FROM public.profiles WHERE id = NEW.author_id;

  INSERT INTO public.notifications (user_id, type, title, body, link, priority, category)
  VALUES (
    v_user,
    'feedback_received',
    'Feedback reçu (' || NEW.rating || '★)',
    COALESCE(NULLIF(TRIM(NEW.message), ''), v_author_name || ' a laissé un retour sur votre shift.'),
    '/staff-app?tab=profil',
    'normal', 'general'
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_notify_on_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sender_name text;
  v_preview text;
BEGIN
  IF NEW.sender_id = NEW.recipient_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(TRIM(first_name || ' ' || last_name), ''), email, 'Quelqu''un')
    INTO v_sender_name
    FROM public.profiles WHERE id = NEW.sender_id;

  v_preview := COALESCE(NULLIF(TRIM(NEW.content), ''),
                        CASE WHEN NEW.attachment_url IS NOT NULL THEN '📎 Pièce jointe' ELSE '' END);
  IF length(v_preview) > 120 THEN v_preview := substring(v_preview from 1 for 117) || '…'; END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link, priority, category)
  VALUES (
    NEW.recipient_id,
    'new_message',
    'Nouveau message de ' || COALESCE(v_sender_name, 'votre équipe'),
    v_preview,
    '/staff-app?tab=chat',
    'normal', 'general'
  );
  RETURN NEW;
END;
$function$;
