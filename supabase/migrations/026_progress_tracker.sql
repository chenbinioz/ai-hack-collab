-- Project progress tracker: assignment-level tasks with per-team completion state.

CREATE TABLE IF NOT EXISTS public.assignment_progress_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,

  title text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assignment_progress_tasks_assignment_id
  ON public.assignment_progress_tasks(assignment_id);

ALTER TABLE public.assignment_progress_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Educators and enrolled students can view assignment progress tasks"
  ON public.assignment_progress_tasks;
CREATE POLICY "Educators and enrolled students can view assignment progress tasks"
  ON public.assignment_progress_tasks FOR SELECT TO authenticated
  USING (
    assignment_id IN (
      SELECT a.id
      FROM public.assignments a
      JOIN public.classes c ON c.id = a.class_id
      WHERE c.educator_id = auth.uid()
    )
    OR assignment_id IN (
      SELECT a.id
      FROM public.assignments a
      JOIN public.class_enrollments ce ON ce.class_id = a.class_id
      WHERE ce.student_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Educators can manage assignment progress tasks"
  ON public.assignment_progress_tasks;
CREATE POLICY "Educators can manage assignment progress tasks"
  ON public.assignment_progress_tasks FOR ALL TO authenticated
  USING (
    assignment_id IN (
      SELECT a.id
      FROM public.assignments a
      JOIN public.classes c ON c.id = a.class_id
      WHERE c.educator_id = auth.uid()
    )
  )
  WITH CHECK (
    assignment_id IN (
      SELECT a.id
      FROM public.assignments a
      JOIN public.classes c ON c.id = a.class_id
      WHERE c.educator_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignment_progress_tasks TO authenticated;

CREATE TABLE IF NOT EXISTS public.team_progress_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.assignment_progress_tasks(id) ON DELETE CASCADE,
  completed_at timestamptz,
  completed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(team_id, task_id)
);

CREATE INDEX IF NOT EXISTS idx_team_progress_items_assignment_id
  ON public.team_progress_items(assignment_id);
CREATE INDEX IF NOT EXISTS idx_team_progress_items_team_id
  ON public.team_progress_items(team_id);
CREATE INDEX IF NOT EXISTS idx_team_progress_items_task_id
  ON public.team_progress_items(task_id);

ALTER TABLE public.team_progress_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Educators and team members can view team progress items"
  ON public.team_progress_items;
CREATE POLICY "Educators and team members can view team progress items"
  ON public.team_progress_items FOR SELECT TO authenticated
  USING (
    assignment_id IN (
      SELECT a.id
      FROM public.assignments a
      JOIN public.classes c ON c.id = a.class_id
      WHERE c.educator_id = auth.uid()
    )
    OR team_id IN (
      SELECT tm.team_id
      FROM public.team_members tm
      WHERE tm.student_id = auth.uid()
        AND tm.assignment_id = assignment_id
    )
    OR team_id = (
      SELECT sp.team_id
      FROM public.student_profiles sp
      WHERE sp.id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Educators and team members can update team progress items"
  ON public.team_progress_items;
CREATE POLICY "Educators and team members can update team progress items"
  ON public.team_progress_items FOR UPDATE TO authenticated
  USING (
    assignment_id IN (
      SELECT a.id
      FROM public.assignments a
      JOIN public.classes c ON c.id = a.class_id
      WHERE c.educator_id = auth.uid()
    )
    OR team_id IN (
      SELECT tm.team_id
      FROM public.team_members tm
      WHERE tm.student_id = auth.uid()
        AND tm.assignment_id = assignment_id
    )
    OR team_id = (
      SELECT sp.team_id
      FROM public.student_profiles sp
      WHERE sp.id = auth.uid()
    )
  )
  WITH CHECK (
    assignment_id IN (
      SELECT a.id
      FROM public.assignments a
      JOIN public.classes c ON c.id = a.class_id
      WHERE c.educator_id = auth.uid()
    )
    OR team_id IN (
      SELECT tm.team_id
      FROM public.team_members tm
      WHERE tm.student_id = auth.uid()
        AND tm.assignment_id = assignment_id
    )
    OR team_id = (
      SELECT sp.team_id
      FROM public.student_profiles sp
      WHERE sp.id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Educators and team members can insert team progress items"
  ON public.team_progress_items;
CREATE POLICY "Educators and team members can insert team progress items"
  ON public.team_progress_items FOR INSERT TO authenticated
  WITH CHECK (
    assignment_id IN (
      SELECT a.id
      FROM public.assignments a
      JOIN public.classes c ON c.id = a.class_id
      WHERE c.educator_id = auth.uid()
    )
    OR team_id IN (
      SELECT tm.team_id
      FROM public.team_members tm
      WHERE tm.student_id = auth.uid()
        AND tm.assignment_id = assignment_id
    )
    OR team_id = (
      SELECT sp.team_id
      FROM public.student_profiles sp
      WHERE sp.id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.team_progress_items TO authenticated;

CREATE OR REPLACE FUNCTION public.sync_team_progress_items_for_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.team_progress_items (assignment_id, team_id, task_id)
  SELECT NEW.assignment_id, t.id, NEW.id
  FROM public.teams t
  WHERE t.assignment_id = NEW.assignment_id
  ON CONFLICT (team_id, task_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_team_progress_items_after_task_insert ON public.assignment_progress_tasks;
CREATE TRIGGER sync_team_progress_items_after_task_insert
AFTER INSERT ON public.assignment_progress_tasks
FOR EACH ROW
EXECUTE FUNCTION public.sync_team_progress_items_for_task();

CREATE OR REPLACE FUNCTION public.sync_team_progress_items_for_team()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.assignment_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.team_progress_items (assignment_id, team_id, task_id)
  SELECT NEW.assignment_id, NEW.id, t.id
  FROM public.assignment_progress_tasks t
  WHERE t.assignment_id = NEW.assignment_id
  ON CONFLICT (team_id, task_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_team_progress_items_after_team_insert ON public.teams;
CREATE TRIGGER sync_team_progress_items_after_team_insert
AFTER INSERT OR UPDATE OF assignment_id ON public.teams
FOR EACH ROW
WHEN (NEW.assignment_id IS NOT NULL)
EXECUTE FUNCTION public.sync_team_progress_items_for_team();

INSERT INTO public.team_progress_items (assignment_id, team_id, task_id)
SELECT ap.assignment_id, t.id, ap.id
FROM public.assignment_progress_tasks ap
JOIN public.teams t ON t.assignment_id = ap.assignment_id
ON CONFLICT (team_id, task_id) DO NOTHING;