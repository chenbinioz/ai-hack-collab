-- Migration: Post-Project Skill Updates

-- 1. Create the state gate table
CREATE TABLE IF NOT EXISTS public.post_project_skill_updates (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id uuid REFERENCES auth.users(id) NOT NULL,
    class_id uuid REFERENCES public.classes(id) NOT NULL,
    survey_confidence_coding smallint NOT NULL,
    survey_confidence_written_reports smallint NOT NULL,
    survey_confidence_presentation_public_speaking smallint NOT NULL,
    survey_confidence_mathematical_literacy smallint NOT NULL,
    survey_confidence_abstract_complex_content smallint NOT NULL,
    survey_confidence_conflict_resolution smallint NOT NULL,
    submitted_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE(student_id, class_id)
);

-- Enable RLS
ALTER TABLE public.post_project_skill_updates ENABLE ROW LEVEL SECURITY;

-- Allow students to read their own submissions
CREATE POLICY select_own_post_project_skill_updates
    ON public.post_project_skill_updates
    FOR SELECT
    TO authenticated
    USING (auth.uid() = student_id);

-- Allow students to insert their own submissions
CREATE POLICY insert_own_post_project_skill_updates
    ON public.post_project_skill_updates
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = student_id);


-- 2. Modify the trigger to allow bypassing skill checks when app.allow_skill_update is true
CREATE OR REPLACE FUNCTION public.enforce_student_profile_survey_final()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  is_skill_update boolean;
BEGIN
  is_skill_update := current_setting('app.allow_skill_update', true) = 'true';

  if old.profile_survey_completed_at is not null then
    -- Check non-skill columns always
    if new.survey_name is distinct from old.survey_name
      or new.survey_degree_title is distinct from old.survey_degree_title
      or new.survey_year is distinct from old.survey_year
      or new.survey_alevel_or_equivalent_titles is distinct from old.survey_alevel_or_equivalent_titles
      or new.survey_ancillary_module is distinct from old.survey_ancillary_module
      or new.survey_approach_deadline is distinct from old.survey_approach_deadline
      or new.survey_approach_discussion is distinct from old.survey_approach_discussion
      or new.survey_approach_disagreement is distinct from old.survey_approach_disagreement
      or new.survey_approach_new_concepts is distinct from old.survey_approach_new_concepts
      or new.survey_approach_communication is distinct from old.survey_approach_communication
      or new.survey_approach_teammate_work is distinct from old.survey_approach_teammate_work
      or new.survey_approach_heavy_workload is distinct from old.survey_approach_heavy_workload
      or new.survey_approach_group_project_role is distinct from old.survey_approach_group_project_role
      or new.survey_approach_critical_feedback is distinct from old.survey_approach_critical_feedback
      or new.profile_survey_completed_at is distinct from old.profile_survey_completed_at
    then
      raise exception 'Student profile survey is final and cannot be changed (except skills via dedicated update).';
    end if;

    -- If it is not an authorized skill update, enforce skill checks too
    if not is_skill_update then
      if new.survey_confidence_coding is distinct from old.survey_confidence_coding
        or new.survey_confidence_written_reports is distinct from old.survey_confidence_written_reports
        or new.survey_confidence_presentation_public_speaking is distinct from old.survey_confidence_presentation_public_speaking
        or new.survey_confidence_mathematical_literacy is distinct from old.survey_confidence_mathematical_literacy
        or new.survey_confidence_abstract_complex_content is distinct from old.survey_confidence_abstract_complex_content
        or new.survey_confidence_conflict_resolution is distinct from old.survey_confidence_conflict_resolution
      then
        raise exception 'Student profile skills are locked and cannot be changed here.';
      end if;
    end if;
  end if;
  return new;
END;
$$;

ALTER FUNCTION public.enforce_student_profile_survey_final() OWNER TO postgres;


-- 3. Create the secure RPC function
-- Drop previous versions to avoid ambiguity errors due to overloading
DROP FUNCTION IF EXISTS public.rpc_submit_post_project_skill_update(uuid, smallint, smallint, smallint, smallint, smallint, smallint);
DROP FUNCTION IF EXISTS public.rpc_submit_post_project_skill_update(uuid, integer, integer, integer, integer, integer, integer);

CREATE OR REPLACE FUNCTION public.rpc_submit_post_project_skill_update(
    p_class_id uuid,
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
    v_user_id uuid;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('error', 'Not authenticated');
    END IF;

    -- 1. Check Deadline
    SELECT coursework_deadline INTO v_deadline
    FROM public.classes
    WHERE id = p_class_id;

    IF v_deadline IS NULL THEN
        RETURN jsonb_build_object('error', 'No coursework deadline is set for this class.');
    END IF;

    IF now() <= v_deadline THEN
        RETURN jsonb_build_object('error', 'The coursework deadline has not passed yet.');
    END IF;

    -- 2. State Gate Check
    IF EXISTS (
        SELECT 1 FROM public.post_project_skill_updates
        WHERE student_id = v_user_id AND class_id = p_class_id
    ) THEN
        RETURN jsonb_build_object('error', 'You have already submitted a post-project update for this class.');
    END IF;

    -- 3. Set custom variable to bypass trigger check for skill columns
    PERFORM set_config('app.allow_skill_update', 'true', true);

    -- 4. Update the core student profile
    UPDATE public.student_profiles
    SET
        survey_confidence_coding = p_survey_confidence_coding::smallint,
        survey_confidence_written_reports = p_survey_confidence_written_reports::smallint,
        survey_confidence_presentation_public_speaking = p_survey_confidence_presentation_public_speaking::smallint,
        survey_confidence_mathematical_literacy = p_survey_confidence_mathematical_literacy::smallint,
        survey_confidence_abstract_complex_content = p_survey_confidence_abstract_complex_content::smallint,
        survey_confidence_conflict_resolution = p_survey_confidence_conflict_resolution::smallint
    WHERE id = v_user_id;

    -- 5. Insert state gate record
    INSERT INTO public.post_project_skill_updates (
        student_id,
        class_id,
        survey_confidence_coding,
        survey_confidence_written_reports,
        survey_confidence_presentation_public_speaking,
        survey_confidence_mathematical_literacy,
        survey_confidence_abstract_complex_content,
        survey_confidence_conflict_resolution
    ) VALUES (
        v_user_id,
        p_class_id,
        p_survey_confidence_coding::smallint,
        p_survey_confidence_written_reports::smallint,
        p_survey_confidence_presentation_public_speaking::smallint,
        p_survey_confidence_mathematical_literacy::smallint,
        p_survey_confidence_abstract_complex_content::smallint,
        p_survey_confidence_conflict_resolution::smallint
    );

    RETURN jsonb_build_object('success', true);
EXCEPTION
    WHEN unique_violation THEN
        RETURN jsonb_build_object('error', 'You have already submitted a post-project update for this class.');
    WHEN OTHERS THEN
        RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_submit_post_project_skill_update(uuid, integer, integer, integer, integer, integer, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_submit_post_project_skill_update(uuid, integer, integer, integer, integer, integer, integer) TO authenticated;