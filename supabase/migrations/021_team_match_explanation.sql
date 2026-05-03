-- Store explainable AI matching details per team.
ALTER TABLE public.teams
ADD COLUMN IF NOT EXISTS match_explanation jsonb;

-- Optional index to speed up future JSON filtering / analytics.
CREATE INDEX IF NOT EXISTS idx_teams_match_explanation
ON public.teams
USING gin (match_explanation);
