-- Attache le trigger d'absorption des profils orphelins (par email) sur profiles.
-- À l'inscription d'un nouvel auth.users, handle_new_user tente d'insérer un
-- nouveau profil ; si un profil orphelin existe déjà avec le même email
-- (invité puis auth.users supprimé), on migre ses shifts/rôles/etc. vers le
-- nouvel id, puis on supprime l'orphelin — ce qui débloque l'INSERT.
DROP TRIGGER IF EXISTS trg_absorb_duplicate_profile ON public.profiles;
CREATE TRIGGER trg_absorb_duplicate_profile
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.absorb_duplicate_profile();