-- Fix infinite recursion in student_profiles SELECT policies.
-- The "Users can view teammates" policy queried student_profiles from within
-- its own RLS evaluation, breaking educator enrollment joins and other reads.

CREATE OR REPLACE FUNCTION public.auth_user_team_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT team_id
  FROM public.student_profiles
  WHERE id = auth.uid();
$$;

ALTER FUNCTION public.auth_user_team_id() OWNER TO postgres;

REVOKE ALL ON FUNCTION public.auth_user_team_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_user_team_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_user_team_id() TO service_role;

DROP POLICY IF EXISTS "Users can view teammates" ON public.student_profiles;

CREATE POLICY "Users can view teammates"
ON public.student_profiles
FOR SELECT
TO authenticated
USING (
  (
    team_id IS NOT NULL
    AND team_id = public.auth_user_team_id()
  )
  OR EXISTS (
    SELECT 1
    FROM public.team_members self_tm
    JOIN public.team_members other_tm
      ON self_tm.team_id = other_tm.team_id
     AND self_tm.assignment_id = other_tm.assignment_id
    WHERE self_tm.student_id = auth.uid()
      AND other_tm.student_id = student_profiles.id
  )
);
