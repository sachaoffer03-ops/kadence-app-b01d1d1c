
-- Storage buckets for training content
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('training-videos', 'training-videos', false, 524288000,
    ARRAY['video/mp4','video/quicktime','video/webm','video/x-m4v']),
  ('training-files', 'training-files', false, 52428800,
    ARRAY['application/pdf','image/png','image/jpeg','image/webp','image/gif'])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Policies: read for authenticated, write/update/delete for admin or manager
DROP POLICY IF EXISTS "training_videos_read" ON storage.objects;
DROP POLICY IF EXISTS "training_videos_write" ON storage.objects;
DROP POLICY IF EXISTS "training_videos_update" ON storage.objects;
DROP POLICY IF EXISTS "training_videos_delete" ON storage.objects;
DROP POLICY IF EXISTS "training_files_read" ON storage.objects;
DROP POLICY IF EXISTS "training_files_write" ON storage.objects;
DROP POLICY IF EXISTS "training_files_update" ON storage.objects;
DROP POLICY IF EXISTS "training_files_delete" ON storage.objects;

CREATE POLICY "training_videos_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'training-videos');
CREATE POLICY "training_videos_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'training-videos' AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role)));
CREATE POLICY "training_videos_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'training-videos' AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role)));
CREATE POLICY "training_videos_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'training-videos' AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role)));

CREATE POLICY "training_files_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'training-files');
CREATE POLICY "training_files_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'training-files' AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role)));
CREATE POLICY "training_files_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'training-files' AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role)));
CREATE POLICY "training_files_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'training-files' AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role)));
