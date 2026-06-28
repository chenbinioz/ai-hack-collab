-- Class assignments: per-class work units with their own deadlines, team settings, and teams.
-- Compatible with existing public.assignments table (extends rather than recreates).

-- 1. Extend existing assignments table
ALTER TABLE public.assignments
ADD COLUMN IF NOT EXISTS max_team_size integer DEFAULT 3;

ALTER TABLE public.assignments
ADD COLUMN IF NOT EXISTS ai_preferences jsonb DEFAULT '{
  "focus_skills": true,
  "focus_working_style": true,
  "focus_availability": true,
  "balance_diversity": true
}'::jsonb;

ALTER TABLE public.assignments
ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'assignments_max_team_size_check'
  ) THEN
    ALTER TABLE public.assignments
    ADD CONSTRAINT assignments_max_team_size_check
    CHECK (max_team_size >= 2 AND max_team_size <= 10);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_assignments_class_id ON public.assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_assignments_due_date ON public.assignments(due_date);

-- 2. Add assignment_id to teams (nullable during backfill)
ALTER TABLE public.teams
ADD COLUMN IF NOT EXISTS assignment_id uuid REFERENCES public.assignments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_teams_assignment_id ON public.teams(assignment_id);

-- 3. Team members junction
CREATE TABLE IF NOT EXISTS public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.student_profiles(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(student_id, assignment_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON public.team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_student_id ON public.team_members(student_id);
CREATE INDEX IF NOT EXISTS idx_team_members_assignment_id ON public.team_members(assignment_id);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view team members in their classes" ON public.team_members;
CREATE POLICY "Users can view team members in their classes"
  ON public.team_members FOR SELECT TO authenticated
  USING (
    assignment_id IN (
      SELECT a.id FROM public.assignments a
      JOIN public.class_enrollments ce ON ce.class_id = a.class_id
      WHERE ce.student_id = auth.uid()
    )
    OR assignment_id IN (
      SELECT a.id FROM public.assignments a
      JOIN public.classes c ON c.id = a.class_id
      WHERE c.educator_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Educators can manage team members for their classes" ON public.team_members;
CREATE POLICY "Educators can manage team members for their classes"
  ON public.team_members FOR ALL TO authenticated
  USING (
    assignment_id IN (
      SELECT a.id FROM public.assignments a
      JOIN public.classes c ON c.id = a.class_id
      WHERE c.educator_id = auth.uid()
    )
  )
  WITH CHECK (
    assignment_id IN (
      SELECT a.id FROM public.assignments a
      JOIN public.classes c ON c.id = a.class_id
      WHERE c.educator_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO authenticated;

-- 4. Add assignment_id to feedback
ALTER TABLE public.feedback
ADD COLUMN IF NOT EXISTS assignment_id uuid REFERENCES public.assignments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_feedback_assignment_id ON public.feedback(assignment_id);

-- 5. Add assignment_id to post_project_skill_updates
ALTER TABLE public.post_project_skill_updates
ADD COLUMN IF NOT EXISTS assignment_id uuid REFERENCES public.assignments(id) ON DELETE CASCADE;

-- 6. Backfill assignment settings from classes
UPDATE public.assignments a
SET
  max_team_size = COALESCE(a.max_team_size, c.max_team_size, 3),
  ai_preferences = COALESCE(
    a.ai_preferences,
    c.ai_preferences,
    '{
      "focus_skills": true,
      "focus_working_style": true,
      "focus_availability": true,
      "balance_diversity": true
    }'::jsonb
  ),
  due_date = COALESCE(a.due_date, c.coursework_deadline)
FROM public.classes c
WHERE a.class_id = c.id;

-- Create default assignment for classes without one
INSERT INTO public.assignments (
  class_id, title, description, due_date, max_team_size, ai_preferences, sort_order, created_by
)
SELECT
  c.id,
  'Project 1',
  COALESCE(c.description, ''),
  c.coursework_deadline,
  COALESCE(c.max_team_size, 3),
  COALESCE(c.ai_preferences, '{
    "focus_skills": true,
    "focus_working_style": true,
    "focus_availability": true,
    "balance_diversity": true
  }'::jsonb),
  0,
  c.educator_id
FROM public.classes c
WHERE NOT EXISTS (
  SELECT 1 FROM public.assignments a WHERE a.class_id = c.id
);

UPDATE public.teams t
SET assignment_id = a.id
FROM public.assignments a
WHERE t.class_id = a.class_id
  AND t.assignment_id IS NULL
  AND a.id = (
    SELECT a2.id FROM public.assignments a2
    WHERE a2.class_id = t.class_id
    ORDER BY a2.sort_order ASC, a2.created_at ASC
    LIMIT 1
  );

INSERT INTO public.team_members (student_id, team_id, assignment_id)
SELECT sp.id, sp.team_id, t.assignment_id
FROM public.student_profiles sp
JOIN public.teams t ON t.id = sp.team_id
WHERE sp.team_id IS NOT NULL
  AND t.assignment_id IS NOT NULL
ON CONFLICT (student_id, assignment_id) DO NOTHING;

UPDATE public.feedback f
SET assignment_id = t.assignment_id
FROM public.teams t
WHERE f.team_id = t.id
  AND f.assignment_id IS NULL
  AND t.assignment_id IS NOT NULL;

UPDATE public.post_project_skill_updates p
SET assignment_id = a.id
FROM public.assignments a
WHERE p.class_id = a.class_id
  AND p.assignment_id IS NULL
  AND a.id = (
    SELECT a2.id FROM public.assignments a2
    WHERE a2.class_id = p.class_id
    ORDER BY a2.sort_order ASC, a2.created_at ASC
    LIMIT 1
  );

-- 7. Update feedback trigger to set assignment_id from team
CREATE OR REPLACE FUNCTION public.feedback_set_class_id_from_team()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.team_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT t.class_id, t.assignment_id
  INTO NEW.class_id, NEW.assignment_id
  FROM public.teams AS t
  WHERE t.id = NEW.team_id;

  RETURN NEW;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_feedback_student_assignment
ON public.feedback(student_id, assignment_id)
WHERE assignment_id IS NOT NULL;

ALTER TABLE public.post_project_skill_updates
DROP CONSTRAINT IF EXISTS post_project_skill_updates_student_id_class_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_post_project_skill_updates_student_assignment
ON public.post_project_skill_updates(student_id, assignment_id)
WHERE assignment_id IS NOT NULL;

-- 8. Update feedback insert policy to use team_members
DROP POLICY IF EXISTS "Students can submit their own feedback" ON public.feedback;
CREATE POLICY "Students can submit their own feedback"
  ON public.feedback FOR INSERT
  TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    AND (
      team_id IN (
        SELECT tm.team_id FROM public.team_members tm
        WHERE tm.student_id = auth.uid()
      )
      OR team_id = (
        SELECT team_id FROM public.student_profiles WHERE id = auth.uid()
      )
    )
  );

-- 9. Update get_my_teammates to support assignment scoping
DROP FUNCTION IF EXISTS public.get_my_teammates();
DROP FUNCTION IF EXISTS public.get_my_teammates(uuid);

CREATE OR REPLACE FUNCTION public.get_my_teammates(p_assignment_id uuid DEFAULT NULL)
RETURNS TABLE (id uuid, survey_name text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH my_team AS (
    SELECT tm.team_id
    FROM public.team_members tm
    WHERE tm.student_id = auth.uid()
      AND (p_assignment_id IS NULL OR tm.assignment_id = p_assignment_id)
    LIMIT 1
  ),
  fallback_team AS (
    SELECT sp.team_id
    FROM public.student_profiles sp
    WHERE sp.id = auth.uid() AND p_assignment_id IS NULL
  ),
  resolved AS (
    SELECT COALESCE((SELECT team_id FROM my_team), (SELECT team_id FROM fallback_team)) AS team_id
  )
  SELECT sp.id, sp.survey_name
  FROM public.student_profiles sp, resolved r
  WHERE sp.team_id = r.team_id
    AND r.team_id IS NOT NULL
    AND sp.id != auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_my_teammates(uuid) TO authenticated;

-- 10. Student assignment list RPC
DROP FUNCTION IF EXISTS public.list_student_assignments(uuid);

CREATE OR REPLACE FUNCTION public.list_student_assignments(p_class_id uuid)
RETURNS TABLE (
  assignment_id uuid,
  class_id uuid,
  title text,
  description text,
  due_date timestamptz,
  max_team_size integer,
  ai_preferences jsonb,
  sort_order integer,
  team_id uuid
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.id AS assignment_id,
    a.class_id,
    a.title,
    a.description,
    a.due_date,
    a.max_team_size,
    a.ai_preferences,
    a.sort_order,
    tm.team_id
  FROM public.assignments a
  JOIN public.class_enrollments ce ON ce.class_id = a.class_id
  LEFT JOIN public.team_members tm
    ON tm.assignment_id = a.id AND tm.student_id = auth.uid()
  WHERE ce.student_id = auth.uid()
    AND a.class_id = p_class_id
  ORDER BY a.sort_order ASC, a.created_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.list_student_assignments(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_student_assignments(uuid) TO service_role;

-- 11. Slim list_student_classes
DROP FUNCTION IF EXISTS public.list_student_classes();

CREATE OR REPLACE FUNCTION public.list_student_classes()
RETURNS TABLE (
  class_id uuid,
  enrolled_at timestamptz,
  role text,
  name text,
  description text,
  code text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id AS class_id,
    ce.enrolled_at,
    ce.role,
    c.name,
    c.description,
    c.code
  FROM public.class_enrollments ce
  JOIN public.classes c ON c.id = ce.class_id
  WHERE ce.student_id = auth.uid()
  ORDER BY ce.enrolled_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.list_student_classes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_student_classes() TO service_role;

-- 12. Update post-project RPC to use assignment_id
DROP FUNCTION IF EXISTS public.rpc_submit_post_project_skill_update(uuid, integer, integer, integer, integer, integer, integer);

CREATE OR REPLACE FUNCTION public.rpc_submit_post_project_skill_update(
    p_assignment_id uuid,
    p_survey_confidence_coding integer,
    p_survey_confidence_written_reports integer,
    p_survey_confidence_presentation_public_speaking integer,
    p_survey_confidence_mathematical_literacy integer,
    p_survey_confidence_abstract_complex_content integer,
    p_survey_confidence_conflict_resolution integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_deadline timestamptz;
    v_class_id uuid;
    v_user_id uuid;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('error', 'Not authenticated');
    END IF;

    SELECT a.due_date, a.class_id INTO v_deadline, v_class_id
    FROM public.assignments a
    WHERE a.id = p_assignment_id;

    IF v_class_id IS NULL THEN
        RETURN jsonb_build_object('error', 'Assignment not found.');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.class_enrollments ce
        WHERE ce.class_id = v_class_id AND ce.student_id = v_user_id
    ) THEN
        RETURN jsonb_build_object('error', 'Not enrolled in this class.');
    END IF;

    IF v_deadline IS NULL THEN
        RETURN jsonb_build_object('error', 'No due date is set for this assignment.');
    END IF;

    IF now() <= v_deadline THEN
        RETURN jsonb_build_object('error', 'The assignment due date has not passed yet.');
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.post_project_skill_updates
        WHERE student_id = v_user_id AND assignment_id = p_assignment_id
    ) THEN
        RETURN jsonb_build_object('error', 'You have already submitted a post-project update for this assignment.');
    END IF;

    PERFORM set_config('app.allow_skill_update', 'true', true);

    UPDATE public.student_profiles
    SET
        survey_confidence_coding = p_survey_confidence_coding::smallint,
        survey_confidence_written_reports = p_survey_confidence_written_reports::smallint,
        survey_confidence_presentation_public_speaking = p_survey_confidence_presentation_public_speaking::smallint,
        survey_confidence_mathematical_literacy = p_survey_confidence_mathematical_literacy::smallint,
        survey_confidence_abstract_complex_content = p_survey_confidence_abstract_complex_content::smallint,
        survey_confidence_conflict_resolution = p_survey_confidence_conflict_resolution::smallint
    WHERE id = v_user_id;

    INSERT INTO public.post_project_skill_updates (
        student_id, class_id, assignment_id,
        survey_confidence_coding, survey_confidence_written_reports,
        survey_confidence_presentation_public_speaking, survey_confidence_mathematical_literacy,
        survey_confidence_abstract_complex_content, survey_confidence_conflict_resolution
    ) VALUES (
        v_user_id, v_class_id, p_assignment_id,
        p_survey_confidence_coding::smallint, p_survey_confidence_written_reports::smallint,
        p_survey_confidence_presentation_public_speaking::smallint, p_survey_confidence_mathematical_literacy::smallint,
        p_survey_confidence_abstract_complex_content::smallint, p_survey_confidence_conflict_resolution::smallint
    );

    RETURN jsonb_build_object('success', true);
EXCEPTION
    WHEN unique_violation THEN
        RETURN jsonb_build_object('error', 'You have already submitted a post-project update for this assignment.');
    WHEN OTHERS THEN
        RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_submit_post_project_skill_update(uuid, integer, integer, integer, integer, integer, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_submit_post_project_skill_update(uuid, integer, integer, integer, integer, integer, integer) TO authenticated;

-- 13. Update messages RLS to check team_members
DROP POLICY IF EXISTS "Users can view messages from their team" ON public.messages;
DROP POLICY IF EXISTS "Users can read messages from their team" ON public.messages;
CREATE POLICY "Users can view messages from their team"
  ON public.messages FOR SELECT TO authenticated
  USING (
    team_id IN (SELECT tm.team_id FROM public.team_members tm WHERE tm.student_id = auth.uid())
    OR team_id IN (SELECT sp.team_id FROM public.student_profiles sp WHERE sp.id = auth.uid() AND sp.team_id IS NOT NULL)
  );

DROP POLICY IF EXISTS "Users can send messages to their team" ON public.messages;
CREATE POLICY "Users can send messages to their team"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      team_id IN (SELECT tm.team_id FROM public.team_members tm WHERE tm.student_id = auth.uid())
      OR team_id IN (SELECT sp.team_id FROM public.student_profiles sp WHERE sp.id = auth.uid() AND sp.team_id IS NOT NULL)
    )
  );

-- 14. Drop class-level fields moved to assignments
ALTER TABLE public.classes DROP COLUMN IF EXISTS coursework_deadline;
ALTER TABLE public.classes DROP COLUMN IF EXISTS max_team_size;
ALTER TABLE public.classes DROP COLUMN IF EXISTS ai_preferences;

DROP INDEX IF EXISTS idx_classes_coursework_deadline;
