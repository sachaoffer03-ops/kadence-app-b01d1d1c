-- Colonnes pour tracer par provider et retrouver l'email dans Resend
ALTER TABLE public.email_send_log
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS resend_email_id text;

CREATE INDEX IF NOT EXISTS idx_email_send_log_resend_id
  ON public.email_send_log(resend_email_id)
  WHERE resend_email_id IS NOT NULL;

-- Ajouter 'delivered' aux statuts autorisés
ALTER TABLE public.email_send_log
  DROP CONSTRAINT IF EXISTS email_send_log_status_check;
ALTER TABLE public.email_send_log
  ADD CONSTRAINT email_send_log_status_check
  CHECK (status = ANY (ARRAY['pending','sent','delivered','suppressed','failed','bounced','complained','dlq']));

-- Table d'idempotence pour les webhooks Resend/Svix
CREATE TABLE IF NOT EXISTS public.email_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL UNIQUE,
  provider text NOT NULL,
  event_type text NOT NULL,
  payload jsonb,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_webhook_events_received
  ON public.email_webhook_events(received_at DESC);

GRANT ALL ON public.email_webhook_events TO service_role;

ALTER TABLE public.email_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only webhook events"
  ON public.email_webhook_events
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
