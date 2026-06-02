CREATE INDEX IF NOT EXISTS idx_shifts_user_created ON public.shifts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_modification_requests_user_resolved ON public.modification_requests (user_id, resolved_at DESC) WHERE resolved_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_recipient_created ON public.messages (recipient_id, created_at DESC);