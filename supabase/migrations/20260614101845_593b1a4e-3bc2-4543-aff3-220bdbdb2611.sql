
-- ============ FIX 1 — Cleanup orphans + ON DELETE CASCADE ============
DELETE FROM public.user_studios WHERE user_id NOT IN (SELECT id FROM public.profiles);
DELETE FROM public.user_business_roles WHERE user_id NOT IN (SELECT id FROM public.profiles);
DELETE FROM public.user_contracts WHERE user_id NOT IN (SELECT id FROM public.profiles);

DO $$
DECLARE cn text;
BEGIN
  -- user_studios.user_id -> profiles
  SELECT conname INTO cn FROM pg_constraint
    WHERE conrelid = 'public.user_studios'::regclass AND contype = 'f'
      AND pg_get_constraintdef(oid) ILIKE '%REFERENCES%profiles%'
      AND pg_get_constraintdef(oid) ILIKE '%(user_id)%';
  IF cn IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.user_studios DROP CONSTRAINT %I', cn);
  END IF;
  ALTER TABLE public.user_studios
    ADD CONSTRAINT user_studios_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

  -- user_business_roles.user_id -> profiles
  SELECT conname INTO cn FROM pg_constraint
    WHERE conrelid = 'public.user_business_roles'::regclass AND contype = 'f'
      AND pg_get_constraintdef(oid) ILIKE '%REFERENCES%profiles%'
      AND pg_get_constraintdef(oid) ILIKE '%(user_id)%';
  IF cn IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.user_business_roles DROP CONSTRAINT %I', cn);
  END IF;
  ALTER TABLE public.user_business_roles
    ADD CONSTRAINT user_business_roles_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

  -- user_contracts.user_id -> profiles
  SELECT conname INTO cn FROM pg_constraint
    WHERE conrelid = 'public.user_contracts'::regclass AND contype = 'f'
      AND pg_get_constraintdef(oid) ILIKE '%REFERENCES%profiles%'
      AND pg_get_constraintdef(oid) ILIKE '%(user_id)%';
  IF cn IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.user_contracts DROP CONSTRAINT %I', cn);
  END IF;
  ALTER TABLE public.user_contracts
    ADD CONSTRAINT user_contracts_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
END $$;

-- ============ FIX 2 — DROP legacy column ============
ALTER TABLE public.ai_planning_settings DROP COLUMN IF EXISTS availability_deadline_day;

-- ============ FIX 4 — Reduce realtime publication ============
DO $$
DECLARE
  t text;
  to_remove text[] := ARRAY[
    'public.profiles',
    'public.shifts',
    'public.availabilities',
    'public.shift_handoffs',
    'public.shift_reports',
    'public.modification_requests',
    'public.signalements',
    'public.feedbacks',
    'public.training_sections',
    'public.training_modules',
    'public.training_contents',
    'public.ai_message_feedback'
  ];
BEGIN
  FOREACH t IN ARRAY to_remove LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE %s', t);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipped DROP for %: %', t, SQLERRM;
    END;
  END LOOP;
END $$;
