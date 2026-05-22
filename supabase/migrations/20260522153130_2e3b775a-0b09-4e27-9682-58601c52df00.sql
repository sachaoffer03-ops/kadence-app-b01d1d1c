
-- 1) Dedupe: for each (studio_id, business_role_id, phase) keep oldest, reparent items/photos, delete others
WITH ranked AS (
  SELECT id, studio_id, business_role_id, phase, created_at,
         ROW_NUMBER() OVER (
           PARTITION BY COALESCE(studio_id::text,'_'), COALESCE(business_role_id::text,'_'), COALESCE(phase,'_')
           ORDER BY created_at ASC, id ASC
         ) AS rn,
         FIRST_VALUE(id) OVER (
           PARTITION BY COALESCE(studio_id::text,'_'), COALESCE(business_role_id::text,'_'), COALESCE(phase,'_')
           ORDER BY created_at ASC, id ASC
         ) AS keep_id
  FROM public.checklist_templates
),
dupes AS (
  SELECT id AS dup_id, keep_id FROM ranked WHERE rn > 1
)
UPDATE public.checklist_template_items ti
SET template_id = d.keep_id
FROM dupes d
WHERE ti.template_id = d.dup_id;

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY COALESCE(studio_id::text,'_'), COALESCE(business_role_id::text,'_'), COALESCE(phase,'_')
           ORDER BY created_at ASC, id ASC
         ) AS rn,
         FIRST_VALUE(id) OVER (
           PARTITION BY COALESCE(studio_id::text,'_'), COALESCE(business_role_id::text,'_'), COALESCE(phase,'_')
           ORDER BY created_at ASC, id ASC
         ) AS keep_id
  FROM public.checklist_templates
),
dupes AS (
  SELECT id AS dup_id, keep_id FROM ranked WHERE rn > 1
)
UPDATE public.checklist_template_photos tp
SET template_id = d.keep_id
FROM dupes d
WHERE tp.template_id = d.dup_id;

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY COALESCE(studio_id::text,'_'), COALESCE(business_role_id::text,'_'), COALESCE(phase,'_')
           ORDER BY created_at ASC, id ASC
         ) AS rn,
         FIRST_VALUE(id) OVER (
           PARTITION BY COALESCE(studio_id::text,'_'), COALESCE(business_role_id::text,'_'), COALESCE(phase,'_')
           ORDER BY created_at ASC, id ASC
         ) AS keep_id
  FROM public.checklist_templates
),
dupes AS (
  SELECT id AS dup_id, keep_id FROM ranked WHERE rn > 1
)
UPDATE public.checklist_submissions s
SET template_id = d.keep_id
FROM dupes d
WHERE s.template_id = d.dup_id;

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY COALESCE(studio_id::text,'_'), COALESCE(business_role_id::text,'_'), COALESCE(phase,'_')
           ORDER BY created_at ASC, id ASC
         ) AS rn
  FROM public.checklist_templates
)
DELETE FROM public.checklist_templates
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 2) Renumber order_index per template (gaps + collisions after reparenting)
WITH ord AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY template_id ORDER BY order_index ASC, created_at ASC) - 1 AS new_idx
  FROM public.checklist_template_items
)
UPDATE public.checklist_template_items ti
SET order_index = ord.new_idx
FROM ord
WHERE ti.id = ord.id AND ti.order_index <> ord.new_idx;

WITH ord AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY template_id ORDER BY order_index ASC, created_at ASC) - 1 AS new_idx
  FROM public.checklist_template_photos
)
UPDATE public.checklist_template_photos tp
SET order_index = ord.new_idx
FROM ord
WHERE tp.id = ord.id AND tp.order_index <> ord.new_idx;

-- 3) Unique index (handles NULLs via COALESCE)
CREATE UNIQUE INDEX IF NOT EXISTS checklist_templates_unique_studio_role_phase
ON public.checklist_templates (
  COALESCE(studio_id::text, '_'),
  COALESCE(business_role_id::text, '_'),
  COALESCE(phase, '_')
);
