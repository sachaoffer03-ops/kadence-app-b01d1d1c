
-- 1) Enum
DO $$ BEGIN
  CREATE TYPE public.availability_window_status AS ENUM ('draft', 'open', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Table
CREATE TABLE IF NOT EXISTS public.availability_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  deadline_at timestamptz NOT NULL,
  target_user_ids uuid[] NULL,
  status public.availability_window_status NOT NULL DEFAULT 'draft',
  notifications_sent jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  closed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  CHECK (period_start <= period_end)
);

-- 3) GRANTs (Data API requires explicit grants on public.*)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.availability_windows TO authenticated;
GRANT ALL ON public.availability_windows TO service_role;

-- 4) Indexes
CREATE INDEX IF NOT EXISTS availability_windows_status_idx
  ON public.availability_windows(status, deadline_at);
CREATE INDEX IF NOT EXISTS availability_windows_period_idx
  ON public.availability_windows(period_start, period_end);

-- 5) RLS
ALTER TABLE public.availability_windows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage windows" ON public.availability_windows;
CREATE POLICY "Admins manage windows"
  ON public.availability_windows
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  );

DROP POLICY IF EXISTS "Employees read their windows" ON public.availability_windows;
CREATE POLICY "Employees read their windows"
  ON public.availability_windows
  FOR SELECT
  TO authenticated
  USING (
    status = 'open'
    AND (
      target_user_ids IS NULL
      OR auth.uid() = ANY(target_user_ids)
    )
  );

-- 6) pg_cron job to tick every 15 min
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$ BEGIN
  PERFORM cron.unschedule('process-availability-windows');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'process-availability-windows',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://kadence-app.lovable.app/api/public/availability-windows-tick',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxZWpheW9kcHByYmZnd2Flam1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzNTkxNDMsImV4cCI6MjA5MzkzNTE0M30.KffU3m14zt3pLk7gtDflSMOCkspvfexn7tbjbGXf-to'
    ),
    body := jsonb_build_object('source', 'pg_cron')
  );
  $$
);
