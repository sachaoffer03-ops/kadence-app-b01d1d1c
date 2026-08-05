CREATE TABLE public.training_course_studios (
  course_id uuid NOT NULL REFERENCES public.training_courses(id) ON DELETE CASCADE,
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (course_id, studio_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_course_studios TO authenticated;
GRANT ALL ON public.training_course_studios TO service_role;

ALTER TABLE public.training_course_studios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view course studios"
ON public.training_course_studios FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and managers manage course studios"
ON public.training_course_studios FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

CREATE INDEX idx_training_course_studios_studio ON public.training_course_studios(studio_id);