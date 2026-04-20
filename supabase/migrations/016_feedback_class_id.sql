-- Add class scoping support to feedback rows.
-- This fixes errors where application queries `feedback.class_id`.

ALTER TABLE public.feedback
ADD COLUMN IF NOT EXISTS class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE;

-- Backfill historical rows using team -> class mapping.
UPDATE public.feedback AS f
SET class_id = t.class_id
FROM public.teams AS t
WHERE f.team_id = t.id
  AND f.class_id IS NULL
  AND t.class_id IS NOT NULL;

-- Keep class_id in sync from team_id for inserts/updates.
CREATE OR REPLACE FUNCTION public.feedback_set_class_id_from_team()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.team_id IS NULL THEN
    RETURN NEW;
  END IF;

  NEW.class_id := (
    SELECT t.class_id
    FROM public.teams AS t
    WHERE t.id = NEW.team_id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_feedback_set_class_id_from_team ON public.feedback;
CREATE TRIGGER trg_feedback_set_class_id_from_team
BEFORE INSERT OR UPDATE OF team_id
ON public.feedback
FOR EACH ROW
EXECUTE FUNCTION public.feedback_set_class_id_from_team();

-- Helpful for educator analytics and student class-filtered feedback checks.
CREATE INDEX IF NOT EXISTS idx_feedback_class_id ON public.feedback(class_id);
