-- Add assignment_id to draft teams so assignment-specific drafts can be published correctly.
ALTER TABLE public.team_drafts
ADD COLUMN IF NOT EXISTS assignment_id uuid REFERENCES public.assignments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_team_drafts_assignment_id ON public.team_drafts(assignment_id);
