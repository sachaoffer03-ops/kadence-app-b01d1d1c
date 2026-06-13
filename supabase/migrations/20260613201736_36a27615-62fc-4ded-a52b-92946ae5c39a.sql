CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$ BEGIN
  PERFORM cron.unschedule('process-avail-reminders');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'process-avail-reminders',
  '*/30 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://kadence-app.lovable.app/api/public/avail-reminders-tick',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxZWpheW9kcHByYmZnd2Flam1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzNTkxNDMsImV4cCI6MjA5MzkzNTE0M30.KffU3m14zt3pLk7gtDflSMOCkspvfexn7tbjbGXf-to'
    ),
    body := jsonb_build_object('source', 'pg_cron')
  );
  $cron$
);