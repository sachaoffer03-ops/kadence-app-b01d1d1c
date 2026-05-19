CREATE INDEX IF NOT EXISTS idx_shifts_status_date ON public.shifts (status, shift_date);
CREATE INDEX IF NOT EXISTS idx_shifts_user_date ON public.shifts (user_id, shift_date);
CREATE INDEX IF NOT EXISTS idx_shifts_studio_date ON public.shifts (studio_id, shift_date);
CREATE INDEX IF NOT EXISTS idx_checklist_subs_user ON public.checklist_submissions (user_id, status);
CREATE INDEX IF NOT EXISTS idx_closure_resp_sub ON public.closure_question_responses (submission_id);