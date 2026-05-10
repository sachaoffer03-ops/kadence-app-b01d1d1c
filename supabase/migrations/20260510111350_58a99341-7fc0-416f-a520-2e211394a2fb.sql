
-- Checklist templates
CREATE TABLE public.checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID,
  business_role business_role NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (studio_id, business_role)
);
ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tout le monde voit les templates"
  ON public.checklist_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins/managers gèrent les templates"
  ON public.checklist_templates FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'));

CREATE TRIGGER trg_checklist_templates_updated
  BEFORE UPDATE ON public.checklist_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Training paths (parcours regroupant des formations)
CREATE TABLE public.training_paths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'role' CHECK (type IN ('commun','role')),
  required_role business_role,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.training_paths ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tout le monde voit les parcours"
  ON public.training_paths FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins gèrent les parcours"
  ON public.training_paths FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'))
  WITH CHECK (has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_training_paths_updated
  BEFORE UPDATE ON public.training_paths
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Lien formation -> parcours
ALTER TABLE public.formations ADD COLUMN IF NOT EXISTS path_id UUID;
ALTER TABLE public.formations ADD COLUMN IF NOT EXISTS position INTEGER NOT NULL DEFAULT 0;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.checklist_templates;
ALTER PUBLICATION supabase_realtime ADD TABLE public.training_paths;
