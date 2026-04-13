-- Student profile survey: one-time submission, answers locked after `profile_survey_completed_at` is set.
-- Run in Supabase → SQL Editor after 001–003.
--
-- Variable names (columns), in survey order:
--   Page 1 — survey_name, survey_degree_title, survey_year,
--            survey_alevel_or_equivalent_titles, survey_ancillary_module
--   Page 2 — survey_confidence_coding, survey_confidence_written_reports,
--            survey_confidence_presentation_public_speaking, survey_confidence_mathematical_literacy,
--            survey_confidence_abstract_complex_content, survey_confidence_conflict_resolution
--   Page 3 — survey_approach_deadline, survey_approach_discussion, survey_approach_disagreement,
--            survey_approach_new_concepts, survey_approach_communication, survey_approach_teammate_work,
--            survey_approach_heavy_workload, survey_approach_group_project_role, survey_approach_critical_feedback
--   Lock — profile_survey_completed_at

drop trigger if exists student_profiles_enforce_survey_final on public.student_profiles;
drop function if exists public.enforce_student_profile_survey_final();

alter table public.student_profiles
  drop column if exists survey_skills,
  drop column if exists survey_working_style,
  drop column if exists survey_availability,
  drop column if exists survey_goals;

alter table public.student_profiles
  add column if not exists survey_name text,
  add column if not exists survey_degree_title text,
  add column if not exists survey_year smallint,
  add column if not exists survey_alevel_or_equivalent_titles jsonb,
  add column if not exists survey_ancillary_module text,
  add column if not exists survey_confidence_coding smallint,
  add column if not exists survey_confidence_written_reports smallint,
  add column if not exists survey_confidence_presentation_public_speaking smallint,
  add column if not exists survey_confidence_mathematical_literacy smallint,
  add column if not exists survey_confidence_abstract_complex_content smallint,
  add column if not exists survey_confidence_conflict_resolution smallint,
  add column if not exists survey_approach_deadline smallint,
  add column if not exists survey_approach_discussion smallint,
  add column if not exists survey_approach_disagreement smallint,
  add column if not exists survey_approach_new_concepts smallint,
  add column if not exists survey_approach_communication smallint,
  add column if not exists survey_approach_teammate_work smallint,
  add column if not exists survey_approach_heavy_workload smallint,
  add column if not exists survey_approach_group_project_role smallint,
  add column if not exists survey_approach_critical_feedback smallint,
  add column if not exists profile_survey_completed_at timestamptz;

comment on column public.student_profiles.survey_name is 'Page 1: display name; immutable after profile_survey_completed_at';
comment on column public.student_profiles.survey_degree_title is 'Page 1: degree title; immutable after profile_survey_completed_at';
comment on column public.student_profiles.survey_year is 'Page 1: year 1–4; immutable after profile_survey_completed_at';
comment on column public.student_profiles.survey_alevel_or_equivalent_titles is 'Page 1: JSON array of selected titles; immutable after profile_survey_completed_at';
comment on column public.student_profiles.survey_ancillary_module is 'Page 1: ancillary module choice; immutable after profile_survey_completed_at';
comment on column public.student_profiles.survey_confidence_coding is 'Page 2: 1–5 confidence; immutable after profile_survey_completed_at';
comment on column public.student_profiles.survey_confidence_written_reports is 'Page 2: 1–5 confidence; immutable after profile_survey_completed_at';
comment on column public.student_profiles.survey_confidence_presentation_public_speaking is 'Page 2: 1–5 confidence; immutable after profile_survey_completed_at';
comment on column public.student_profiles.survey_confidence_mathematical_literacy is 'Page 2: 1–5 confidence; immutable after profile_survey_completed_at';
comment on column public.student_profiles.survey_confidence_abstract_complex_content is 'Page 2: 1–5 confidence; immutable after profile_survey_completed_at';
comment on column public.student_profiles.survey_confidence_conflict_resolution is 'Page 2: 1–5 confidence; immutable after profile_survey_completed_at';
comment on column public.student_profiles.survey_approach_deadline is 'Page 3: 1–5 scale; immutable after profile_survey_completed_at';
comment on column public.student_profiles.survey_approach_discussion is 'Page 3: 1–5 scale; immutable after profile_survey_completed_at';
comment on column public.student_profiles.survey_approach_disagreement is 'Page 3: 1–5 scale; immutable after profile_survey_completed_at';
comment on column public.student_profiles.survey_approach_new_concepts is 'Page 3: 1–5 scale; immutable after profile_survey_completed_at';
comment on column public.student_profiles.survey_approach_communication is 'Page 3: 1–5 scale; immutable after profile_survey_completed_at';
comment on column public.student_profiles.survey_approach_teammate_work is 'Page 3: 1–5 scale; immutable after profile_survey_completed_at';
comment on column public.student_profiles.survey_approach_heavy_workload is 'Page 3: 1–5 scale; immutable after profile_survey_completed_at';
comment on column public.student_profiles.survey_approach_group_project_role is 'Page 3: 1–5 scale; immutable after profile_survey_completed_at';
comment on column public.student_profiles.survey_approach_critical_feedback is 'Page 3: 1–5 scale; immutable after profile_survey_completed_at';
comment on column public.student_profiles.profile_survey_completed_at is 'When set, survey answers cannot be changed (enforced by trigger)';

-- Prevent changing survey payload or reopening the survey after completion.
create or replace function public.enforce_student_profile_survey_final()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.profile_survey_completed_at is not null then
    if new.survey_name is distinct from old.survey_name
      or new.survey_degree_title is distinct from old.survey_degree_title
      or new.survey_year is distinct from old.survey_year
      or new.survey_alevel_or_equivalent_titles is distinct from old.survey_alevel_or_equivalent_titles
      or new.survey_ancillary_module is distinct from old.survey_ancillary_module
      or new.survey_confidence_coding is distinct from old.survey_confidence_coding
      or new.survey_confidence_written_reports is distinct from old.survey_confidence_written_reports
      or new.survey_confidence_presentation_public_speaking is distinct from old.survey_confidence_presentation_public_speaking
      or new.survey_confidence_mathematical_literacy is distinct from old.survey_confidence_mathematical_literacy
      or new.survey_confidence_abstract_complex_content is distinct from old.survey_confidence_abstract_complex_content
      or new.survey_confidence_conflict_resolution is distinct from old.survey_confidence_conflict_resolution
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
      raise exception 'Student profile survey is final and cannot be changed.';
    end if;
  end if;
  return new;
end;
$$;

alter function public.enforce_student_profile_survey_final() owner to postgres;

create trigger student_profiles_enforce_survey_final
  before update on public.student_profiles
  for each row
  execute procedure public.enforce_student_profile_survey_final();
