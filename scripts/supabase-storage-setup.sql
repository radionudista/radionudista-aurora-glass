-- Supabase Storage: logos, portadas y audio de episodios
-- Ejecutar una vez en: Supabase Dashboard → SQL Editor → New query → Run
--
-- Requisitos previos:
--   - Usuario editor creado en Authentication (login en /editor-login)
--   - RLS de Postgres ya permite UPDATE en content_items.logo_url y episodes.cover_image_url
--
-- La app sube imágenes con upsert desde el browser (usuario autenticado) y guarda la URL pública en Postgres.

-- ---------------------------------------------------------------------------
-- 1. Buckets (públicos: cualquier visitante puede cargar la URL de la imagen)
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('program-logos', 'program-logos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public)
VALUES ('episode-covers', 'episode-covers', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('episode-audio', 'episode-audio', true, 536870912)
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 536870912;

-- ---------------------------------------------------------------------------
-- 2. Policies en storage.objects (idempotente: borra y recrea)
-- ---------------------------------------------------------------------------

-- program-logos: lectura pública
DROP POLICY IF EXISTS "program_logos_public_read" ON storage.objects;
CREATE POLICY "program_logos_public_read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'program-logos');

-- program-logos: subida / reemplazo (editor autenticado; upload usa upsert)
DROP POLICY IF EXISTS "program_logos_authenticated_insert" ON storage.objects;
CREATE POLICY "program_logos_authenticated_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'program-logos');

DROP POLICY IF EXISTS "program_logos_authenticated_update" ON storage.objects;
CREATE POLICY "program_logos_authenticated_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'program-logos')
WITH CHECK (bucket_id = 'program-logos');

DROP POLICY IF EXISTS "program_logos_authenticated_delete" ON storage.objects;
CREATE POLICY "program_logos_authenticated_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'program-logos');

-- episode-covers: lectura pública
DROP POLICY IF EXISTS "episode_covers_public_read" ON storage.objects;
CREATE POLICY "episode_covers_public_read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'episode-covers');

-- episode-covers: subida / reemplazo
DROP POLICY IF EXISTS "episode_covers_authenticated_insert" ON storage.objects;
CREATE POLICY "episode_covers_authenticated_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'episode-covers');

DROP POLICY IF EXISTS "episode_covers_authenticated_update" ON storage.objects;
CREATE POLICY "episode_covers_authenticated_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'episode-covers')
WITH CHECK (bucket_id = 'episode-covers');

DROP POLICY IF EXISTS "episode_covers_authenticated_delete" ON storage.objects;
CREATE POLICY "episode_covers_authenticated_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'episode-covers');

-- episode-audio: lectura pública
DROP POLICY IF EXISTS "episode_audio_public_read" ON storage.objects;
CREATE POLICY "episode_audio_public_read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'episode-audio');

-- episode-audio: subida / reemplazo
DROP POLICY IF EXISTS "episode_audio_authenticated_insert" ON storage.objects;
CREATE POLICY "episode_audio_authenticated_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'episode-audio');

DROP POLICY IF EXISTS "episode_audio_authenticated_update" ON storage.objects;
CREATE POLICY "episode_audio_authenticated_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'episode-audio')
WITH CHECK (bucket_id = 'episode-audio');

DROP POLICY IF EXISTS "episode_audio_authenticated_delete" ON storage.objects;
CREATE POLICY "episode_audio_authenticated_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'episode-audio');
