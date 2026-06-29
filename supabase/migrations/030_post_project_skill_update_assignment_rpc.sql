-- Update post-project skill update RPC to accept assignment_id (not class_id).
-- PostgREST matches RPC calls by parameter name; the client sends p_assignment_id.

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
