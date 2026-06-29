-- ========================================================
-- 1. TEAM DRAFTS TABLE
-- ========================================================
CREATE TABLE IF NOT EXISTS public.team_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  name text,
  reason text,
  match_explanation jsonb,
  status text DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.team_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY "Educators can view team drafts for their classes" 
  ON public.team_drafts;
CREATE POLICY "Educators can view team drafts for their classes"
  ON public.team_drafts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.classes
      WHERE classes.id = team_drafts.class_id
      AND classes.educator_id = auth.uid()
    )
  );

DROP POLICY "Educators can insert team drafts for their classes"
  ON public.team_drafts;
CREATE POLICY "Educators can insert team drafts for their classes"
  ON public.team_drafts FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.classes
      WHERE classes.id = class_id -- Checks the incoming class_id field
      AND classes.educator_id = auth.uid()
    )
  );

DROP policy "Educators can update/delete team drafts for their classes"
  ON public.team_drafts;
CREATE POLICY "Educators can update/delete team drafts for their classes"
  ON public.team_drafts FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.classes
      WHERE classes.id = team_drafts.class_id
      AND classes.educator_id = auth.uid()
    )
  );

-- ========================================================
-- 2. TEAM DRAFT MEMBERS TABLE
-- ========================================================
CREATE TABLE IF NOT EXISTS public.team_draft_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_team_id uuid NOT NULL REFERENCES public.team_drafts(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.student_profiles(id) ON DELETE CASCADE,
  UNIQUE(draft_team_id, student_id)
);

ALTER TABLE public.team_draft_members ENABLE ROW LEVEL SECURITY;

DROP POLICY "Educators can view team draft members"
  ON public.team_draft_members;
CREATE POLICY "Educators can view team draft members"
  ON public.team_draft_members FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_drafts
      JOIN public.classes ON classes.id = team_drafts.class_id
      WHERE team_drafts.id = team_draft_members.draft_team_id
      AND classes.educator_id = auth.uid()
    )
  );

DROP policy "Educators can insert team draft members"
  ON public.team_draft_members;
CREATE POLICY "Educators can insert team draft members"
  ON public.team_draft_members FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.team_drafts
      JOIN public.classes ON classes.id = team_drafts.class_id
      WHERE team_drafts.id = draft_team_id -- Checks incoming draft_team_id
      AND classes.educator_id = auth.uid()
    )
  );

DROP POLICY "Educators can modify team draft members"
  ON public.team_draft_members;
CREATE POLICY "Educators can modify team draft members"
  ON public.team_draft_members FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_drafts
      JOIN public.classes ON classes.id = team_drafts.class_id
      WHERE team_drafts.id = team_draft_members.draft_team_id
      AND classes.educator_id = auth.uid()
    )
  );

-- ========================================================
-- 3. MANUAL INTERVENTION LOGS TABLE
-- ========================================================
CREATE TABLE IF NOT EXISTS public.manual_intervention_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.teacher_profiles(id) ON DELETE CASCADE, -- Double-check table name matches yours!
  student_id uuid NOT NULL REFERENCES public.student_profiles(id) ON DELETE CASCADE,
  from_team_id uuid, 
  to_team_id uuid NOT NULL,
  reason text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.manual_intervention_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY "Educators can view their own intervention logs" 
  ON public.manual_intervention_logs;
CREATE POLICY "Educators can view their own intervention logs"
  ON public.manual_intervention_logs FOR SELECT TO authenticated
  USING (teacher_id = auth.uid());

DROP POLICY "Educators can insert their own intervention logs"
  ON public.manual_intervention_logs;
CREATE POLICY "Educators can insert their own intervention logs"
  ON public.manual_intervention_logs FOR INSERT TO authenticated
  WITH CHECK (teacher_id = auth.uid());

-- ========================================================
-- 4. GRANTS (Fixes permission denied errors)
-- ========================================================
-- authenticated: for frontend Supabase client via RLS
GRANT ALL ON public.team_drafts TO authenticated;
GRANT ALL ON public.team_draft_members TO authenticated;
GRANT ALL ON public.manual_intervention_logs TO authenticated;

-- service_role: for Python backend (bypasses RLS but still needs table grants)
GRANT ALL ON public.team_drafts TO service_role;
GRANT ALL ON public.team_draft_members TO service_role;
GRANT ALL ON public.manual_intervention_logs TO service_role;