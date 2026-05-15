-- =========================================
-- TABLES
-- =========================================

CREATE TABLE IF NOT EXISTS public.training_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  icon text,
  color text,
  order_index integer NOT NULL DEFAULT 0,
  required_for_roles text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.training_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id uuid NOT NULL REFERENCES public.training_folders(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.training_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id uuid NOT NULL REFERENCES public.training_steps(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('video','pdf','note','link')),
  title text NOT NULL,
  content text NOT NULL,
  duration_seconds integer,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.training_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  resource_id uuid NOT NULL REFERENCES public.training_resources(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','completed')),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, resource_id)
);

CREATE INDEX IF NOT EXISTS idx_training_steps_folder ON public.training_steps(folder_id, order_index);
CREATE INDEX IF NOT EXISTS idx_training_resources_step ON public.training_resources(step_id, order_index);
CREATE INDEX IF NOT EXISTS idx_training_progress_user ON public.training_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_training_progress_resource ON public.training_progress(resource_id);
CREATE INDEX IF NOT EXISTS idx_training_folders_order ON public.training_folders(order_index) WHERE deleted_at IS NULL;

-- updated_at triggers
DROP TRIGGER IF EXISTS trg_training_folders_updated ON public.training_folders;
CREATE TRIGGER trg_training_folders_updated BEFORE UPDATE ON public.training_folders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_training_steps_updated ON public.training_steps;
CREATE TRIGGER trg_training_steps_updated BEFORE UPDATE ON public.training_steps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_training_resources_updated ON public.training_resources;
CREATE TRIGGER trg_training_resources_updated BEFORE UPDATE ON public.training_resources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_training_progress_updated ON public.training_progress;
CREATE TRIGGER trg_training_progress_updated BEFORE UPDATE ON public.training_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- RLS
-- =========================================
ALTER TABLE public.training_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth read folders" ON public.training_folders;
CREATE POLICY "Auth read folders" ON public.training_folders FOR SELECT TO authenticated USING (deleted_at IS NULL);
DROP POLICY IF EXISTS "Admins manage folders" ON public.training_folders;
CREATE POLICY "Admins manage folders" ON public.training_folders FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

DROP POLICY IF EXISTS "Auth read steps" ON public.training_steps;
CREATE POLICY "Auth read steps" ON public.training_steps FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins manage steps" ON public.training_steps;
CREATE POLICY "Admins manage steps" ON public.training_steps FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

DROP POLICY IF EXISTS "Auth read resources" ON public.training_resources;
CREATE POLICY "Auth read resources" ON public.training_resources FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins manage resources" ON public.training_resources;
CREATE POLICY "Admins manage resources" ON public.training_resources FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

DROP POLICY IF EXISTS "User reads own progress" ON public.training_progress;
CREATE POLICY "User reads own progress" ON public.training_progress FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));
DROP POLICY IF EXISTS "User inserts own progress" ON public.training_progress;
CREATE POLICY "User inserts own progress" ON public.training_progress FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "User updates own progress" ON public.training_progress;
CREATE POLICY "User updates own progress" ON public.training_progress FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Admins delete progress" ON public.training_progress;
CREATE POLICY "Admins delete progress" ON public.training_progress FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role));

-- =========================================
-- STORAGE BUCKET
-- =========================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('training-resources', 'training-resources', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Auth read training files" ON storage.objects;
CREATE POLICY "Auth read training files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'training-resources');
DROP POLICY IF EXISTS "Admins upload training files" ON storage.objects;
CREATE POLICY "Admins upload training files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'training-resources' AND public.has_role(auth.uid(),'admin'::app_role));
DROP POLICY IF EXISTS "Admins update training files" ON storage.objects;
CREATE POLICY "Admins update training files" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'training-resources' AND public.has_role(auth.uid(),'admin'::app_role));
DROP POLICY IF EXISTS "Admins delete training files" ON storage.objects;
CREATE POLICY "Admins delete training files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'training-resources' AND public.has_role(auth.uid(),'admin'::app_role));