
SELECT cron.unschedule('process-avail-reminders');
SELECT cron.schedule(
  'process-avail-reminders',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://app.kadence.be/api/public/avail-reminders-tick',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxZWpheW9kcHByYmZnd2Flam1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzNTkxNDMsImV4cCI6MjA5MzkzNTE0M30.KffU3m14zt3pLk7gtDflSMOCkspvfexn7tbjbGXf-to'
    ),
    body := jsonb_build_object('source', 'pg_cron')
  );
  $$
);

SELECT cron.unschedule('role-transitions-tick');
SELECT cron.schedule(
  'role-transitions-tick',
  '*/3 7-23 * * *',
  $$
  SELECT net.http_post(
    url := 'https://app.kadence.be/api/public/role-transitions-tick',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxZWpheW9kcHByYmZnd2Flam1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzNTkxNDMsImV4cCI6MjA5MzkzNTE0M30.KffU3m14zt3pLk7gtDflSMOCkspvfexn7tbjbGXf-to'
    ),
    body := '{}'::jsonb
  );
  $$
);
