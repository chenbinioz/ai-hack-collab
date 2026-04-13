-- Student profile rows linked to Supabase Auth (auth.users).
-- Run the full script in Supabase → SQL Editor (or supabase db push).
--
-- Initial row is created only by the trigger below when a user signs up (auth.signUp).
-- The app updates student_profiles after onboarding; it does not insert rows on sign-up.
--
-- If sign-up shows "Database error saving new user", run 002_fix_student_signup.sql (updates
-- the trigger function to bypass RLS for that insert).

create table if not exists public.student_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.student_profiles is 'Application copy of student identity for Postgres-backed checks alongside auth.users';

alter table public.student_profiles enable row level security;

-- Student app (JWT): own row only (plain auth.uid() avoids RLS recursion issues)
drop policy if exists "student_profiles_select_own" on public.student_profiles;
create policy "student_profiles_select_own"
  on public.student_profiles
  for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "student_profiles_insert_own" on public.student_profiles;
create policy "student_profiles_insert_own"
  on public.student_profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "student_profiles_update_own" on public.student_profiles;
create policy "student_profiles_update_own"
  on public.student_profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Sign-up runs as supabase_auth_admin; keep this policy as defense in depth.
drop policy if exists "student_profiles_insert_supabase_auth_admin" on public.student_profiles;
create policy "student_profiles_insert_supabase_auth_admin"
  on public.student_profiles
  for insert
  to supabase_auth_admin
  with check (true);

grant usage on schema public to supabase_auth_admin;
grant insert, update on public.student_profiles to supabase_auth_admin;

-- SECURITY DEFINER + empty search_path. RLS is disabled for the INSERT only via set_config
-- so sign-up never fails when policies do not match the auth service role.
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

-- Sign-in flow calls this via RPC so PostgREST does not hit recursive RLS on SELECT.
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
