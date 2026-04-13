-- Educators: list completed student profile surveys
-- -----------------------------------------------
-- Run in Supabase → SQL Editor after 006. Safe to run multiple times.
--
-- Exposes `list_completed_student_surveys_for_educator()` for authenticated users who
-- have a `teacher_profiles` row. Uses SECURITY DEFINER + row_security off to read
-- `student_profiles` without widening student RLS.

create or replace function public.list_completed_student_surveys_for_educator()
returns table (
  student_id uuid,
  email text,
  survey_name text,
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
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.teacher_profiles tp
    where tp.id = auth.uid()
  ) then
    raise exception 'Forbidden';
  end if;

  perform set_config('row_security', 'off', true);

  return query
  select
    sp.id,
    sp.email,
    sp.survey_name,
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
end;
$$;

alter function public.list_completed_student_surveys_for_educator() owner to postgres;

revoke all on function public.list_completed_student_surveys_for_educator() from public;
grant execute on function public.list_completed_student_surveys_for_educator() to authenticated;
grant execute on function public.list_completed_student_surveys_for_educator() to service_role;
