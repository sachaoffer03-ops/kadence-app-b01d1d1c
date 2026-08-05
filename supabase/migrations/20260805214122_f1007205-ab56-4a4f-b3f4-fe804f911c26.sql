CREATE TABLE public.recurring_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  business_role text NOT NULL,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  date_from date NOT NULL,
  date_to date NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time > start_time),
  CHECK (date_to >= date_from)
);

CREATE INDEX idx_recurring_assignments_user ON public.recurring_assignments(user_id);
CREATE INDEX idx_recurring_assignments_period ON public.recurring_assignments(date_from, date_to) WHERE is_active;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_assignments TO authenticated;
GRANT ALL ON public.recurring_assignments TO service_role;

ALTER TABLE public.recurring_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage recurring assignments"
ON public.recurring_assignments FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers manage recurring assignments"
ON public.recurring_assignments FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Users view own recurring assignments"
ON public.recurring_assignments FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE TRIGGER trg_recurring_assignments_updated_at
BEFORE UPDATE ON public.recurring_assignments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();