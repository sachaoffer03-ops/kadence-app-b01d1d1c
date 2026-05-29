ALTER TABLE public.ai_chat_messages 
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS impersonate_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ai_chat_messages_is_test_idx 
  ON public.ai_chat_messages (is_test, user_id, created_at DESC);