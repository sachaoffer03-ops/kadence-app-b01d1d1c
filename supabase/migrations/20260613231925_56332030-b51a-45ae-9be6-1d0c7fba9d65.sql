CREATE OR REPLACE FUNCTION public.diag_get_crons()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result json;
BEGIN
  SELECT json_agg(json_build_object(
    'jobid', jobid, 'jobname', jobname, 'schedule', schedule,
    'command', command, 'active', active
  )) INTO result FROM cron.job;
  RETURN COALESCE(result, '[]'::json);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('error', SQLERRM);
END $$;

CREATE OR REPLACE FUNCTION public.diag_test_locale()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN json_build_object(
    'month_locale', to_char(now(), 'TMMonth YYYY'),
    'day_locale', to_char(now(), 'TMDay'),
    'server_locale', current_setting('lc_time', true),
    'expected', 'Juin 2026 / Samedi (français)'
  );
END $$;

CREATE OR REPLACE FUNCTION public.diag_function_signature(fname text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result json;
BEGIN
  SELECT json_agg(json_build_object(
    'function_name', proname,
    'arguments', pg_get_function_arguments(oid),
    'returns', pg_get_function_result(oid)
  )) INTO result
  FROM pg_proc WHERE proname = fname AND pronamespace = 'public'::regnamespace;
  RETURN COALESCE(result, '[]'::json);
END $$;

CREATE OR REPLACE FUNCTION public.diag_realtime_tables()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result json;
BEGIN
  SELECT json_agg(json_build_object(
    'schemaname', schemaname, 'tablename', tablename
  )) INTO result FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
  RETURN COALESCE(result, '[]'::json);
END $$;

GRANT EXECUTE ON FUNCTION public.diag_get_crons() TO authenticated;
GRANT EXECUTE ON FUNCTION public.diag_test_locale() TO authenticated;
GRANT EXECUTE ON FUNCTION public.diag_function_signature(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.diag_realtime_tables() TO authenticated;