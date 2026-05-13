-- 1. shifts: locks + draft + published_at
ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_manual boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

-- 2. shift_status enum: add draft
ALTER TYPE public.shift_status ADD VALUE IF NOT EXISTS 'draft';

-- 3. Index performance
CREATE INDEX IF NOT EXISTS idx_shifts_date_studio ON public.shifts(shift_date, studio_id);
CREATE INDEX IF NOT EXISTS idx_shifts_user_date ON public.shifts(user_id, shift_date);

-- 4. planning_publications
CREATE TABLE IF NOT EXISTS public.planning_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  published_by uuid NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  period_start date NOT NULL,
  period_end date NOT NULL,
  shifts_count integer NOT NULL DEFAULT 0
);
ALTER TABLE public.planning_publications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins/managers voient publications" ON public.planning_publications
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Admins/managers créent publications" ON public.planning_publications
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- 5. notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications(user_id, created_at DESC);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Utilisateur voit ses notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Utilisateur marque ses notifs lues" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins/managers créent notifs" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Utilisateur supprime ses notifs" ON public.notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 6. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;