# Change: Roles editor y admin (RBAC por programa)

## Why

Varios colaboradores deben editar solo su programa sin tocar el resto del sitio ni la configuración global.

## What Changes

- Tabla `editor_profiles` con roles `admin` y `editor`
- RLS en Postgres y Storage acotado por `program_id`
- Panel `/admin/usuarios` para altas y asignación de programa
- Guards en cliente y Cloudflare Functions

## Impact

- Affected code: `EditorContext`, editor Functions, páginas de edición, `scripts/supabase-editor-roles-migration.sql`
- Requiere ejecutar migración SQL en Supabase antes de usar en producción
