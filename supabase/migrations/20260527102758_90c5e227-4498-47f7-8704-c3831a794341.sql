CREATE TABLE public.ai_knowledge_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  content text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  tags text[] NOT NULL DEFAULT '{}',
  priority smallint NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  author_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_knowledge_entries_active ON public.ai_knowledge_entries (is_active, category, priority DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_knowledge_entries TO authenticated;
GRANT ALL ON public.ai_knowledge_entries TO service_role;

ALTER TABLE public.ai_knowledge_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gèrent les entrées de connaissance"
ON public.ai_knowledge_entries
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authentifiés lisent les entrées actives"
ON public.ai_knowledge_entries
FOR SELECT
TO authenticated
USING (is_active = true OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_ai_knowledge_entries_updated_at
BEFORE UPDATE ON public.ai_knowledge_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();