-- Create a SECURITY DEFINER RPC to read the current student's profile survey data
-- without triggering recursive row-level security checks on student_profiles.

CREATE OR REPLACE FUNCTION public.get_student_profile_survey()
RETURNS TABLE (
  survey_name text,
  survey_confidence_coding int,
  survey_confidence_written_reports int,
  survey_confidence_presentation_public_speaking int,
  survey_confidence_mathematical_literacy int,
  survey_confidence_abstract_complex_content int,
  survey_confidence_conflict_resolution int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
BEGIN
  PERFORM set_config('row_security', 'off', true);

  RETURN QUERY
  SELECT
    survey_name,
    survey_confidence_coding,
    survey_confidence_written_reports,
    survey_confidence_presentation_public_speaking,
    survey_confidence_mathematical_literacy,
    survey_confidence_abstract_complex_content,
    survey_confidence_conflict_resolution
  FROM public.student_profiles
  WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_student_profile_survey() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_profile_survey() TO service_role;
