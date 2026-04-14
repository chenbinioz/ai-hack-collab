-- Migration 012: Fix Messaging Ambiguity
-- Resolves the "column reference 'team_id' is ambiguous" error in RLS policies and RPC functions

-- 1. Fix RLS policies for messages by qualifying column names

-- SELECT policy
DROP POLICY IF EXISTS "Users can view messages from their team" ON public.messages;
CREATE POLICY "Users can view messages from their team"
ON public.messages FOR SELECT
TO authenticated
USING (
  public.messages.team_id IN (
    SELECT sp.team_id
    FROM public.student_profiles sp
    WHERE sp.id = auth.uid() AND sp.team_id IS NOT NULL
  )
);

-- INSERT policy
DROP POLICY IF EXISTS "Users can send messages to their team" ON public.messages;
CREATE POLICY "Users can send messages to their team"
ON public.messages FOR INSERT
TO authenticated
WITH CHECK (
  public.messages.sender_id = auth.uid() AND
  public.messages.team_id IN (
    SELECT sp.team_id
    FROM public.student_profiles sp
    WHERE sp.id = auth.uid() AND sp.team_id IS NOT NULL
  )
);

-- 2. Refactor get_team_messages to LANGUAGE sql to eliminate variable scoping issues
CREATE OR REPLACE FUNCTION public.get_team_messages()
RETURNS TABLE (
  id uuid,
  team_id uuid,
  sender_id uuid,
  sender_name text,
  content text,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT
    m.id,
    m.team_id,
    m.sender_id,
    sp.survey_name as sender_name,
    m.content,
    m.created_at
  FROM public.messages m
  JOIN public.student_profiles sp ON m.sender_id = sp.id
  WHERE m.team_id = (
    SELECT me.team_id
    FROM public.student_profiles me
    WHERE me.id = auth.uid() AND me.team_id IS NOT NULL
  )
  ORDER BY m.created_at ASC;
$$;

-- 3. Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_team_messages() TO authenticated;
