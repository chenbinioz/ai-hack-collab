-- Migration 011: Teammates RPC
-- Removes recursive RLS and replaces it with a Security Definer RPC

-- 1. Remove the problematic recursive policy
DROP POLICY IF EXISTS "Users can view teammates" ON public.student_profiles;

-- 2. Create the Security Definer function to fetch teammates
CREATE OR REPLACE FUNCTION public.get_my_teammates()
RETURNS TABLE (
  id uuid,
  survey_name text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT sp.id, sp.survey_name
  FROM public.student_profiles sp
  WHERE sp.team_id = (
    SELECT me.team_id
    FROM public.student_profiles me
    WHERE me.id = auth.uid()
  )
  AND sp.id != auth.uid();
$$;

-- 3. Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_my_teammates() TO authenticated;
