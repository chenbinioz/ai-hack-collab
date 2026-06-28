-- File attachments for assignments and team chat messages.
-- Adds storage buckets, metadata tables, updated messaging RPCs.

-- ---------------------------------------------------------------------------
-- 1. Assignment attachments
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.assignment_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes > 0),
  uploaded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Legacy column names from earlier schema iterations
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'assignment_attachments'
      AND column_name = 'file_path'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'assignment_attachments'
      AND column_name = 'storage_path'
  ) THEN
    ALTER TABLE public.assignment_attachments RENAME COLUMN file_path TO storage_path;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'assignment_attachments'
      AND column_name = 'file_size'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'assignment_attachments'
      AND column_name = 'size_bytes'
  ) THEN
    ALTER TABLE public.assignment_attachments RENAME COLUMN file_size TO size_bytes;
    ALTER TABLE public.assignment_attachments ALTER COLUMN size_bytes TYPE bigint;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_assignment_attachments_assignment_id
  ON public.assignment_attachments(assignment_id);

ALTER TABLE public.assignment_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Educators and enrolled students can view assignment attachments"
  ON public.assignment_attachments;
CREATE POLICY "Educators and enrolled students can view assignment attachments"
  ON public.assignment_attachments FOR SELECT TO authenticated
  USING (
    assignment_id IN (
      SELECT a.id FROM public.assignments a
      JOIN public.classes c ON c.id = a.class_id
      WHERE c.educator_id = auth.uid()
    )
    OR assignment_id IN (
      SELECT a.id FROM public.assignments a
      JOIN public.class_enrollments ce ON ce.class_id = a.class_id
      WHERE ce.student_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Educators can insert assignment attachments"
  ON public.assignment_attachments;
CREATE POLICY "Educators can insert assignment attachments"
  ON public.assignment_attachments FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND assignment_id IN (
      SELECT a.id FROM public.assignments a
      JOIN public.classes c ON c.id = a.class_id
      WHERE c.educator_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Educators can delete assignment attachments"
  ON public.assignment_attachments;
CREATE POLICY "Educators can delete assignment attachments"
  ON public.assignment_attachments FOR DELETE TO authenticated
  USING (
    assignment_id IN (
      SELECT a.id FROM public.assignments a
      JOIN public.classes c ON c.id = a.class_id
      WHERE c.educator_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, DELETE ON public.assignment_attachments TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Message attachments (1:1 with messages)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.message_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL UNIQUE REFERENCES public.messages(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_message_attachments_message_id
  ON public.message_attachments(message_id);

ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team members can view message attachments"
  ON public.message_attachments;
CREATE POLICY "Team members can view message attachments"
  ON public.message_attachments FOR SELECT TO authenticated
  USING (
    message_id IN (
      SELECT m.id FROM public.messages m
      WHERE m.team_id IN (
        SELECT tm.team_id FROM public.team_members tm WHERE tm.student_id = auth.uid()
      )
      OR m.team_id IN (
        SELECT sp.team_id FROM public.student_profiles sp
        WHERE sp.id = auth.uid() AND sp.team_id IS NOT NULL
      )
    )
  );

DROP POLICY IF EXISTS "Team members can insert message attachments"
  ON public.message_attachments;
CREATE POLICY "Team members can insert message attachments"
  ON public.message_attachments FOR INSERT TO authenticated
  WITH CHECK (
    message_id IN (
      SELECT m.id FROM public.messages m
      WHERE m.sender_id = auth.uid()
        AND (
          m.team_id IN (
            SELECT tm.team_id FROM public.team_members tm WHERE tm.student_id = auth.uid()
          )
          OR m.team_id IN (
            SELECT sp.team_id FROM public.student_profiles sp
            WHERE sp.id = auth.uid() AND sp.team_id IS NOT NULL
          )
        )
    )
  );

GRANT SELECT, INSERT ON public.message_attachments TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Relax messages.content (empty allowed when attachment exists via RPC)
-- ---------------------------------------------------------------------------

ALTER TABLE public.messages ALTER COLUMN content SET DEFAULT '';

-- ---------------------------------------------------------------------------
-- 4. Storage buckets
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'assignment-files',
    'assignment-files',
    false,
    10485760,
    ARRAY[
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/png',
      'image/jpeg',
      'image/gif',
      'image/webp',
      'text/plain',
      'text/csv'
    ]
  ),
  (
    'chat-files',
    'chat-files',
    false,
    10485760,
    ARRAY[
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/png',
      'image/jpeg',
      'image/gif',
      'image/webp',
      'text/plain',
      'text/csv'
    ]
  )
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- 5. Storage RLS policies
-- Path conventions:
--   assignment-files/{assignmentId}/{attachmentId}/{filename}
--   chat-files/{teamId}/{messageId}/{filename}
-- ---------------------------------------------------------------------------

-- Assignment files: educator upload
DROP POLICY IF EXISTS "Educators can upload assignment files" ON storage.objects;
CREATE POLICY "Educators can upload assignment files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'assignment-files'
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT a.id FROM public.assignments a
      JOIN public.classes c ON c.id = a.class_id
      WHERE c.educator_id = auth.uid()
    )
  );

-- Assignment files: educator + enrolled students read
DROP POLICY IF EXISTS "Educators and students can read assignment files" ON storage.objects;
CREATE POLICY "Educators and students can read assignment files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'assignment-files'
    AND (
      (storage.foldername(name))[1]::uuid IN (
        SELECT a.id FROM public.assignments a
        JOIN public.classes c ON c.id = a.class_id
        WHERE c.educator_id = auth.uid()
      )
      OR (storage.foldername(name))[1]::uuid IN (
        SELECT a.id FROM public.assignments a
        JOIN public.class_enrollments ce ON ce.class_id = a.class_id
        WHERE ce.student_id = auth.uid()
      )
    )
  );

-- Assignment files: educator delete
DROP POLICY IF EXISTS "Educators can delete assignment files" ON storage.objects;
CREATE POLICY "Educators can delete assignment files"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'assignment-files'
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT a.id FROM public.assignments a
      JOIN public.classes c ON c.id = a.class_id
      WHERE c.educator_id = auth.uid()
    )
  );

