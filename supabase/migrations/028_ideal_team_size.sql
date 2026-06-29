-- Rename max_team_size to ideal_team_size on assignments (for DBs that applied 024 before the rename).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'assignments'
      AND column_name = 'max_team_size'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'assignments'
      AND column_name = 'ideal_team_size'
  ) THEN
    ALTER TABLE public.assignments RENAME COLUMN max_team_size TO ideal_team_size;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'assignments_max_team_size_check'
  ) THEN
    ALTER TABLE public.assignments
    RENAME CONSTRAINT assignments_max_team_size_check TO assignments_ideal_team_size_check;
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.list_student_assignments(uuid);

CREATE OR REPLACE FUNCTION public.list_student_assignments(p_class_id uuid)
RETURNS TABLE (
  assignment_id uuid,
  class_id uuid,
  title text,
  description text,
  due_date timestamptz,
  ideal_team_size integer,
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
    a.ideal_team_size,
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
