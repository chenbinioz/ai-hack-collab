-- Create a feedback table for student instant sentiment after team assignment.
CREATE TABLE IF NOT EXISTS public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.student_profiles(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  skill_match smallint NOT NULL CHECK (skill_match BETWEEN 1 AND 5),
  style_match smallint NOT NULL CHECK (style_match BETWEEN 1 AND 5),
  overall_satisfaction smallint NOT NULL CHECK (overall_satisfaction BETWEEN 1 AND 5),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feedback TO supabase_auth_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feedback TO service_role;
GRANT INSERT ON public.feedback TO authenticated;
GRANT SELECT ON public.feedback TO authenticated;

CREATE POLICY "Students can submit their own feedback"
  ON public.feedback FOR INSERT
  TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    AND team_id = (
      SELECT team_id
      FROM public.student_profiles
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Students can read their own feedback"
  ON public.feedback FOR SELECT
  TO authenticated
  USING (
    student_id = auth.uid()
  );

CREATE POLICY "Educators can read all feedback"
  ON public.feedback FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.teacher_profiles tp
      WHERE tp.id = auth.uid()
    )
  );
