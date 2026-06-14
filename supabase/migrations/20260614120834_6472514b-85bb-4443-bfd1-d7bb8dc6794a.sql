
-- 1) Restrict studios SELECT to admins/managers or members of that studio
DROP POLICY IF EXISTS "Studios visibles par les utilisateurs connectés" ON public.studios;
CREATE POLICY "Studios visibles aux membres et admins"
ON public.studios
FOR SELECT
TO authenticated
USING (
  deleted_at IS NULL
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.user_studios us
      WHERE us.studio_id = studios.id AND us.user_id = auth.uid()
    )
  )
);

-- 2) Revoke sensitive columns from authenticated; only service_role reads them server-side
REVOKE SELECT (current_qr_code, internal_notes) ON public.studios FROM authenticated;

-- 3) Replace the overly-permissive owner UPDATE policy with a field-locking trigger
CREATE OR REPLACE FUNCTION public.trg_employee_documents_owner_field_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL
     OR public.has_role(auth.uid(), 'admin'::app_role)
     OR public.has_role(auth.uid(), 'manager'::app_role) THEN
    RETURN NEW;
  END IF;
  -- Owner can only update first_viewed_at; lock all other fields back to OLD
  NEW.user_id := OLD.user_id;
  NEW.uploaded_by := OLD.uploaded_by;
  NEW.type := OLD.type;
  NEW.title := OLD.title;
  NEW.description := OLD.description;
  NEW.file_path := OLD.file_path;
  NEW.file_size_bytes := OLD.file_size_bytes;
  NEW.file_mime_type := OLD.file_mime_type;
  NEW.period_start := OLD.period_start;
  NEW.period_end := OLD.period_end;
  NEW.is_archived := OLD.is_archived;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_employee_documents_owner_field_guard ON public.employee_documents;
CREATE TRIGGER trg_employee_documents_owner_field_guard
BEFORE UPDATE ON public.employee_documents
FOR EACH ROW EXECUTE FUNCTION public.trg_employee_documents_owner_field_guard();

-- 4) Fix formation-videos bucket: remove public read, require auth
DROP POLICY IF EXISTS "Public read formation videos" ON storage.objects;
CREATE POLICY "Authenticated read formation videos"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'formation-videos');
