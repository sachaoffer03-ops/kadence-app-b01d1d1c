CREATE OR REPLACE FUNCTION public.get_default_admin()
RETURNS TABLE(user_id uuid, first_name text, last_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH my_studios AS (
    SELECT studio_id FROM public.user_studios WHERE user_id = auth.uid()
    UNION
    SELECT studio_id FROM public.profiles WHERE id = auth.uid() AND studio_id IS NOT NULL
  ),
  same_studio_admin AS (
    SELECT p.id, p.first_name, p.last_name
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    LEFT JOIN public.user_studios us ON us.user_id = ur.user_id
    WHERE ur.role = 'admin'
      AND (us.studio_id IN (SELECT studio_id FROM my_studios)
           OR p.studio_id IN (SELECT studio_id FROM my_studios))
    LIMIT 1
  ),
  any_admin AS (
    SELECT p.id, p.first_name, p.last_name
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.role = 'admin'
    ORDER BY p.created_at ASC
    LIMIT 1
  )
  SELECT id AS user_id, first_name, last_name FROM same_studio_admin
  UNION ALL
  SELECT id, first_name, last_name FROM any_admin
  WHERE NOT EXISTS (SELECT 1 FROM same_studio_admin)
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_default_admin() TO authenticated;