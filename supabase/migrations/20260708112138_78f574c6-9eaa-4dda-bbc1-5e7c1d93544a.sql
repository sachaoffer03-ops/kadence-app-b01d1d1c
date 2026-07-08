CREATE OR REPLACE FUNCTION public.merge_profile_data(old_id uuid, new_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF old_id = new_id THEN RETURN; END IF;

  UPDATE public.shifts                SET user_id   = new_id WHERE user_id   = old_id;
  UPDATE public.availabilities        SET user_id   = new_id WHERE user_id   = old_id;
  UPDATE public.shift_proposals       SET user_id   = new_id WHERE user_id   = old_id;
  UPDATE public.modification_requests SET user_id   = new_id WHERE user_id   = old_id;
  UPDATE public.checklist_submissions SET user_id   = new_id WHERE user_id   = old_id;
  UPDATE public.employee_documents    SET user_id   = new_id WHERE user_id   = old_id;
  UPDATE public.notifications         SET user_id   = new_id WHERE user_id   = old_id;
  UPDATE public.feedbacks             SET author_id = new_id WHERE author_id = old_id;
  UPDATE public.shift_reports         SET author_id = new_id WHERE author_id = old_id;
  UPDATE public.shift_handoffs        SET author_id = new_id WHERE author_id = old_id;
  UPDATE public.messages              SET sender_id    = new_id WHERE sender_id    = old_id;
  UPDATE public.messages              SET recipient_id = new_id WHERE recipient_id = old_id;

  INSERT INTO public.user_roles(user_id, role)
    SELECT new_id, role FROM public.user_roles WHERE user_id = old_id
    ON CONFLICT (user_id, role) DO NOTHING;
  DELETE FROM public.user_roles WHERE user_id = old_id;

  INSERT INTO public.user_business_roles(user_id, role)
    SELECT new_id, role FROM public.user_business_roles WHERE user_id = old_id
    ON CONFLICT DO NOTHING;
  DELETE FROM public.user_business_roles WHERE user_id = old_id;

  INSERT INTO public.user_studios(user_id, studio_id)
    SELECT new_id, studio_id FROM public.user_studios WHERE user_id = old_id
    ON CONFLICT DO NOTHING;
  DELETE FROM public.user_studios WHERE user_id = old_id;

  INSERT INTO public.user_contracts(user_id, contract)
    SELECT new_id, contract FROM public.user_contracts WHERE user_id = old_id
    ON CONFLICT DO NOTHING;
  DELETE FROM public.user_contracts WHERE user_id = old_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_invitation_token TEXT;
  v_invitation public.invitations%ROWTYPE;
  v_role TEXT;
  v_studio uuid;
  v_contract contract_type;
  v_admin_count INTEGER;
  v_primary_studio uuid;
  v_primary_contract contract_type;
BEGIN
  v_invitation_token := NEW.raw_user_meta_data->>'invitation_token';

  IF v_invitation_token IS NOT NULL THEN
    SELECT * INTO v_invitation FROM public.invitations
    WHERE token = v_invitation_token AND status = 'pending';

    IF FOUND THEN
      v_primary_studio := COALESCE(
        (CASE WHEN array_length(v_invitation.studio_ids,1) > 0 THEN v_invitation.studio_ids[1] END),
        v_invitation.studio_id
      );
      v_primary_contract := COALESCE(
        (CASE WHEN array_length(v_invitation.contracts,1) > 0 THEN v_invitation.contracts[1] END),
        v_invitation.contract
      );

      INSERT INTO public.profiles (id, email, first_name, last_name, phone, studio_id, contract, hire_date, status)
      VALUES (NEW.id, NEW.email, v_invitation.first_name, v_invitation.last_name, v_invitation.phone,
              v_primary_studio, v_primary_contract, v_invitation.hire_date, 'invited')
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        first_name = COALESCE(NULLIF(public.profiles.first_name, ''), EXCLUDED.first_name),
        last_name = COALESCE(NULLIF(public.profiles.last_name, ''), EXCLUDED.last_name),
        phone = COALESCE(public.profiles.phone, EXCLUDED.phone),
        studio_id = COALESCE(public.profiles.studio_id, EXCLUDED.studio_id),
        contract = COALESCE(public.profiles.contract, EXCLUDED.contract),
        hire_date = COALESCE(public.profiles.hire_date, EXCLUDED.hire_date),
        status = CASE WHEN public.profiles.status = 'active' THEN public.profiles.status ELSE 'invited'::profile_status END,
        updated_at = now();

      INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_invitation.app_role)
      ON CONFLICT (user_id, role) DO NOTHING;

      FOREACH v_role IN ARRAY COALESCE(v_invitation.business_roles, ARRAY[]::text[]) LOOP
        INSERT INTO public.user_business_roles (user_id, role) VALUES (NEW.id, v_role)
        ON CONFLICT DO NOTHING;
      END LOOP;

      IF array_length(v_invitation.studio_ids, 1) > 0 THEN
        FOREACH v_studio IN ARRAY v_invitation.studio_ids LOOP
          INSERT INTO public.user_studios (user_id, studio_id) VALUES (NEW.id, v_studio)
          ON CONFLICT DO NOTHING;
        END LOOP;
      ELSIF v_invitation.studio_id IS NOT NULL THEN
        INSERT INTO public.user_studios (user_id, studio_id) VALUES (NEW.id, v_invitation.studio_id)
        ON CONFLICT DO NOTHING;
      END IF;

      IF array_length(v_invitation.contracts, 1) > 0 THEN
        FOREACH v_contract IN ARRAY v_invitation.contracts LOOP
          INSERT INTO public.user_contracts (user_id, contract) VALUES (NEW.id, v_contract)
          ON CONFLICT DO NOTHING;
        END LOOP;
      ELSIF v_invitation.contract IS NOT NULL THEN
        INSERT INTO public.user_contracts (user_id, contract) VALUES (NEW.id, v_invitation.contract)
        ON CONFLICT DO NOTHING;
      END IF;

      RETURN NEW;
    END IF;
  END IF;

  SELECT COUNT(*) INTO v_admin_count FROM public.user_roles WHERE role = 'admin';

  INSERT INTO public.profiles (id, email, first_name, last_name, status)
  VALUES (NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    'active')
  ON CONFLICT (id) DO NOTHING;

  IF v_admin_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'employee')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;