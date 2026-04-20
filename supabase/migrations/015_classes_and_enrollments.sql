-- Classes and class enrollment system
-- Run in Supabase SQL Editor after existing migrations

-- 1. Classes table
CREATE TABLE IF NOT EXISTS public.classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  educator_id uuid NOT NULL REFERENCES public.teacher_profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  description text,
  max_team_size integer DEFAULT 3 CHECK (max_team_size >= 2 AND max_team_size <= 10),
  ai_preferences jsonb DEFAULT '{
    "focus_skills": true,
    "focus_working_style": true,
    "focus_availability": true,
    "focus_goals": true,
    "balance_diversity": true
  }'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Class enrollments junction table
CREATE TABLE IF NOT EXISTS public.class_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.student_profiles(id) ON DELETE CASCADE,
  enrolled_at timestamptz DEFAULT now(),
  role text DEFAULT 'student' CHECK (role IN ('student', 'ta')),
  UNIQUE(class_id, student_id)
);

-- 3. Add class_id to teams table
ALTER TABLE public.teams
ADD COLUMN IF NOT EXISTS class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE;

-- 4. Enable RLS
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_enrollments ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for classes
-- Educators can see their own classes
DROP POLICY IF EXISTS "Educators can view their own classes" ON public.classes;
CREATE POLICY "Educators can view their own classes"
  ON public.classes FOR SELECT TO authenticated
  USING (educator_id = auth.uid());

-- NOTE:
-- Do not add a student SELECT policy on public.classes that references
-- public.class_enrollments directly; together with class_enrollments policies
-- that reference classes, this can create recursive RLS evaluation.
-- Student class listing is handled via SECURITY DEFINER RPC:
-- public.list_student_classes().

-- Educators can create classes
DROP POLICY IF EXISTS "Educators can create classes" ON public.classes;
CREATE POLICY "Educators can create classes"
  ON public.classes FOR INSERT TO authenticated
  WITH CHECK (educator_id = auth.uid());

-- Educators can update their own classes
DROP POLICY IF EXISTS "Educators can update their own classes" ON public.classes;
CREATE POLICY "Educators can update their own classes"
  ON public.classes FOR UPDATE TO authenticated
  USING (educator_id = auth.uid())
  WITH CHECK (educator_id = auth.uid());

-- Educators can delete their own classes
DROP POLICY IF EXISTS "Educators can delete their own classes" ON public.classes;
CREATE POLICY "Educators can delete their own classes"
  ON public.classes FOR DELETE TO authenticated
  USING (educator_id = auth.uid());

-- 6. RLS Policies for class_enrollments
-- Educators can view enrollments for their classes
DROP POLICY IF EXISTS "Educators can view enrollments for their classes" ON public.class_enrollments;
CREATE POLICY "Educators can view enrollments for their classes"
  ON public.class_enrollments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.classes
      WHERE classes.id = class_enrollments.class_id
      AND classes.educator_id = auth.uid()
    )
  );

-- Educators can manage enrollments for their classes
DROP POLICY IF EXISTS "Educators can manage enrollments for their classes" ON public.class_enrollments;
CREATE POLICY "Educators can manage enrollments for their classes"
  ON public.class_enrollments FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.classes
      WHERE classes.id = class_enrollments.class_id
      AND classes.educator_id = auth.uid()
    )
  );

-- Students can view their own enrollments
DROP POLICY IF EXISTS "Students can view their own enrollments" ON public.class_enrollments;
CREATE POLICY "Students can view their own enrollments"
  ON public.class_enrollments FOR SELECT TO authenticated
  USING (student_id = auth.uid());

-- Students can enroll themselves
DROP POLICY IF EXISTS "Students can enroll themselves" ON public.class_enrollments;
CREATE POLICY "Students can enroll themselves"
  ON public.class_enrollments FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid());

-- 7. RLS Policies for teams (updated to scope by class)
-- Users can view teams from classes they're enrolled in
DROP POLICY IF EXISTS "Users can view teams from enrolled classes" ON public.teams;
CREATE POLICY "Users can view teams from enrolled classes"
  ON public.teams FOR SELECT TO authenticated
  USING (
    class_id IN (
      SELECT class_id FROM public.class_enrollments
      WHERE student_id = auth.uid()
    ) OR
    class_id IN (
      SELECT id FROM public.classes
      WHERE educator_id = auth.uid()
    )
  );

-- Educators can create teams for their classes
DROP POLICY IF EXISTS "Educators can create teams for their classes" ON public.teams;
CREATE POLICY "Educators can create teams for their classes"
  ON public.teams FOR INSERT TO authenticated
  WITH CHECK (
    class_id IN (
      SELECT id FROM public.classes
      WHERE educator_id = auth.uid()
    )
  );

-- 8. Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_enrollments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;

-- 9. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_classes_educator_id ON public.classes(educator_id);
CREATE INDEX IF NOT EXISTS idx_classes_code ON public.classes(code);
CREATE INDEX IF NOT EXISTS idx_class_enrollments_class_id ON public.class_enrollments(class_id);
CREATE INDEX IF NOT EXISTS idx_class_enrollments_student_id ON public.class_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_teams_class_id ON public.teams(class_id);

-- 10. Function to generate unique class codes
CREATE OR REPLACE FUNCTION generate_class_code()
RETURNS text AS $$
DECLARE
  new_code text;
BEGIN
  LOOP
    -- Generate a 6-character alphanumeric code
    new_code := upper(substring(md5(random()::text) from 1 for 6));
    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.classes
      WHERE code = new_code
    );
  END LOOP;
  RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- 11. RPC function for students to join classes by code
DROP FUNCTION IF EXISTS public.join_class_by_code(text);
DROP FUNCTION IF EXISTS public.join_class_by_code(varchar);

CREATE FUNCTION public.join_class_by_code(p_code text)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
WITH me AS (
  SELECT auth.uid() AS student_id
),
target_class AS (
  SELECT c.id AS class_id
  FROM public.classes c
  WHERE c.code = upper(p_code)
  LIMIT 1
),
already_enrolled AS (
  SELECT 1 AS found
  FROM public.class_enrollments ce
  JOIN me m ON ce.student_id = m.student_id
  JOIN target_class tc ON ce.class_id = tc.class_id
  LIMIT 1
),
inserted AS (
  INSERT INTO public.class_enrollments (class_id, student_id)
  SELECT tc.class_id, m.student_id
  FROM target_class tc
  CROSS JOIN me m
  WHERE m.student_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM already_enrolled)
  ON CONFLICT (class_id, student_id) DO NOTHING
  RETURNING class_id
)
SELECT CASE
  WHEN (SELECT student_id FROM me) IS NULL THEN
    jsonb_build_object('success', false, 'error', 'Not authenticated')
  WHEN NOT EXISTS (SELECT 1 FROM target_class) THEN
    jsonb_build_object('success', false, 'error', 'Invalid class code')
  WHEN EXISTS (SELECT 1 FROM already_enrolled) THEN
    jsonb_build_object('success', false, 'error', 'Already enrolled in this class')
  WHEN EXISTS (SELECT 1 FROM inserted) THEN
    jsonb_build_object('success', true, 'class_id', (SELECT class_id FROM inserted LIMIT 1))
  ELSE
    jsonb_build_object('success', false, 'error', 'Unable to join class')
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_class_by_code(text) TO authenticated;