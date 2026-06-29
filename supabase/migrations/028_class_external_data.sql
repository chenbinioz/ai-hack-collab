-- Class-scoped external learning data (layered CSV uploads + precomputed insights)
-- Run after 027. Safe to run multiple times.

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.class_external_data_layers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  layer_number integer NOT NULL CHECK (layer_number > 0),
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  uploaded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  processed_at timestamptz,
  process_status text NOT NULL DEFAULT 'pending' CHECK (process_status IN ('pending', 'processing', 'completed', 'failed')),
  process_error text,
  UNIQUE (class_id, layer_number)
);

CREATE INDEX IF NOT EXISTS idx_class_external_data_layers_class_id
  ON public.class_external_data_layers(class_id);

CREATE TABLE IF NOT EXISTS public.class_external_data_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  layer_id uuid NOT NULL REFERENCES public.class_external_data_layers(id) ON DELETE CASCADE,
  file_type text NOT NULL,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  row_count integer NOT NULL DEFAULT 0 CHECK (row_count >= 0),
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (layer_id, file_type)
);

CREATE INDEX IF NOT EXISTS idx_class_external_data_files_layer_id
  ON public.class_external_data_files(layer_id);

CREATE TABLE IF NOT EXISTS public.class_external_student_insights (
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  external_person_id text NOT NULL,
  insights jsonb NOT NULL DEFAULT '{}'::jsonb,
  computed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (class_id, external_person_id)
);

CREATE INDEX IF NOT EXISTS idx_class_external_student_insights_class_id
  ON public.class_external_student_insights(class_id);

-- ---------------------------------------------------------------------------
-- 2. RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.class_external_data_layers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_external_data_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_external_student_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Educators can view class external data layers" ON public.class_external_data_layers;
CREATE POLICY "Educators can view class external data layers"
  ON public.class_external_data_layers FOR SELECT TO authenticated
  USING (
    class_id IN (SELECT c.id FROM public.classes c WHERE c.educator_id = auth.uid())
  );

DROP POLICY IF EXISTS "Educators can insert class external data layers" ON public.class_external_data_layers;
CREATE POLICY "Educators can insert class external data layers"
  ON public.class_external_data_layers FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND class_id IN (SELECT c.id FROM public.classes c WHERE c.educator_id = auth.uid())
  );

DROP POLICY IF EXISTS "Educators can update class external data layers" ON public.class_external_data_layers;
CREATE POLICY "Educators can update class external data layers"
  ON public.class_external_data_layers FOR UPDATE TO authenticated
  USING (
    class_id IN (SELECT c.id FROM public.classes c WHERE c.educator_id = auth.uid())
  );

DROP POLICY IF EXISTS "Educators can view class external data files" ON public.class_external_data_files;
CREATE POLICY "Educators can view class external data files"
  ON public.class_external_data_files FOR SELECT TO authenticated
  USING (
    layer_id IN (
      SELECT l.id FROM public.class_external_data_layers l
      JOIN public.classes c ON c.id = l.class_id
      WHERE c.educator_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Educators can insert class external data files" ON public.class_external_data_files;
CREATE POLICY "Educators can insert class external data files"
  ON public.class_external_data_files FOR INSERT TO authenticated
  WITH CHECK (
    layer_id IN (
      SELECT l.id FROM public.class_external_data_layers l
      JOIN public.classes c ON c.id = l.class_id
      WHERE c.educator_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Educators can update class external data files" ON public.class_external_data_files;
CREATE POLICY "Educators can update class external data files"
  ON public.class_external_data_files FOR UPDATE TO authenticated
  USING (
    layer_id IN (
      SELECT l.id FROM public.class_external_data_layers l
      JOIN public.classes c ON c.id = l.class_id
      WHERE c.educator_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Educators can view class external student insights" ON public.class_external_student_insights;
CREATE POLICY "Educators can view class external student insights"
  ON public.class_external_student_insights FOR SELECT TO authenticated
  USING (
    class_id IN (SELECT c.id FROM public.classes c WHERE c.educator_id = auth.uid())
  );

GRANT SELECT, INSERT, UPDATE ON public.class_external_data_layers TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.class_external_data_files TO authenticated;
GRANT SELECT ON public.class_external_student_insights TO authenticated;

GRANT ALL ON public.class_external_data_layers TO service_role;
GRANT ALL ON public.class_external_data_files TO service_role;
GRANT ALL ON public.class_external_student_insights TO service_role;

-- ---------------------------------------------------------------------------
-- 3. Storage bucket
-- Path: class-external-data/{classId}/{layerId}/{fileType}.csv
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'class-external-data',
  'class-external-data',
  false,
  52428800,
  ARRAY['text/csv', 'text/plain', 'application/vnd.ms-excel']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Educators can upload class external data files" ON storage.objects;
CREATE POLICY "Educators can upload class external data files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'class-external-data'
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT c.id FROM public.classes c WHERE c.educator_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Educators can read class external data files" ON storage.objects;
CREATE POLICY "Educators can read class external data files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'class-external-data'
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT c.id FROM public.classes c WHERE c.educator_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Educators can update class external data files" ON storage.objects;
CREATE POLICY "Educators can update class external data files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'class-external-data'
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT c.id FROM public.classes c WHERE c.educator_id = auth.uid()
    )
  );

-- Helper: next layer number for a class
CREATE OR REPLACE FUNCTION public.next_class_external_data_layer_number(p_class_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(MAX(l.layer_number), 0) + 1
  FROM public.class_external_data_layers l
  WHERE l.class_id = p_class_id;
$$;

ALTER FUNCTION public.next_class_external_data_layer_number(uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.next_class_external_data_layer_number(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_class_external_data_layer_number(uuid) TO service_role;
