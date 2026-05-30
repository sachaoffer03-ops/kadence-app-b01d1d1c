
-- 1. Flag contributeur IA sur profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ai_contributor boolean NOT NULL DEFAULT false;

-- 2. Table des suggestions de connaissance soumises par les employés
CREATE TYPE public.ai_suggestion_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE public.ai_knowledge_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  entry_type text NOT NULL DEFAULT 'text',
  status public.ai_suggestion_status NOT NULL DEFAULT 'pending',
  reviewer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  approved_entry_id uuid REFERENCES public.ai_knowledge_entries(id) ON DELETE SET NULL,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_suggestions_status ON public.ai_knowledge_suggestions(status, created_at DESC);
CREATE INDEX idx_ai_suggestions_author ON public.ai_knowledge_suggestions(author_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_knowledge_suggestions TO authenticated;
GRANT ALL ON public.ai_knowledge_suggestions TO service_role;

ALTER TABLE public.ai_knowledge_suggestions ENABLE ROW LEVEL SECURITY;

-- Les employés contributeurs peuvent INSÉRER (vérifié aussi côté server fn)
CREATE POLICY "Contributors can insert own suggestions"
  ON public.ai_knowledge_suggestions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND ai_contributor = true
    )
  );

-- Pas de SELECT pour les employés (ils ne doivent pas voir le statut).
-- Admins/managers gèrent tout
CREATE POLICY "Admins can read all suggestions"
  ON public.ai_knowledge_suggestions
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admins can update suggestions"
  ON public.ai_knowledge_suggestions
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admins can delete suggestions"
  ON public.ai_knowledge_suggestions
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_ai_suggestions_updated_at
  BEFORE UPDATE ON public.ai_knowledge_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
