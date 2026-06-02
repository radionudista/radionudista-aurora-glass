# Gestión de Contenido

El sitio usa **Supabase** como única fuente de verdad en runtime. Páginas, programas, episodios y textos editoriales (home, about, contact) viven en Postgres y se leen con la clave anon; el editor autenticado escribe directamente desde el browser (RLS).

## Flujo

- **Sitio público:** `PublicContentProvider` carga `content_items`, traducciones y `site_editorial` al iniciar.
- **Editor:** login en `/editor-login` con usuario Supabase Auth; guardar/publicar hace upsert en DB (sin redeploy).
- **Roles:** `admin` (todo el sitio) y `editor` (un solo programa). Perfiles en `editor_profiles`; panel de usuarios en `/admin/usuarios` (solo admin).
- **Import / disaster recovery:** `npm run seed:supabase` lee JSON de respaldo en `scripts/backup-json/` (no archivos servidos por la app).

## Tablas principales

| Tabla | Uso |
|-------|-----|
| `content_items` + `content_item_translations` | Páginas y programas (título, slug, cuerpo markdown en `body`); columna `content_kind`: `program` \| `event` |
| `episodes` + `episode_translations` | Episodios por programa (`deleted_at` = papelera) |
| `site_editorial` | JSON home / about / contact |
| `editor_translate_usage` | Cuota mensual de traducción automática |

## Seed

```bash
# Upsert vía API (service role o login editor)
npm run seed:supabase

# Solo preview
npm run seed:supabase:dry
```

Copias de respaldo: `scripts/backup-json/contentIndex.json`, `scripts/backup-json/editor/home-about-contact.json`, `scripts/backup-json/episodes/*.json`.

### Migración obligatoria: roles editor / admin

Ejecutar **una vez** en el SQL Editor de Supabase: [`scripts/supabase-editor-roles-migration.sql`](../../scripts/supabase-editor-roles-migration.sql).

- Crea `editor_profiles` y políticas RLS por programa.
- Los usuarios ya existentes en Auth pasan a `admin` automáticamente.
- Crear editores nuevos: `/admin/usuarios` (requiere `SUPABASE_SERVICE_ROLE_KEY` en Functions).

### Migración obligatoria: `content_kind`

Si el editor o el sitio fallan con:

`Could not find the 'content_kind' column of 'content_items' in the schema cache`

ejecutá **una vez** en el SQL Editor de Supabase: [`scripts/supabase-content-kind-migration.sql`](../../scripts/supabase-content-kind-migration.sql).

Si al crear un **evento** falla con `violates check constraint "program_order_for_programs"`, ejecutá además (o solo): [`scripts/supabase-program-order-constraint-fix.sql`](../../scripts/supabase-program-order-constraint-fix.sql).

Los archivos Markdown en `src/content/` ya no alimentan el build; pueden conservarse como archivo histórico.

## Imágenes (Supabase Storage)

Logos y portadas **no** van en Postgres como binario: se suben a Storage y en la DB queda la URL.

| Bucket | Columna Postgres | Uso |
|--------|------------------|-----|
| `program-logos` | `content_items.logo_url` | Logo del programa |
| `episode-covers` | `episodes.cover_image_url` | Portada del episodio |
| `episode-audio` | (legacy) episodios subidos antes del retorno a Archive.org | 

### Audio de episodios (Archive.org)

1. El editor convierte WAV/FLAC a **MP3 128 kbps** en el navegador.
2. La Function devuelve URL + headers para un PUT directo a `s3.us.archive.org` (el archivo **no** pasa por Cloudflare).
3. La URL final queda en `episodes.audio_url`; el identificador IA en `archive_identifier`.

Requisitos: `IA_ACCESS_KEY`, `IA_SECRET_KEY` e `IA_COLLECTION` en Functions (ver [`docs/deployment.md`](../deployment.md)).

### Configuración (una vez por proyecto Supabase)

1. Abrir [Supabase Dashboard](https://supabase.com/dashboard) → tu proyecto → **SQL Editor**.
2. Pegar y ejecutar el script [`scripts/supabase-storage-setup.sql`](../../scripts/supabase-storage-setup.sql).
3. Verificar en **Storage** que aparecen los buckets (públicos).
4. Probar: login en `/editor-login` → subir logo y portada → en incógnito debe verse la URL `...supabase.co/storage/v1/object/public/...`.

Imágenes legacy (`2.png` en `/public/images/logos/`) siguen funcionando hasta que subís una nueva desde el editor.

## Edge (secretos)

Solo dos rutas requieren el servidor (JWT Supabase):

- `POST /__dev/editor/prepare-archive-audio-upload` — permiso PUT directo a Archive.org
- `POST /__dev/editor/translate-text` — LibreTranslate / Google

El audio se convierte a MP3 en el navegador y se sube directo a Archive.org (un salto).
