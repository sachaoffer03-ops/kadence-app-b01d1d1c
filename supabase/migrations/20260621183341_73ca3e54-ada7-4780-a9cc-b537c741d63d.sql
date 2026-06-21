CREATE TABLE public.role_transition_notifications (
  shift_id uuid NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  transition_index int NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (shift_id, transition_index)
);

GRANT SELECT ON public.role_transition_notifications TO authenticated;
GRANT ALL ON public.role_transition_notifications TO service_role;

ALTER TABLE public.role_transition_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can view role transition notifications"
  ON public.role_transition_notifications
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  );
