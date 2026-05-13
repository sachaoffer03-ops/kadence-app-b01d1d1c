ALTER TABLE public.shifts
  ADD CONSTRAINT shifts_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;