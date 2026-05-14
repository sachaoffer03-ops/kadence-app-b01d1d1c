
ALTER TABLE public.staffing_templates
  ADD COLUMN IF NOT EXISTS allowed_contracts contract_type[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS allowed_roles text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.ai_planning_settings
  ADD COLUMN IF NOT EXISTS max_weekly_student_hours smallint NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS max_weekly_flexi_hours smallint NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS max_weekly_cdi_hours smallint NOT NULL DEFAULT 48;
