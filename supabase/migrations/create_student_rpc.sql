
-- Create RPC function for students to get their own profile
CREATE OR REPLACE FUNCTION public.get_student_own_profile()
RETURNS TABLE (
  student_id uuid,
  survey_name text,
  team_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT
    sp.id,
    sp.survey_name,
    sp.team_id
  FROM public.student_profiles sp
  WHERE sp.id = auth.uid()
  AND sp.profile_survey_completed_at IS NOT NULL;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_student_own_profile() TO authenticated;

