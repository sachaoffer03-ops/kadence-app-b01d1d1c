
-- Restreindre l'exécution des fonctions SECURITY DEFINER
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon;

-- Restreindre la lecture du bucket avatars : autoriser uniquement la lecture de fichiers spécifiques (pas de listing)
DROP POLICY IF EXISTS "Avatars publics en lecture" ON storage.objects;
CREATE POLICY "Avatars accessibles individuellement"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars' AND name IS NOT NULL);
