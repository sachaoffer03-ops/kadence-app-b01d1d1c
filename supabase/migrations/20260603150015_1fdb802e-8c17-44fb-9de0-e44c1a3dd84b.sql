
DELETE FROM public.shift_handoffs WHERE shift_id IN (SELECT id FROM public.shifts WHERE shift_date BETWEEN '2026-06-04' AND '2026-06-30');
DELETE FROM public.shift_proposals WHERE shift_id IN (SELECT id FROM public.shifts WHERE shift_date BETWEEN '2026-06-04' AND '2026-06-30');
DELETE FROM public.shift_reports WHERE shift_id IN (SELECT id FROM public.shifts WHERE shift_date BETWEEN '2026-06-04' AND '2026-06-30');
DELETE FROM public.feedbacks WHERE shift_id IN (SELECT id FROM public.shifts WHERE shift_date BETWEEN '2026-06-04' AND '2026-06-30');
DELETE FROM public.modification_requests WHERE shift_id IN (SELECT id FROM public.shifts WHERE shift_date BETWEEN '2026-06-04' AND '2026-06-30');
DELETE FROM public.checklist_submissions WHERE shift_id IN (SELECT id FROM public.shifts WHERE shift_date BETWEEN '2026-06-04' AND '2026-06-30');
DELETE FROM public.shift_clock_audit WHERE shift_id IN (SELECT id FROM public.shifts WHERE shift_date BETWEEN '2026-06-04' AND '2026-06-30');
DELETE FROM public.shifts WHERE shift_date BETWEEN '2026-06-04' AND '2026-06-30';
