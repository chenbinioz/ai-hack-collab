-- Adds optional coursework deadline per class so educators can set due dates.

ALTER TABLE public.classes
ADD COLUMN IF NOT EXISTS coursework_deadline timestamptz;

CREATE INDEX IF NOT EXISTS idx_classes_coursework_deadline
ON public.classes(coursework_deadline);
