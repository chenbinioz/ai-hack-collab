-- External student ID (P + 8 digits) on profile survey
-- Run after 023. Safe to run multiple times.

ALTER TABLE public.student_profiles
  ADD COLUMN IF NOT EXISTS survey_external_student_id text;

COMMENT ON COLUMN public.student_profiles.survey_external_student_id IS
  'Normalized external person ID (P + 8 digits); join key for class external learning data.';

-- Lock external student ID after survey completion
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
    if new.survey_name is distinct from old.survey_name
      or new.survey_degree_title is distinct from old.survey_degree_title
      or new.survey_year is distinct from old.survey_year
      or new.survey_alevel_or_equivalent_titles is distinct from old.survey_alevel_or_equivalent_titles
      or new.survey_ancillary_module is distinct from old.survey_ancillary_module
      or new.survey_external_student_id is distinct from old.survey_external_student_id
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

-- Submit RPC: require and normalize external student ID
CREATE OR REPLACE FUNCTION public.submit_student_profile_survey(p_payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid;
  v_completed timestamptz;
  v_year smallint;
  v_row_count int;
  v_external_raw text;
  v_external_id text;
BEGIN
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_payload is null or p_payload = 'null'::jsonb then
    raise exception 'Payload required';
  end if;

  perform set_config('row_security', 'off', true);

  select sp.profile_survey_completed_at
  into v_completed
  from public.student_profiles sp
  where sp.id = v_uid;

  if not found then
    raise exception 'Student profile not found';
  end if;

  if v_completed is not null then
    raise exception 'Student profile survey is final and cannot be changed.';
  end if;

  if coalesce(trim(p_payload->>'survey_name'), '') = '' then
    raise exception 'survey_name required';
  end if;
  if coalesce(trim(p_payload->>'survey_degree_title'), '') = '' then
    raise exception 'survey_degree_title required';
  end if;

  v_external_raw := coalesce(trim(p_payload->>'survey_external_student_id'), '');
  if v_external_raw = '' then
    raise exception 'survey_external_student_id required';
  end if;

  -- Accept 8 digits or P + 8 digits; normalize to P########
  if v_external_raw ~ '^[0-9]{8}$' then
    v_external_id := 'P' || v_external_raw;
  elsif v_external_raw ~ '^[Pp][0-9]{8}$' then
    v_external_id := 'P' || substring(v_external_raw from 2);
  else
    raise exception 'survey_external_student_id must be exactly 8 digits';
  end if;

  begin
    v_year := (p_payload->>'survey_year')::smallint;
  exception
    when others then
      raise exception 'survey_year must be a number';
  end;

  if v_year < 1 or v_year > 4 then
    raise exception 'survey_year must be between 1 and 4';
  end if;

  if coalesce(trim(p_payload->>'survey_ancillary_module'), '') = '' then
    raise exception 'survey_ancillary_module required';
  end if;

  if jsonb_typeof(p_payload->'survey_alevel_or_equivalent_titles') is distinct from 'array'
    or coalesce(jsonb_array_length(p_payload->'survey_alevel_or_equivalent_titles'), 0) < 1
  then
    raise exception 'survey_alevel_or_equivalent_titles must be a non-empty array';
  end if;

  if p_payload->>'survey_confidence_coding' is null
    or p_payload->>'survey_confidence_written_reports' is null
    or p_payload->>'survey_confidence_presentation_public_speaking' is null
    or p_payload->>'survey_confidence_mathematical_literacy' is null
    or p_payload->>'survey_confidence_abstract_complex_content' is null
    or p_payload->>'survey_confidence_conflict_resolution' is null
    or p_payload->>'survey_approach_deadline' is null
    or p_payload->>'survey_approach_discussion' is null
    or p_payload->>'survey_approach_disagreement' is null
    or p_payload->>'survey_approach_new_concepts' is null
    or p_payload->>'survey_approach_communication' is null
    or p_payload->>'survey_approach_teammate_work' is null
    or p_payload->>'survey_approach_heavy_workload' is null
    or p_payload->>'survey_approach_group_project_role' is null
    or p_payload->>'survey_approach_critical_feedback' is null
  then
    raise exception 'All scale fields are required';
  end if;

  if (p_payload->>'survey_confidence_coding')::smallint not between 1 and 5
    or (p_payload->>'survey_confidence_written_reports')::smallint not between 1 and 5
    or (p_payload->>'survey_confidence_presentation_public_speaking')::smallint not between 1 and 5
    or (p_payload->>'survey_confidence_mathematical_literacy')::smallint not between 1 and 5
    or (p_payload->>'survey_confidence_abstract_complex_content')::smallint not between 1 and 5
    or (p_payload->>'survey_confidence_conflict_resolution')::smallint not between 1 and 5
    or (p_payload->>'survey_approach_deadline')::smallint not between 1 and 5
    or (p_payload->>'survey_approach_discussion')::smallint not between 1 and 5
    or (p_payload->>'survey_approach_disagreement')::smallint not between 1 and 5
    or (p_payload->>'survey_approach_new_concepts')::smallint not between 1 and 5
    or (p_payload->>'survey_approach_communication')::smallint not between 1 and 5
    or (p_payload->>'survey_approach_teammate_work')::smallint not between 1 and 5
    or (p_payload->>'survey_approach_heavy_workload')::smallint not between 1 and 5
    or (p_payload->>'survey_approach_group_project_role')::smallint not between 1 and 5
    or (p_payload->>'survey_approach_critical_feedback')::smallint not between 1 and 5
  then
    raise exception 'All scale fields must be integers from 1 to 5';
  end if;

  update public.student_profiles
  set
    survey_name = trim(p_payload->>'survey_name'),
    survey_degree_title = trim(p_payload->>'survey_degree_title'),
    survey_year = v_year,
    survey_external_student_id = v_external_id,
    survey_alevel_or_equivalent_titles = p_payload->'survey_alevel_or_equivalent_titles',
    survey_ancillary_module = trim(p_payload->>'survey_ancillary_module'),
    survey_confidence_coding = (p_payload->>'survey_confidence_coding')::smallint,
    survey_confidence_written_reports = (p_payload->>'survey_confidence_written_reports')::smallint,
    survey_confidence_presentation_public_speaking =
      (p_payload->>'survey_confidence_presentation_public_speaking')::smallint,
    survey_confidence_mathematical_literacy = (p_payload->>'survey_confidence_mathematical_literacy')::smallint,
    survey_confidence_abstract_complex_content =
      (p_payload->>'survey_confidence_abstract_complex_content')::smallint,
    survey_confidence_conflict_resolution = (p_payload->>'survey_confidence_conflict_resolution')::smallint,
    survey_approach_deadline = (p_payload->>'survey_approach_deadline')::smallint,
    survey_approach_discussion = (p_payload->>'survey_approach_discussion')::smallint,
    survey_approach_disagreement = (p_payload->>'survey_approach_disagreement')::smallint,
    survey_approach_new_concepts = (p_payload->>'survey_approach_new_concepts')::smallint,
    survey_approach_communication = (p_payload->>'survey_approach_communication')::smallint,
    survey_approach_teammate_work = (p_payload->>'survey_approach_teammate_work')::smallint,
    survey_approach_heavy_workload = (p_payload->>'survey_approach_heavy_workload')::smallint,
    survey_approach_group_project_role = (p_payload->>'survey_approach_group_project_role')::smallint,
    survey_approach_critical_feedback = (p_payload->>'survey_approach_critical_feedback')::smallint,
    profile_survey_completed_at = now(),
    updated_at = now()
  where id = v_uid;

  get diagnostics v_row_count = row_count;
  if v_row_count = 0 then
    raise exception 'Student profile not found';
  end if;
END;
$$;

ALTER FUNCTION public.submit_student_profile_survey(jsonb) OWNER TO postgres;

-- Educator survey list includes external ID
DROP FUNCTION IF EXISTS public.list_completed_student_surveys_for_educator();

CREATE OR REPLACE FUNCTION public.list_completed_student_surveys_for_educator()
RETURNS TABLE (
  student_id uuid,
  email text,
  survey_name text,
  survey_external_student_id text,
  survey_degree_title text,
  survey_year smallint,
  survey_alevel_or_equivalent_titles jsonb,
  survey_ancillary_module text,
  survey_confidence_coding smallint,
  survey_confidence_written_reports smallint,
  survey_confidence_presentation_public_speaking smallint,
  survey_confidence_mathematical_literacy smallint,
  survey_confidence_abstract_complex_content smallint,
  survey_confidence_conflict_resolution smallint,
  survey_approach_deadline smallint,
  survey_approach_discussion smallint,
  survey_approach_disagreement smallint,
  survey_approach_new_concepts smallint,
  survey_approach_communication smallint,
  survey_approach_teammate_work smallint,
  survey_approach_heavy_workload smallint,
  survey_approach_group_project_role smallint,
  survey_approach_critical_feedback smallint,
  profile_survey_completed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from public.teacher_profiles tp where tp.id = auth.uid()
  ) then
    raise exception 'Forbidden';
  end if;

  perform set_config('row_security', 'off', true);

  return query
  select
    sp.id,
    sp.email,
    sp.survey_name,
    sp.survey_external_student_id,
    sp.survey_degree_title,
    sp.survey_year,
    sp.survey_alevel_or_equivalent_titles,
    sp.survey_ancillary_module,
    sp.survey_confidence_coding,
    sp.survey_confidence_written_reports,
    sp.survey_confidence_presentation_public_speaking,
    sp.survey_confidence_mathematical_literacy,
    sp.survey_confidence_abstract_complex_content,
    sp.survey_confidence_conflict_resolution,
    sp.survey_approach_deadline,
    sp.survey_approach_discussion,
    sp.survey_approach_disagreement,
    sp.survey_approach_new_concepts,
    sp.survey_approach_communication,
    sp.survey_approach_teammate_work,
    sp.survey_approach_heavy_workload,
    sp.survey_approach_group_project_role,
    sp.survey_approach_critical_feedback,
    sp.profile_survey_completed_at
  from public.student_profiles sp
  where sp.profile_survey_completed_at is not null
  order by sp.profile_survey_completed_at desc;
END;
$$;

ALTER FUNCTION public.list_completed_student_surveys_for_educator() OWNER TO postgres;

REVOKE ALL ON FUNCTION public.list_completed_student_surveys_for_educator() FROM public;
GRANT EXECUTE ON FUNCTION public.list_completed_student_surveys_for_educator() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_completed_student_surveys_for_educator() TO service_role;
