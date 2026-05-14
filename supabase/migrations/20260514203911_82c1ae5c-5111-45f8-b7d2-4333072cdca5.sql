ALTER TABLE public.shift_proposals
ADD COLUMN IF NOT EXISTS replacement_request_id uuid NULL REFERENCES public.modification_requests(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_shift_proposals_replacement_request_id
ON public.shift_proposals(replacement_request_id);