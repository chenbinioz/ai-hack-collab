-- Educator-defined names for external data layers
ALTER TABLE public.class_external_data_layers
  ADD COLUMN IF NOT EXISTS name text;

COMMENT ON COLUMN public.class_external_data_layers.name IS
  'Optional educator label; UI falls back to Layer {layer_number} when null.';
