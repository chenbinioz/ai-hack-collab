-- Fix teams table RLS policies to allow service_role full access
-- (needed for Python backend to create and update teams)

-- Drop the overly restrictive policy
DROP POLICY IF EXISTS "Teams are viewable by authenticated users" ON public.teams;

-- Allow service_role (backend) to do everything
CREATE POLICY "Service role can manage teams"
  ON public.teams
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users (students) to view teams
CREATE POLICY "Authenticated users can view teams"
  ON public.teams
  FOR SELECT
  TO authenticated
  USING (true);

-- Fix student_profiles RLS to avoid recursion when backend fetches data
-- Drop the problematic select policy if it exists
DROP POLICY IF EXISTS "student_profiles_select_own" ON public.student_profiles;

-- Recreate with simpler logic for authenticated users
CREATE POLICY "student_profiles_select_own"
  ON public.student_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Allow service_role to read all student profiles (for backend matching)
CREATE POLICY "Service role can read all student profiles"
  ON public.student_profiles
  FOR SELECT
  TO service_role
  USING (true);

-- Allow service_role to update team assignments
CREATE POLICY "Service role can update team assignments"
  ON public.student_profiles
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);
