
-- 1. Étendre ai_knowledge_entries pour supporter plusieurs types
ALTER TABLE public.ai_knowledge_entries
  ADD COLUMN IF NOT EXISTS entry_type text NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.ai_knowledge_entries
  DROP CONSTRAINT IF EXISTS ai_knowledge_entries_entry_type_check;
ALTER TABLE public.ai_knowledge_entries
  ADD CONSTRAINT ai_knowledge_entries_entry_type_check
  CHECK (entry_type IN ('text','faq','link','file','table'));

CREATE INDEX IF NOT EXISTS idx_ai_knowledge_entries_type
  ON public.ai_knowledge_entries (entry_type, is_active);

-- 2. Table des feedbacks sur les réponses du chatbot
CREATE TABLE IF NOT EXISTS public.ai_message_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL UNIQUE REFERENCES public.ai_chat_messages(id) ON DELETE CASCADE,
  rating text NOT NULL CHECK (rating IN ('up','down','correction')),
  comment text,
  corrected_answer text,
  admin_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_message_feedback TO authenticated;
GRANT ALL ON public.ai_message_feedback TO service_role;

ALTER TABLE public.ai_message_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins gèrent les feedbacks" ON public.ai_message_feedback;
CREATE POLICY "Admins gèrent les feedbacks" ON public.ai_message_feedback
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_ai_message_feedback_rating
  ON public.ai_message_feedback (rating, created_at DESC);

CREATE TRIGGER trg_ai_message_feedback_updated_at
  BEFORE UPDATE ON public.ai_message_feedback
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Permettre aux admins de lire toutes les conversations (pour la supervision)
DROP POLICY IF EXISTS "admins_read_all_chat" ON public.ai_chat_messages;
CREATE POLICY "admins_read_all_chat" ON public.ai_chat_messages
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 4. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_message_feedback;

-- 5. Storage bucket pour les fichiers de connaissance
INSERT INTO storage.buckets (id, name, public)
VALUES ('ai-knowledge', 'ai-knowledge', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Admins read ai-knowledge" ON storage.objects;
CREATE POLICY "Admins read ai-knowledge" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'ai-knowledge' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins write ai-knowledge" ON storage.objects;
CREATE POLICY "Admins write ai-knowledge" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ai-knowledge' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins delete ai-knowledge" ON storage.objects;
CREATE POLICY "Admins delete ai-knowledge" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'ai-knowledge' AND public.has_role(auth.uid(), 'admin'));
