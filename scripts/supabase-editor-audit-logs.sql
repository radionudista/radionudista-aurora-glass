-- Logs de actividad del editor (quién hizo qué). Solo master lee vía API.
-- Ejecutar en Supabase → SQL Editor.

CREATE TABLE IF NOT EXISTS public.editor_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  actor_email text NULL,
  action text NOT NULL,
  target_type text NULL,
  target_id text NULL,
  summary text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS editor_audit_logs_created_at_idx
  ON public.editor_audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS editor_audit_logs_actor_user_id_idx
  ON public.editor_audit_logs (actor_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS editor_audit_logs_action_idx
  ON public.editor_audit_logs (action);

ALTER TABLE public.editor_audit_logs ENABLE ROW LEVEL SECURITY;

-- Sin políticas para authenticated: lectura/escritura solo vía service_role (Functions).
-- Opcional: master podría leer con JWT en el futuro; hoy todo pasa por admin/list-audit-logs.

GRANT SELECT, INSERT ON public.editor_audit_logs TO service_role;
