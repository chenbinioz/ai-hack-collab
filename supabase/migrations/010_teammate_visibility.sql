-- Migration 010: Teammate Visibility
-- Allows students to see the profiles of other students in the same team.

-- Drop the existing policy if it exists (though it shouldn't)
DROP POLICY IF EXISTS "Users can view teammates" ON public.student_profiles;

-- Create a new policy that allows SELECT if the viewer shares the same team_id
-- Note: Subquery on the same table is safe here because we are comparing team_id
CREATE POLICY "Users can view teammates"
ON public.student_profiles
FOR SELECT
TO authenticated
USING (
  team_id IS NOT NULL 
  AND 
  team_id = (
    SELECT sp.team_id 
    FROM public.student_profiles sp 
    WHERE sp.id = auth.uid()
  )
);

-- Ensure the authenticated users have SELECT permission (already granted, but good to ensure)
GRANT SELECT ON public.student_profiles TO authenticated;
