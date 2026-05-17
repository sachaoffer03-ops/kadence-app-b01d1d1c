-- Modification 1: taux horaire
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hourly_rate numeric(10,2);
COMMENT ON COLUMN public.profiles.hourly_rate IS 'Taux horaire en EUR, défini par l''admin';

-- Modification 2: distinction vidéo uploadée / lien externe
ALTER TABLE public.training_resources ADD COLUMN IF NOT EXISTS is_uploaded_video boolean NOT NULL DEFAULT false;