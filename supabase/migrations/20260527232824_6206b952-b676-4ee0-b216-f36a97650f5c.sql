ALTER TABLE public.feedbacks DROP CONSTRAINT IF EXISTS feedbacks_rating_check;
ALTER TABLE public.feedbacks ADD CONSTRAINT feedbacks_rating_check CHECK (rating >= 0 AND rating <= 10);