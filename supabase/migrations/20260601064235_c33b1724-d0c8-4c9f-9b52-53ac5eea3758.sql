
-- 1. Helper : transfère toutes les données d'un ancien profil vers un nouveau
CREATE OR REPLACE FUNCTION public.merge_profile_data(old_id uuid, new_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  -- Rôles : fusion sans doublon
  INSERT INTO public.user_roles(user_id, role)
    SELECT new_id, role FROM public.user_roles WHERE user_id = old_id
    ON CONFLICT (user_id, role) DO NOTHING;
  DELETE FROM public.user_roles WHERE user_id = old_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.merge_profile_data(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- 2. Nettoyage du doublon existant Samar Bardi
SELECT public.merge_profile_data(
  '2182f73c-05ed-43bb-b4b0-ce91b76f6e04'::uuid,
  '908971bf-c3e6-4f5e-a6f6-70ad44b38f64'::uuid
);
DELETE FROM public.profiles WHERE id = '2182f73c-05ed-43bb-b4b0-ce91b76f6e04';

-- 3. Trigger BEFORE INSERT : merge automatique des orphelins lors d'une nouvelle inscription
CREATE OR REPLACE FUNCTION public.absorb_duplicate_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  orphan record;
BEGIN
  FOR orphan IN
    SELECT id FROM public.profiles
    WHERE lower(email) = lower(NEW.email)
      AND id <> NEW.id
  LOOP
    PERFORM public.merge_profile_data(orphan.id, NEW.id);
    DELETE FROM public.profiles WHERE id = orphan.id;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_absorb_duplicate_profile ON public.profiles;
CREATE TRIGGER trg_absorb_duplicate_profile
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.absorb_duplicate_profile();

-- 4. Contrainte d'unicité (insensible à la casse) sur l'email
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_lower_unique
  ON public.profiles (lower(email));
