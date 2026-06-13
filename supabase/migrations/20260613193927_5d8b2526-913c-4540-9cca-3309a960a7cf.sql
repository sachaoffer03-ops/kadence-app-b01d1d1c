DO $$
DECLARE jid bigint;
BEGIN
  FOR jid IN
    SELECT jobid FROM cron.job
     WHERE jobname LIKE '%availability-windows%'
        OR jobname LIKE '%avail-window%'
  LOOP
    PERFORM cron.unschedule(jid);
  END LOOP;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DROP TABLE IF EXISTS public.availability_windows CASCADE;
DROP TYPE IF EXISTS public.availability_window_status CASCADE;