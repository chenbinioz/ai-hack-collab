-- 1. Setup Roles and Table
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('student', 'teacher');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.student_profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email text,
  role user_role DEFAULT 'student',
  

  -- Matches
  match_id uuid REFERENCES public.student_profiles(id),
  match_reason text,
  is_matched boolean DEFAULT false,
  
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.student_profiles 
  DROP COLUMN IF EXISTS full_name,
  DROP COLUMN IF EXISTS working_pace,
  DROP COLUMN IF EXISTS collaboration_preference,
  DROP COLUMN IF EXISTS conflict_resolution_style,
  DROP COLUMN IF EXISTS skills,
  DROP COLUMN IF EXISTS subject_confidence;
-- 2. Security & Permissions for Auth System
ALTER TABLE public.student_profiles ENABLE ROW LEVEL SECURITY;

-- Allow the internal Supabase Auth system to create the initial profile row
DROP POLICY IF EXISTS "Allow system to insert profiles" ON public.student_profiles;
CREATE POLICY "Allow system to insert profiles"
  ON public.student_profiles FOR INSERT
  TO supabase_auth_admin
  WITH CHECK (true);

GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT INSERT, UPDATE ON public.student_profiles TO supabase_auth_admin;

-- 3. The Automation Trigger
-- This function runs automatically on every Sign-Up
CREATE OR REPLACE FUNCTION public.handle_new_student_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.student_profiles (id, email)
  VALUES (new.id, coalesce(new.email, ''))
  ON CONFLICT (id) DO UPDATE
    SET email = excluded.email,
        updated_at = now();
  RETURN new;
END;
$$;

-- Connect the function to the Auth table
DROP TRIGGER IF EXISTS on_auth_user_created_student_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_student_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_student_auth_user();

