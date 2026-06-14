
-- 1. Studios — hide sensitive operational fields from regular employees
REVOKE SELECT (internal_notes, current_qr_code, qr_generated_at, lat, lng)
  ON public.studios FROM authenticated;

-- 2. Checklist photos storage — scope submission reads to owner + admin/manager
DROP POLICY IF EXISTS "Auth read checklist photos" ON storage.objects;

CREATE POLICY "Read own submission checklist photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'checklist-photos'
    AND (storage.foldername(name))[1] = 'submissions'
    AND (
      (storage.foldername(name))[2] = (auth.uid())::text
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'manager'::public.app_role)
    )
  );

CREATE POLICY "Read reference checklist photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'checklist-photos'
    AND (storage.foldername(name))[1] = 'references'
  );

-- 3. employee_documents — owner can only flip first_viewed_at
CREATE OR REPLACE FUNCTION public.guard_employee_documents_owner_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::public.app_role)
     OR public.has_role(auth.uid(), 'manager'::public.app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.uploaded_by IS DISTINCT FROM OLD.uploaded_by
     OR NEW.type IS DISTINCT FROM OLD.type
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.description IS DISTINCT FROM OLD.description
     OR NEW.file_path IS DISTINCT FROM OLD.file_path
     OR NEW.file_size_bytes IS DISTINCT FROM OLD.file_size_bytes
     OR NEW.file_mime_type IS DISTINCT FROM OLD.file_mime_type
     OR NEW.period_start IS DISTINCT FROM OLD.period_start
     OR NEW.period_end IS DISTINCT FROM OLD.period_end
     OR NEW.is_archived IS DISTINCT FROM OLD.is_archived
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Seul le champ first_viewed_at peut etre modifie par le proprietaire du document';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS guard_employee_documents_owner_update ON public.employee_documents;
CREATE TRIGGER guard_employee_documents_owner_update
  BEFORE UPDATE ON public.employee_documents
  FOR EACH ROW EXECUTE FUNCTION public.guard_employee_documents_owner_update();
