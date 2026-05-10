
-- Modifie handle_new_user pour donner le rôle admin au tout premier utilisateur
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation_token TEXT;
  v_invitation public.invitations%ROWTYPE;
  v_role business_role;
  v_admin_count INTEGER;
BEGIN
  v_invitation_token := NEW.raw_user_meta_data->>'invitation_token';

  IF v_invitation_token IS NOT NULL THEN
    SELECT * INTO v_invitation FROM public.invitations
    WHERE token = v_invitation_token AND status = 'pending' AND expires_at > now();

    IF FOUND THEN
      INSERT INTO public.profiles (id, email, first_name, last_name, phone, studio_id, contract, hire_date, status)
      VALUES (NEW.id, NEW.email, v_invitation.first_name, v_invitation.last_name, v_invitation.phone, v_invitation.studio_id, v_invitation.contract, v_invitation.hire_date, 'active');

      INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_invitation.app_role);

      FOREACH v_role IN ARRAY v_invitation.business_roles LOOP
        INSERT INTO public.user_business_roles (user_id, role) VALUES (NEW.id, v_role);
      END LOOP;

      UPDATE public.invitations SET status = 'accepted', accepted_at = now() WHERE id = v_invitation.id;
      RETURN NEW;
    END IF;
  END IF;

  -- Premier utilisateur = admin (bootstrap)
  SELECT COUNT(*) INTO v_admin_count FROM public.user_roles WHERE role = 'admin';

  INSERT INTO public.profiles (id, email, first_name, last_name, status)
  VALUES (NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    'active');

  IF v_admin_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'employee');
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
