ALTER TABLE public.shifts REPLICA IDENTITY FULL;
ALTER TABLE public.availabilities REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shifts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.availabilities;