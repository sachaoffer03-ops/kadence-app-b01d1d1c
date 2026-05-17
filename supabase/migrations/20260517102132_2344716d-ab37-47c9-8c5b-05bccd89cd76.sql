
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

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (
    NEW.user_id,
    'modification_request_' || v_status,
    v_title,
    COALESCE(NULLIF(TRIM(NEW.admin_response), ''),
             'Votre demande a été ' ||
             CASE v_status WHEN 'accepted' THEN 'acceptée' WHEN 'refused' THEN 'refusée' ELSE 'annulée' END || '.'),
    '/staff-app?tab=demandes'
  );
  RETURN NEW;
END;
$function$;
