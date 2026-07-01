INSERT INTO public.manager_permissions (user_id, permissions)
VALUES ('b6406d90-fd47-4b25-bf64-8d42794132a6', ARRAY[
  '/planning','/dispos-monitoring','/staff','/trous',
  '/notifications','/demandes','/signalements',
  '/pointage','/cloture','/feedbacks','/formation','/assistant-ia',
  '/planning:write','/planning:generate','/planning:publish',
  '/dispos-monitoring:send_reminders',
  '/staff:write','/staff:invite','/staff:deactivate',
  '/trous:assign','/trous:send_proposals',
  '/notifications:manage',
  '/demandes:accept_refuse',
  '/signalements:resolve',
  '/pointage:edit',
  '/cloture:read_responses','/cloture:review_photos',
  '/cloture:edit_questions','/cloture:edit_checklists','/cloture:edit_scoring',
  '/feedbacks:reply',
  '/formation:edit_content','/formation:qualify_employee',
  '/assistant-ia:add_knowledge'
])
ON CONFLICT (user_id) DO UPDATE SET permissions = EXCLUDED.permissions, updated_at = now();