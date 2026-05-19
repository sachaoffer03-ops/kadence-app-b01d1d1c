
ALTER TABLE public.studios
  ADD COLUMN IF NOT EXISTS lat double precision NULL,
  ADD COLUMN IF NOT EXISTS lng double precision NULL;

ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS dimona_status text NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'shifts_dimona_status_check'
  ) THEN
    ALTER TABLE public.shifts
      ADD CONSTRAINT shifts_dimona_status_check
      CHECK (dimona_status IS NULL OR dimona_status IN ('pending','sent','failed','not_applicable'));
  END IF;
END $$;

-- Idempotency constraint for closure responses (one response per question per submission)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'closure_question_responses_submission_question_unique'
  ) THEN
    ALTER TABLE public.closure_question_responses
      ADD CONSTRAINT closure_question_responses_submission_question_unique
      UNIQUE (submission_id, question_id);
  END IF;
END $$;