-- 4. General RLS Policies (For Next.js Frontend)
DROP POLICY IF EXISTS "Users can view their own profile and their match" ON public.student_profiles;
CREATE POLICY "Users can view their own profile and their match"
  ON public.student_profiles FOR SELECT
  USING (auth.uid() = id OR id = (SELECT match_id FROM public.student_profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can update their own survey data" ON public.student_profiles;
CREATE POLICY "Users can update their own survey data"
  ON public.student_profiles FOR UPDATE
  USING (auth.uid() = id);
  
drop policy if exists "student_profiles_select_own" on public.student_profiles;
drop policy if exists "student_profiles_insert_own" on public.student_profiles;
drop policy if exists "student_profiles_update_own" on public.student_profiles;
drop policy if exists "student_profiles_insert_supabase_auth_admin" on public.student_profiles;

create policy "student_profiles_select_own"
  on public.student_profiles
  for select
  to authenticated
  using (auth.uid() = id);

create policy "student_profiles_insert_own"
  on public.student_profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

create policy "student_profiles_update_own"
  on public.student_profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "student_profiles_insert_supabase_auth_admin"
  on public.student_profiles
  for insert
  to supabase_auth_admin
  with check (true);

-- Called from the app after sign-in (avoids direct SELECT + RLS recursion).
create or replace function public.student_profile_exists(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
stable
as $$
begin
  if p_user_id is null then
    return false;
  end if;
  perform set_config('row_security', 'off', true);
  return exists (
    select 1
    from public.student_profiles sp
    where sp.id = p_user_id
  );
end;
$$;

alter function public.student_profile_exists(uuid) owner to postgres;

revoke all on function public.student_profile_exists(uuid) from public;
grant execute on function public.student_profile_exists(uuid) to authenticated;
grant execute on function public.student_profile_exists(uuid) to service_role;


drop policy if exists "student_profiles_insert_supabase_auth_admin" on public.student_profiles;
create policy "student_profiles_insert_supabase_auth_admin"
  on public.student_profiles
  for insert
  to supabase_auth_admin
  with check (true);

grant usage on schema public to supabase_auth_admin;
grant insert, update on public.student_profiles to supabase_auth_admin;

create or replace function public.handle_new_student_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('row_security', 'off', true);
  insert into public.student_profiles (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();
  return new;
end;
$$;

alter function public.handle_new_student_auth_user() owner to postgres;

grant execute on function public.handle_new_student_auth_user() to postgres;
grant execute on function public.handle_new_student_auth_user() to supabase_auth_admin;

drop trigger if exists on_auth_user_created_student_profile on auth.users;

create trigger on_auth_user_created_student_profile
  after insert on auth.users
  for each row
  execute procedure public.handle_new_student_auth_user();
  
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

-- Teacher Profiles
create table if not exists public.teacher_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.teacher_profiles is 'Application copy of educator identity for Postgres-backed checks alongside auth.users';

alter table public.teacher_profiles enable row level security;

drop policy if exists "teacher_profiles_select_own" on public.teacher_profiles;
create policy "teacher_profiles_select_own"
  on public.teacher_profiles
  for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "teacher_profiles_insert_own" on public.teacher_profiles;
create policy "teacher_profiles_insert_own"
  on public.teacher_profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "teacher_profiles_update_own" on public.teacher_profiles;
create policy "teacher_profiles_update_own"
  on public.teacher_profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "teacher_profiles_insert_supabase_auth_admin" on public.teacher_profiles;
create policy "teacher_profiles_insert_supabase_auth_admin"
  on public.teacher_profiles
  for insert
  to supabase_auth_admin
  with check (true);

grant usage on schema public to supabase_auth_admin;
grant insert, update on public.teacher_profiles to supabase_auth_admin;

-- Sign-in check via RPC (avoids RLS recursion on direct SELECT)
create or replace function public.teacher_profile_exists(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
stable
as $$
begin
  if p_user_id is null then
    return false;
  end if;
  perform set_config('row_security', 'off', true);
  return exists (
    select 1
    from public.teacher_profiles tp
    where tp.id = p_user_id
  );
end;
$$;

alter function public.teacher_profile_exists(uuid) owner to postgres;

revoke all on function public.teacher_profile_exists(uuid) from public;
grant execute on function public.teacher_profile_exists(uuid) to authenticated;
grant execute on function public.teacher_profile_exists(uuid) to service_role;

-- 2) Replace auth trigger: one function, role-aware inserts
drop trigger if exists on_auth_user_created_student_profile on auth.users;
drop trigger if exists on_auth_user_created_app_profiles on auth.users;
drop function if exists public.handle_new_student_auth_user();

create or replace function public.handle_new_auth_user_profiles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  role_key text;
begin
  perform set_config('row_security', 'off', true);
  role_key := lower(
    coalesce(
      nullif(trim((coalesce(new.raw_user_meta_data, '{}'::jsonb)->>'app_role')), ''),
      'student'
    )
  );

  if role_key = 'educator' then
    insert into public.teacher_profiles (id, email)
    values (new.id, coalesce(new.email, ''))
    on conflict (id) do update
      set email = excluded.email,
          updated_at = now();
  else
    insert into public.student_profiles (id, email)
    values (new.id, coalesce(new.email, ''))
    on conflict (id) do update
      set email = excluded.email,
          updated_at = now();
  end if;

  return new;
end;
$$;

alter function public.handle_new_auth_user_profiles() owner to postgres;

grant execute on function public.handle_new_auth_user_profiles() to postgres;
grant execute on function public.handle_new_auth_user_profiles() to supabase_auth_admin;

create trigger on_auth_user_created_app_profiles
  after insert on auth.users
  for each row
  execute procedure public.handle_new_auth_user_profiles();

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

-- Provide teams support
CREATE TABLE IF NOT EXISTS public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  reason text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teams are viewable by authenticated users" 
ON public.teams FOR SELECT TO authenticated USING (true);

-- Adding team assignment back into student profiles
ALTER TABLE public.student_profiles
ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;

-- Explicitly grant table permissions to the service_role
-- In some custom or strict Postgres setups, service_role might lose default privileges.
-- This ensures the Python backend (which uses the service_role key) has the 
-- fundamental SQL permissions to read/write the necessary tables.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_profiles TO service_role;
