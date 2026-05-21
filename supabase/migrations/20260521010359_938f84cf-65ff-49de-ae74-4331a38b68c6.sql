
ALTER TABLE public.studios
  ADD COLUMN IF NOT EXISTS clock_in_grace_period_min integer NOT NULL DEFAULT 15;

ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS clock_admin_note text NULL;

CREATE TABLE IF NOT EXISTS public.shift_clock_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  action text NOT NULL CHECK (action IN (
    'manual_clock_in','manual_clock_out','edit_minutes_late',
    'mark_no_show','undo_no_show','add_note','edit_note'
  )),
  before_value jsonb NULL,
  after_value jsonb NULL,
  note text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shift_clock_audit_shift ON public.shift_clock_audit(shift_id, created_at DESC);

ALTER TABLE public.shift_clock_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin/manager full access shift_clock_audit" ON public.shift_clock_audit;
CREATE POLICY "Admin/manager full access shift_clock_audit"
  ON public.shift_clock_audit FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role));

-- Unicité des notifs de pointage (shift_id encodé dans link) — on s'appuiera côté serveur
-- via une clé déterministe stockée dans body/link et un check d'existence.
