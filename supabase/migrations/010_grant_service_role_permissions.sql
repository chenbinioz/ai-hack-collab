-- Explicitly grant table permissions to the service_role
-- In some custom or strict Postgres setups, service_role might lose default privileges.
-- This ensures the Python backend (which uses the service_role key) has the 
-- fundamental SQL permissions to read/write the necessary tables.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_profiles TO service_role;
