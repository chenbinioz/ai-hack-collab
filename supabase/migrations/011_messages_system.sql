-- Create messages table for team messaging system
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.student_profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO supabase_auth_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO service_role;
GRANT SELECT, INSERT ON public.messages TO authenticated;

-- Policy: Users can view messages from their team's channels
CREATE POLICY "Users can view messages from their team"
ON public.messages FOR SELECT
TO authenticated
USING (
  team_id IN (
    SELECT team_id
    FROM public.student_profiles
    WHERE id = auth.uid() AND team_id IS NOT NULL
  )
);

-- Policy: Users can insert messages to their team's channels
CREATE POLICY "Users can send messages to their team"
ON public.messages FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid() AND
  team_id IN (
    SELECT team_id
    FROM public.student_profiles
    WHERE id = auth.uid() AND team_id IS NOT NULL
  )
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_messages_team_created_at
ON public.messages(team_id, created_at DESC);

-- Function to get messages for a user's team
CREATE OR REPLACE FUNCTION public.get_team_messages()
RETURNS TABLE (
  id uuid,
  team_id uuid,
  sender_id uuid,
  sender_name text,
  content text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
BEGIN
  RETURN QUERY
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
    SELECT team_id
    FROM public.student_profiles
    WHERE id = auth.uid() AND team_id IS NOT NULL
  )
  ORDER BY m.created_at ASC;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_team_messages() TO authenticated;