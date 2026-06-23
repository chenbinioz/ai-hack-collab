-- Create table to record how long individual students spend reading coach messages
CREATE TABLE IF NOT EXISTS public.message_read_times (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.student_profiles(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  message_id uuid NULL,
  seconds integer NOT NULL CHECK (seconds >= 0),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.message_read_times ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_read_times TO supabase_auth_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_read_times TO service_role;
GRANT INSERT ON public.message_read_times TO authenticated;
GRANT SELECT ON public.message_read_times TO authenticated;

-- Students can insert their own reading times for messages belonging to their team
CREATE POLICY "Students can submit message read times"
  ON public.message_read_times FOR INSERT
  TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    AND team_id = (
      SELECT team_id
      FROM public.student_profiles
      WHERE id = auth.uid()
    )
  );

-- Students can read their own message read times
CREATE POLICY "Students can read their own message read times"
  ON public.message_read_times FOR SELECT
  TO authenticated
  USING (
    student_id = auth.uid()
  );

-- Educators can read all message read times
CREATE POLICY "Educators can read all message read times"
  ON public.message_read_times FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.teacher_profiles tp
      WHERE tp.id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_message_read_times_team_id ON public.message_read_times(team_id);
CREATE INDEX IF NOT EXISTS idx_message_read_times_message_id ON public.message_read_times(message_id);
