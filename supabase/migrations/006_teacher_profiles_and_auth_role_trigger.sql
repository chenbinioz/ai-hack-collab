-- Teacher (educator) profiles + role-aware sign-up trigger
-- ----------------------------------------------------------
-- Run in Supabase → SQL Editor (or `supabase db push`). Safe to run multiple times.
--
-- Requires existing `student_profiles` (001). Replaces the old "every user → student_profiles"
-- trigger with one that branches on `raw_user_meta_data.app_role` from Auth signUp options:
--   - app_role 'educator' → insert/update `teacher_profiles` only
--   - anything else (including missing) → insert/update `student_profiles` only
--
-- Client: student sign-up sends data.app_role = 'student'; educator sends 'educator'.

-- 1) teacher_profiles (same core shape as student_profiles; skip if you already created it)
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
grant select, insert, update on public.teacher_profiles to authenticated;

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
