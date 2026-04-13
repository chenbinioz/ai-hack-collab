-- FIX: "Database error saving new user" on email/password sign-up
-- -----------------------------------------------------------------
-- Run this entire file in Supabase Dashboard → SQL Editor → Run.
-- Safe to run multiple times.
--
-- If sign-in then fails with "infinite recursion detected in policy" on student_profiles,
-- run supabase/migrations/003_fix_student_profiles_rls_recursion.sql as well.
--
-- What it does: recreates the trigger function so the insert into student_profiles
-- runs with row_security disabled for that statement (trusted path only). Also
-- ensures supabase_auth_admin policy + grants exist.

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
