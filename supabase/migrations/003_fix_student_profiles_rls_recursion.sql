-- FIX: "infinite recursion detected in policy for relation student_profiles" on sign-in
-- ---------------------------------------------------------------------------------
-- Run in Supabase → SQL Editor (after 001 / 002). Safe to run multiple times.
--
-- 1) Policies use plain auth.uid() = id (avoids odd planner/RLS re-entrancy with subselects).
-- 2) Login check uses RPC student_profile_exists(), which reads the table inside
--    SECURITY DEFINER + row_security off so it cannot recurse through RLS.

-- Policies: drop by name, recreate (minimal expressions)
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
