-- Remove recursive classes policy that can break educator class fetches.
-- Student class access now uses public.list_student_classes() RPC.

DROP POLICY IF EXISTS "Students can view enrolled classes" ON public.classes;
