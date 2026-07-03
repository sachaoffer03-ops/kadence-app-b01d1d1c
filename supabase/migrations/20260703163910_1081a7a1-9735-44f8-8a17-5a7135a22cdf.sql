-- Étape 1 préparation multi-tenant : table de config email par organisation.
-- Aujourd'hui : une seule ligne "default" utilisée par tous les emails.
-- Plus tard : une ligne par organisation quand le vrai multi-tenant arrivera.

CREATE TABLE public.organization_email_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  display_name text NOT NULL DEFAULT 'Skult',
  brand_color text NOT NULL DEFAULT '#C44A28',
  logo_url text,
  reply_to_email text,
  from_name text NOT NULL DEFAULT 'Skult Studios',
  footer_note text,
  privacy_url text DEFAULT 'https://kadence.io/privacy',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.organization_email_config TO authenticated;
GRANT ALL ON public.organization_email_config TO service_role;

ALTER TABLE public.organization_email_config ENABLE ROW LEVEL SECURITY;

-- Lecture : tout utilisateur authentifié peut lire (branding non-sensible)
CREATE POLICY "authenticated read email config"
  ON public.organization_email_config
  FOR SELECT
  TO authenticated
  USING (true);

-- Écriture : réservée aux admins
CREATE POLICY "admins manage email config"
  ON public.organization_email_config
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_org_email_config_updated_at
BEFORE UPDATE ON public.organization_email_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Ligne "default" avec un UUID fixe, utilisée tant que le multi-tenant n'est pas actif.
INSERT INTO public.organization_email_config (id, slug, display_name, brand_color, from_name, reply_to_email, footer_note)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'default',
  'Skult Studios',
  '#C44A28',
  'Skult Studios',
  NULL,
  NULL
)
ON CONFLICT (id) DO NOTHING;
