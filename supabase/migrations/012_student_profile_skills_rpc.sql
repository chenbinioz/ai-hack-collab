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
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
STABLE
AS $$
  SELECT
    sp.survey_name::text,
    sp.survey_confidence_coding::int,
    sp.survey_confidence_written_reports::int,
    sp.survey_confidence_presentation_public_speaking::int,
    sp.survey_confidence_mathematical_literacy::int,
    sp.survey_confidence_abstract_complex_content::int,
    sp.survey_confidence_conflict_resolution::int
  FROM public.student_profiles sp
  WHERE sp.id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_student_profile_survey() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_profile_survey() TO service_role;
