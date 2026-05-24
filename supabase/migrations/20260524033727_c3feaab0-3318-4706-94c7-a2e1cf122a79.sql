DO $$
DECLARE
  v_admin_id uuid := '3a9d3130-4a24-4b6a-ba29-3fd79644688b';
BEGIN
  -- Chat / IA
  DELETE FROM public.ai_chat_messages;

  -- Notifications / messagerie
  DELETE FROM public.notifications;
  DELETE FROM public.messages;

  -- Emails
  DELETE FROM public.email_send_log;
  DELETE FROM public.email_send_state;
  DELETE FROM public.email_unsubscribe_tokens;
  DELETE FROM public.suppressed_emails;

  -- Demandes / signalements / feedbacks
  DELETE FROM public.modification_requests;
  DELETE FROM public.signalements;
  DELETE FROM public.feedbacks;

  -- Shifts et tout ce qui en dépend
  DELETE FROM public.shift_handoffs;
  DELETE FROM public.shift_proposals;
  DELETE FROM public.shift_reports;
  DELETE FROM public.shift_clock_audit;

  -- Checklists
  DELETE FROM public.checklist_submission_photos;
  DELETE FROM public.checklist_submission_items;
  DELETE FROM public.checklist_submissions;
  DELETE FROM public.checklist_template_photos;
  DELETE FROM public.checklist_template_items;
  DELETE FROM public.checklist_templates;

  -- Clôture
  DELETE FROM public.closure_question_responses;
  DELETE FROM public.closure_questions;

  -- Planning
  DELETE FROM public.planning_publications;
  DELETE FROM public.planning_runs;

  -- Dispos / indispos
  DELETE FROM public.availabilities;
  DELETE FROM public.unavailability_periods;

  -- Templates / exceptions / liens studios
  DELETE FROM public.staffing_templates;
  DELETE FROM public.studio_exceptions;
  DELETE FROM public.studio_business_roles;

  -- Shifts
  DELETE FROM public.shifts;

  -- Documents employés
  DELETE FROM public.employee_documents;

  -- Formations
  DELETE FROM public.training_quiz_answers;
  DELETE FROM public.training_quiz_attempts;
  DELETE FROM public.training_quiz_options;
  DELETE FROM public.training_quiz_questions;
  DELETE FROM public.training_quizzes;
  DELETE FROM public.training_content_progress;
  DELETE FROM public.training_course_completions;
  DELETE FROM public.training_contents;
  DELETE FROM public.training_sections;
  DELETE FROM public.training_modules;
  DELETE FROM public.training_courses;

  -- Invitations
  DELETE FROM public.invitations;

  -- Détacher TOUS les profils + user_studios de tout studio
  UPDATE public.profiles SET studio_id = NULL;
  DELETE FROM public.user_studios;

  -- Maintenant on peut supprimer les studios
  DELETE FROM public.studios;

  -- Supprimer tous les utilisateurs auth sauf QA admin (cascades nettoient le reste)
  DELETE FROM auth.users WHERE id <> v_admin_id;

  -- Nettoyage final QA admin
  UPDATE public.profiles
    SET studio_id = NULL,
        contract = NULL,
        score = NULL
  WHERE id = v_admin_id;

  DELETE FROM public.user_contracts      WHERE user_id = v_admin_id;
  DELETE FROM public.user_business_roles WHERE user_id = v_admin_id;

  -- Purge files emails
  BEGIN PERFORM pgmq.purge_queue('email_queue'); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM pgmq.purge_queue('email_dlq');   EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;