
-- Allow educators to read basic student profile info
CREATE POLICY "Educators can view student profiles" 
ON public.student_profiles FOR SELECT TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.teacher_profiles 
    WHERE teacher_profiles.id = auth.uid()
  )
);

