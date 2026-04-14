-- Migration 013: Educator Permissions
-- Allows users with a record in teacher_profiles to view all student profiles

-- Drop the policy if it exists to allow for rerurns
DROP POLICY IF EXISTS "Teachers can view all student profiles" ON public.student_profiles;

CREATE POLICY "Teachers can view all student profiles"
ON public.student_profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.teacher_profiles
    WHERE id = auth.uid()
  )
);
