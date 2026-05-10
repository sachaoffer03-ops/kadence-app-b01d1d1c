-- Enums
CREATE TYPE public.modification_type AS ENUM ('swap', 'cancel', 'time_change', 'unavailable');
CREATE TYPE public.modification_status AS ENUM ('pending', 'accepted', 'refused');
CREATE TYPE public.modification_urgency AS ENUM ('normal', 'urgent', 'critique');
CREATE TYPE public.signalement_category AS ENUM ('stock', 'materiel', 'hygiene', 'autre');

-- Add clock-in/out tracking to shifts
ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS clocked_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS clocked_out_at timestamptz;

-- ════════════════════════════════════════
-- shift_handoffs
-- ════════════════════════════════════════
CREATE TABLE public.shift_handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_handoffs_shift ON public.shift_handoffs(shift_id);
ALTER TABLE public.shift_handoffs ENABLE ROW LEVEL SECURITY;

-- Function: can the user see this handoff (next shift on same studio/role within 7 days)
CREATE OR REPLACE FUNCTION public.can_see_handoff(_user_id uuid, _from_shift_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.shifts s_from
    JOIN public.shifts s_to
      ON s_to.studio_id = s_from.studio_id
     AND s_to.business_role = s_from.business_role
     AND s_to.user_id = _user_id
     AND (s_to.shift_date > s_from.shift_date
          OR (s_to.shift_date = s_from.shift_date AND s_to.start_time >= s_from.end_time))
     AND s_to.shift_date <= s_from.shift_date + INTERVAL '7 days'
    WHERE s_from.id = _from_shift_id
  );
$$;

CREATE POLICY "Auteurs voient leurs handoffs"
  ON public.shift_handoffs FOR SELECT TO authenticated
  USING (auth.uid() = author_id);
CREATE POLICY "Prochain employé voit le handoff"
  ON public.shift_handoffs FOR SELECT TO authenticated
  USING (public.can_see_handoff(auth.uid(), shift_id));
CREATE POLICY "Admins voient tous les handoffs"
  ON public.shift_handoffs FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));
CREATE POLICY "Auteur du shift crée des handoffs"
  ON public.shift_handoffs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id
    AND EXISTS (SELECT 1 FROM public.shifts WHERE id = shift_id AND user_id = auth.uid()));
CREATE POLICY "Auteur supprime ses handoffs"
  ON public.shift_handoffs FOR DELETE TO authenticated
  USING (auth.uid() = author_id);

-- ════════════════════════════════════════
-- shift_reports (employee → admin)
-- ════════════════════════════════════════
CREATE TABLE public.shift_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid REFERENCES public.shifts(id) ON DELETE SET NULL,
  author_id uuid NOT NULL,
  message text NOT NULL,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.shift_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auteur voit ses reports"
  ON public.shift_reports FOR SELECT TO authenticated
  USING (auth.uid() = author_id);
CREATE POLICY "Admins voient tous les reports"
  ON public.shift_reports FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));
CREATE POLICY "Auteur crée un report"
  ON public.shift_reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Admins mettent à jour les reports"
  ON public.shift_reports FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- ════════════════════════════════════════
-- modification_requests
-- ════════════════════════════════════════
CREATE TABLE public.modification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  shift_id uuid REFERENCES public.shifts(id) ON DELETE CASCADE,
  type public.modification_type NOT NULL,
  urgency public.modification_urgency NOT NULL DEFAULT 'normal',
  reason text NOT NULL,
  status public.modification_status NOT NULL DEFAULT 'pending',
  admin_response text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
ALTER TABLE public.modification_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Employé voit ses demandes"
  ON public.modification_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Admins voient toutes les demandes"
  ON public.modification_requests FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));
CREATE POLICY "Employé crée ses demandes"
  ON public.modification_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Employé annule sa demande pending"
  ON public.modification_requests FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND status = 'pending');
CREATE POLICY "Admins répondent aux demandes"
  ON public.modification_requests FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- ════════════════════════════════════════
-- signalements
-- ════════════════════════════════════════
CREATE TABLE public.signalements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL,
  studio_id uuid REFERENCES public.studios(id),
  category public.signalement_category NOT NULL,
  message text NOT NULL,
  resolved boolean NOT NULL DEFAULT false,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.signalements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tout le monde voit les signalements"
  ON public.signalements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Employés créent des signalements"
  ON public.signalements FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Auteur supprime son signalement"
  ON public.signalements FOR DELETE TO authenticated
  USING (auth.uid() = author_id AND NOT resolved);
CREATE POLICY "Admins résolvent les signalements"
  ON public.signalements FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- ════════════════════════════════════════
-- feedbacks
-- ════════════════════════════════════════
CREATE TABLE public.feedbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid REFERENCES public.shifts(id) ON DELETE SET NULL,
  author_id uuid NOT NULL,
  rating int NOT NULL CHECK (rating >= 1 AND rating <= 5),
  message text,
  admin_reply text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auteur voit ses feedbacks"
  ON public.feedbacks FOR SELECT TO authenticated
  USING (auth.uid() = author_id);
CREATE POLICY "Admins voient tous les feedbacks"
  ON public.feedbacks FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));
CREATE POLICY "Auteur crée son feedback"
  ON public.feedbacks FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Admins répondent aux feedbacks"
  ON public.feedbacks FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- ════════════════════════════════════════
-- shift_checklist_items
-- ════════════════════════════════════════
CREATE TABLE public.shift_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  position int NOT NULL,
  label text NOT NULL,
  checked_at timestamptz,
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_checklist_shift ON public.shift_checklist_items(shift_id);
ALTER TABLE public.shift_checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Employé voit sa checklist"
  ON public.shift_checklist_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shifts WHERE id = shift_id AND user_id = auth.uid()));
CREATE POLICY "Admins voient toutes les checklists"
  ON public.shift_checklist_items FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));
CREATE POLICY "Employé gère sa checklist"
  ON public.shift_checklist_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shifts WHERE id = shift_id AND user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.shifts WHERE id = shift_id AND user_id = auth.uid()));
CREATE POLICY "Admins gèrent toutes les checklists"
  ON public.shift_checklist_items FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- ════════════════════════════════════════
-- formations
-- ════════════════════════════════════════
CREATE TABLE public.formations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  video_url text,
  duration_min int,
  required_role public.business_role,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.formations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tout le monde voit les formations"
  ON public.formations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins gèrent les formations"
  ON public.formations FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE TABLE public.formation_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formation_id uuid NOT NULL REFERENCES public.formations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(formation_id, user_id)
);
ALTER TABLE public.formation_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Employé voit ses complétions"
  ON public.formation_completions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Admins voient toutes les complétions"
  ON public.formation_completions FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));
CREATE POLICY "Employé valide sa formation"
  ON public.formation_completions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ════════════════════════════════════════
-- Realtime
-- ════════════════════════════════════════
ALTER PUBLICATION supabase_realtime ADD TABLE public.shift_handoffs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shift_reports;
ALTER PUBLICATION supabase_realtime ADD TABLE public.modification_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.signalements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.feedbacks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shift_checklist_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.formation_completions;