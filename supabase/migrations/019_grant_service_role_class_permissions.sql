-- Ensure backend service_role can read/write class-scoped tables used by team generation.
-- This fixes errors like: permission denied for table classes.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.classes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_enrollments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feedback TO service_role;

-- If RLS is enabled, keep explicit service_role policies as a hard guarantee.
DROP POLICY IF EXISTS "Service role can manage classes" ON public.classes;
CREATE POLICY "Service role can manage classes"
  ON public.classes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage class enrollments" ON public.class_enrollments;
CREATE POLICY "Service role can manage class enrollments"
  ON public.class_enrollments
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage feedback" ON public.feedback;
CREATE POLICY "Service role can manage feedback"
  ON public.feedback
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
