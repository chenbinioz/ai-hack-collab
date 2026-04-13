-- FIX: "infinite recursion detected in policy for relation student_profiles" on survey submit / read
-- --------------------------------------------------------------------------------------------------
-- PostgREST reads/updates on `student_profiles` can trigger RLS re-entrancy in some setups.
-- `submit_student_profile_survey` writes the survey inside SECURITY DEFINER with row_security off
-- (same pattern as `student_profile_exists`). `student_profile_survey_completed` reads the completion
-- flag the same way so the student home and survey gate stay reliable.
--
-- Run in Supabase → SQL Editor after `004_student_profile_survey.sql`. Safe to run multiple times.

create or replace function public.submit_student_profile_survey(p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_completed timestamptz;
  v_year smallint;
  v_row_count int;
begin
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
end;
$$;

alter function public.submit_student_profile_survey(jsonb) owner to postgres;

revoke all on function public.submit_student_profile_survey(jsonb) from public;
grant execute on function public.submit_student_profile_survey(jsonb) to authenticated;
grant execute on function public.submit_student_profile_survey(jsonb) to service_role;

-- Read completion flag without a direct SELECT on student_profiles under RLS (same class of fix as sign-in).
create or replace function public.student_profile_survey_completed()
returns boolean
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_uid uuid;
  v_completed timestamptz;
begin
  v_uid := auth.uid();
  if v_uid is null then
    return false;
  end if;

  perform set_config('row_security', 'off', true);

  select sp.profile_survey_completed_at
  into v_completed
  from public.student_profiles sp
  where sp.id = v_uid;

  if not found then
    return false;
  end if;

  return v_completed is not null;
end;
$$;

alter function public.student_profile_survey_completed() owner to postgres;

revoke all on function public.student_profile_survey_completed() from public;
grant execute on function public.student_profile_survey_completed() to authenticated;
grant execute on function public.student_profile_survey_completed() to service_role;
