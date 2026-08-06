WITH pairs AS (
  SELECT h.id AS hole_id, a.id AS shift_id, h.start_time AS new_start
  FROM shifts h
  JOIN shifts a
    ON a.studio_id = h.studio_id
   AND a.shift_date = h.shift_date
   AND a.business_role = h.business_role
   AND a.start_time = h.end_time
   AND a.user_id IS NOT NULL
  WHERE h.studio_id = '0e707d2d-5124-46aa-895c-f45573d7067c'
    AND h.shift_date BETWEEN '2026-09-01' AND '2026-09-30'
    AND h.user_id IS NULL
    AND h.is_manual = false
    AND a.is_manual = false
    AND (h.end_time - h.start_time) < interval '3 hours'
), upd AS (
  UPDATE shifts s SET start_time = p.new_start, updated_at = now()
  FROM pairs p WHERE s.id = p.shift_id
  RETURNING s.id
)
DELETE FROM shifts WHERE id IN (SELECT hole_id FROM pairs);