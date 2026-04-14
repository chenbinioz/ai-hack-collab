-- Provide teams support
CREATE TABLE IF NOT EXISTS public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  reason text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teams are viewable by authenticated users" 
ON public.teams FOR SELECT TO authenticated USING (true);

-- Adding team assignment back into student profiles
ALTER TABLE public.student_profiles
ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;
