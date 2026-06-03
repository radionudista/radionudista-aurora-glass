-- Parche: permisos PostgREST (error 42501 con service_role al crear/editar usuarios)
-- Ejecutar en Supabase → SQL Editor si ya corriste supabase-editor-roles-migration.sql sin GRANT.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.editor_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.editor_profiles TO service_role;

-- FK program_id → content_items: service_role necesita SELECT al INSERT/UPDATE de perfiles
GRANT SELECT ON public.content_items TO service_role;

GRANT EXECUTE ON FUNCTION public.current_editor_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_editor_program_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_editor_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_editor_master() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_editor_active() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_edit_program(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_edit_storage_object(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.editor_storage_program_prefix(text) TO authenticated, service_role;
