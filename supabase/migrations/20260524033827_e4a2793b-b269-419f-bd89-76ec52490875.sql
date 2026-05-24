DELETE FROM public.profiles
WHERE id NOT IN (SELECT id FROM auth.users);