-- Add match_explanation_seconds to feedback to store seconds a student spent reading the match explanation
ALTER TABLE public.feedback
  ADD COLUMN IF NOT EXISTS match_explanation_seconds integer;

-- Helpful index for analytics queries
CREATE INDEX IF NOT EXISTS idx_feedback_match_explanation_seconds ON public.feedback(match_explanation_seconds);
