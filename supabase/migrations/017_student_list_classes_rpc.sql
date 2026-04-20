-- Provides a stable, RLS-safe way for students to list classes they joined.
-- Uses auth.uid() inside SECURITY DEFINER function to scope results to caller.

-- Required because PostgreSQL cannot change OUT parameter row types via
-- CREATE OR REPLACE FUNCTION when the return table shape changes.
DROP FUNCTION IF EXISTS public.list_student_classes();

CREATE OR REPLACE FUNCTION public.list_student_classes()
RETURNS TABLE (
  class_id uuid,
  enrolled_at timestamptz,
  role text,
  name text,
  description text,
  code text,
  coursework_deadline timestamptz,
  max_team_size integer,
  ai_preferences jsonb
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
    c.code,
    c.coursework_deadline,
    c.max_team_size,
    c.ai_preferences
  FROM public.class_enrollments ce
  JOIN public.classes c ON c.id = ce.class_id
  WHERE ce.student_id = auth.uid()
  ORDER BY ce.enrolled_at DESC;
$$;

REVOKE ALL ON FUNCTION public.list_student_classes() FROM public;
GRANT EXECUTE ON FUNCTION public.list_student_classes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_student_classes() TO service_role;
