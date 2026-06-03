-- Rol master: mismos permisos de contenido que admin; solo master crea usuarios (vía API).
-- Ejecutar en Supabase → SQL Editor después de supabase-editor-roles-migration.sql

-- UID del usuario master (único que puede crear cuentas)
-- fe1e83ed-e2d3-4167-9998-91a5e5bb86f4

ALTER TABLE public.editor_profiles DROP CONSTRAINT IF EXISTS editor_profiles_admin_no_program;

ALTER TABLE public.editor_profiles DROP CONSTRAINT IF EXISTS editor_profiles_role_check;

ALTER TABLE public.editor_profiles
  ADD CONSTRAINT editor_profiles_role_check CHECK (role IN ('admin', 'editor', 'master'));

ALTER TABLE public.editor_profiles
  ADD CONSTRAINT editor_profiles_role_program CHECK (
    (role IN ('admin', 'master') AND program_id IS NULL)
    OR (role = 'editor' AND program_id IS NOT NULL)
  );

CREATE OR REPLACE FUNCTION public.is_editor_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_editor_role() IN ('admin', 'master'), false);
$$;

CREATE OR REPLACE FUNCTION public.is_editor_master()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_editor_role() = 'master', false);
$$;

-- Solo master gestiona filas de editor_profiles vía cliente (RLS)
DROP POLICY IF EXISTS editor_profiles_admin_insert ON public.editor_profiles;
DROP POLICY IF EXISTS editor_profiles_admin_update ON public.editor_profiles;
DROP POLICY IF EXISTS editor_profiles_admin_delete ON public.editor_profiles;

CREATE POLICY editor_profiles_master_insert ON public.editor_profiles
FOR INSERT TO authenticated
WITH CHECK (public.is_editor_master());

CREATE POLICY editor_profiles_master_update ON public.editor_profiles
FOR UPDATE TO authenticated
USING (public.is_editor_master())
WITH CHECK (public.is_editor_master());

CREATE POLICY editor_profiles_master_delete ON public.editor_profiles
FOR DELETE TO authenticated
USING (public.is_editor_master());

GRANT EXECUTE ON FUNCTION public.is_editor_master() TO authenticated, service_role;

UPDATE public.editor_profiles
SET role = 'master', program_id = NULL, updated_at = now()
WHERE user_id = 'fe1e83ed-e2d3-4167-9998-91a5e5bb86f4';

INSERT INTO public.editor_profiles (user_id, role, program_id)
SELECT 'fe1e83ed-e2d3-4167-9998-91a5e5bb86f4', 'master', NULL
WHERE EXISTS (SELECT 1 FROM auth.users WHERE id = 'fe1e83ed-e2d3-4167-9998-91a5e5bb86f4')
ON CONFLICT (user_id) DO UPDATE
SET role = 'master', program_id = NULL, updated_at = now();