-- Assignment files: upsert support
DROP POLICY IF EXISTS "Educators can update assignment files" ON storage.objects;
CREATE POLICY "Educators can update assignment files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'assignment-files'
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT a.id FROM public.assignments a
      JOIN public.classes c ON c.id = a.class_id
      WHERE c.educator_id = auth.uid()
    )
  );

-- Chat files: team members upload
DROP POLICY IF EXISTS "Team members can upload chat files" ON storage.objects;
CREATE POLICY "Team members can upload chat files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-files'
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT tm.team_id FROM public.team_members tm WHERE tm.student_id = auth.uid()
      UNION
      SELECT sp.team_id FROM public.student_profiles sp
      WHERE sp.id = auth.uid() AND sp.team_id IS NOT NULL
    )
  );

-- Chat files: team members read
DROP POLICY IF EXISTS "Team members can read chat files" ON storage.objects;
CREATE POLICY "Team members can read chat files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat-files'
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT tm.team_id FROM public.team_members tm WHERE tm.student_id = auth.uid()
      UNION
      SELECT sp.team_id FROM public.student_profiles sp
      WHERE sp.id = auth.uid() AND sp.team_id IS NOT NULL
    )
  );

-- Chat files: upsert support
DROP POLICY IF EXISTS "Team members can update chat files" ON storage.objects;
CREATE POLICY "Team members can update chat files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'chat-files'
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT tm.team_id FROM public.team_members tm WHERE tm.student_id = auth.uid()
      UNION
      SELECT sp.team_id FROM public.student_profiles sp
      WHERE sp.id = auth.uid() AND sp.team_id IS NOT NULL
    )
  );

-- ---------------------------------------------------------------------------
-- 6. Updated get_team_messages with team_id param + attachment fields
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.get_team_messages();
DROP FUNCTION IF EXISTS public.get_team_messages(uuid);

CREATE OR REPLACE FUNCTION public.get_team_messages(p_team_id uuid)
RETURNS TABLE (
  id uuid,
  team_id uuid,
  sender_id uuid,
  sender_name text,
  content text,
  created_at timestamptz,
  attachment_id uuid,
  file_name text,
  mime_type text,
  size_bytes bigint,
  storage_path text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    m.id,
    m.team_id,
    m.sender_id,
    sp.survey_name AS sender_name,
    m.content,
    m.created_at,
    ma.id AS attachment_id,
    ma.file_name,
    ma.mime_type,
    ma.size_bytes,
    ma.storage_path
  FROM public.messages m
  JOIN public.student_profiles sp ON m.sender_id = sp.id
  LEFT JOIN public.message_attachments ma ON ma.message_id = m.id
  WHERE m.team_id = p_team_id
    AND (
      p_team_id IN (SELECT tm.team_id FROM public.team_members tm WHERE tm.student_id = auth.uid())
      OR p_team_id IN (
        SELECT sp2.team_id FROM public.student_profiles sp2
        WHERE sp2.id = auth.uid() AND sp2.team_id IS NOT NULL
      )
    )
  ORDER BY m.created_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_team_messages(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 7. send_team_message RPC — atomic message + optional attachment
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.send_team_message(
  p_team_id uuid,
  p_content text DEFAULT '',
  p_message_id uuid DEFAULT gen_random_uuid(),
  p_file_name text DEFAULT NULL,
  p_mime_type text DEFAULT NULL,
  p_size_bytes bigint DEFAULT NULL,
  p_storage_path text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_has_attachment boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT (
    p_team_id IN (SELECT tm.team_id FROM public.team_members tm WHERE tm.student_id = v_user_id)
    OR p_team_id IN (
      SELECT sp.team_id FROM public.student_profiles sp
      WHERE sp.id = v_user_id AND sp.team_id IS NOT NULL
    )
  ) THEN
    RAISE EXCEPTION 'Not a member of this team';
  END IF;

  v_has_attachment := p_storage_path IS NOT NULL AND length(trim(p_storage_path)) > 0;

  IF length(trim(COALESCE(p_content, ''))) = 0 AND NOT v_has_attachment THEN
    RAISE EXCEPTION 'Message must have text or an attachment';
  END IF;

  IF v_has_attachment THEN
    IF p_file_name IS NULL OR p_mime_type IS NULL OR p_size_bytes IS NULL OR p_size_bytes <= 0 THEN
      RAISE EXCEPTION 'Attachment metadata is incomplete';
    END IF;
  END IF;

  INSERT INTO public.messages (id, team_id, sender_id, content)
  VALUES (p_message_id, p_team_id, v_user_id, COALESCE(p_content, ''));

  IF v_has_attachment THEN
    INSERT INTO public.message_attachments (
      message_id, storage_path, file_name, mime_type, size_bytes
    ) VALUES (
      p_message_id, p_storage_path, p_file_name, p_mime_type, p_size_bytes
    );
  END IF;

  RETURN p_message_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_team_message(uuid, text, uuid, text, text, bigint, text) TO authenticated;
