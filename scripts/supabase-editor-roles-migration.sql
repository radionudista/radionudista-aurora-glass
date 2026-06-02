-- Editor roles: admin (global) vs editor (single program)
-- Ejecutar en Supabase Dashboard → SQL Editor (después de storage setup si aplica).
--
-- Bootstrap: todos los usuarios auth existentes pasan a role = admin.
-- Nuevos editores: asignar program_id desde /admin/usuarios o INSERT manual.

-- ---------------------------------------------------------------------------
-- 1. Tabla editor_profiles
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.editor_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'editor')),
  program_id text NULL REFERENCES public.content_items (id) ON DELETE SET NULL,
  disabled_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT editor_profiles_admin_no_program CHECK (
    (role = 'admin' AND program_id IS NULL)
    OR (role = 'editor' AND program_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS editor_profiles_program_id_idx ON public.editor_profiles (program_id);

-- Solo programas (no eventos) pueden asignarse a editores
CREATE OR REPLACE FUNCTION public.editor_profiles_validate_program()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.role = 'editor' AND NEW.program_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.content_items ci
      WHERE ci.id = NEW.program_id AND ci.content_kind = 'program'
    ) THEN
      RAISE EXCEPTION 'program_id debe ser un content_items con content_kind = program';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS editor_profiles_validate_program_trg ON public.editor_profiles;
CREATE TRIGGER editor_profiles_validate_program_trg
BEFORE INSERT OR UPDATE ON public.editor_profiles
FOR EACH ROW EXECUTE FUNCTION public.editor_profiles_validate_program();

-- ---------------------------------------------------------------------------
-- 2. Helpers (SECURITY DEFINER para evitar recursión RLS)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_editor_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.editor_profiles
  WHERE user_id = auth.uid() AND disabled_at IS NULL
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_editor_program_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT program_id FROM public.editor_profiles
  WHERE user_id = auth.uid() AND role = 'editor' AND disabled_at IS NULL
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_editor_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_editor_role() = 'admin', false);
$$;

CREATE OR REPLACE FUNCTION public.is_editor_active()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.editor_profiles
    WHERE user_id = auth.uid() AND disabled_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.editor_storage_program_prefix(program_id text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(regexp_replace(COALESCE(program_id, ''), '[^a-zA-Z0-9-]', '-', 'g'));
$$;

CREATE OR REPLACE FUNCTION public.can_edit_program(target_program_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN NOT public.is_editor_active() THEN false
    WHEN public.is_editor_admin() THEN true
    WHEN public.current_editor_program_id() IS NOT NULL
         AND public.current_editor_program_id() = target_program_id THEN true
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.can_edit_storage_object(bucket text, object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN NOT public.is_editor_active() THEN false
    WHEN bucket = 'home-hero' THEN public.is_editor_admin()
    WHEN bucket IN ('program-logos', 'episode-covers', 'episode-audio') THEN
      public.is_editor_admin()
      OR (
        public.current_editor_program_id() IS NOT NULL
        AND lower(object_name) LIKE public.editor_storage_program_prefix(public.current_editor_program_id()) || '-%'
      )
    ELSE false
  END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Bootstrap admins para usuarios Auth existentes
-- ---------------------------------------------------------------------------

INSERT INTO public.editor_profiles (user_id, role, program_id)
SELECT id, 'admin', NULL FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. RLS editor_profiles
-- ---------------------------------------------------------------------------

ALTER TABLE public.editor_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS editor_profiles_select ON public.editor_profiles;
CREATE POLICY editor_profiles_select ON public.editor_profiles
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_editor_admin());

DROP POLICY IF EXISTS editor_profiles_admin_insert ON public.editor_profiles;
CREATE POLICY editor_profiles_admin_insert ON public.editor_profiles
FOR INSERT TO authenticated
WITH CHECK (public.is_editor_admin());

DROP POLICY IF EXISTS editor_profiles_admin_update ON public.editor_profiles;
CREATE POLICY editor_profiles_admin_update ON public.editor_profiles
FOR UPDATE TO authenticated
USING (public.is_editor_admin())
WITH CHECK (public.is_editor_admin());

DROP POLICY IF EXISTS editor_profiles_admin_delete ON public.editor_profiles;
CREATE POLICY editor_profiles_admin_delete ON public.editor_profiles
FOR DELETE TO authenticated
USING (public.is_editor_admin());

-- ---------------------------------------------------------------------------
-- 5. RLS escritura en tablas de contenido (no toca lectura pública existente)
-- ---------------------------------------------------------------------------

ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_item_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.episode_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_editorial ENABLE ROW LEVEL SECURITY;

-- content_items
DROP POLICY IF EXISTS editor_roles_content_items_insert ON public.content_items;
CREATE POLICY editor_roles_content_items_insert ON public.content_items
FOR INSERT TO authenticated
WITH CHECK (public.can_edit_program(id));

DROP POLICY IF EXISTS editor_roles_content_items_update ON public.content_items;
CREATE POLICY editor_roles_content_items_update ON public.content_items
FOR UPDATE TO authenticated
USING (public.can_edit_program(id))
WITH CHECK (public.can_edit_program(id));

DROP POLICY IF EXISTS editor_roles_content_items_delete ON public.content_items;
CREATE POLICY editor_roles_content_items_delete ON public.content_items
FOR DELETE TO authenticated
USING (public.can_edit_program(id));

-- content_item_translations
DROP POLICY IF EXISTS editor_roles_content_item_translations_insert ON public.content_item_translations;
CREATE POLICY editor_roles_content_item_translations_insert ON public.content_item_translations
FOR INSERT TO authenticated
WITH CHECK (public.can_edit_program(content_item_id));

DROP POLICY IF EXISTS editor_roles_content_item_translations_update ON public.content_item_translations;
CREATE POLICY editor_roles_content_item_translations_update ON public.content_item_translations
FOR UPDATE TO authenticated
USING (public.can_edit_program(content_item_id))
WITH CHECK (public.can_edit_program(content_item_id));

DROP POLICY IF EXISTS editor_roles_content_item_translations_delete ON public.content_item_translations;
CREATE POLICY editor_roles_content_item_translations_delete ON public.content_item_translations
FOR DELETE TO authenticated
USING (public.can_edit_program(content_item_id));

-- episodes
DROP POLICY IF EXISTS editor_roles_episodes_insert ON public.episodes;
CREATE POLICY editor_roles_episodes_insert ON public.episodes
FOR INSERT TO authenticated
WITH CHECK (public.can_edit_program(program_id));

DROP POLICY IF EXISTS editor_roles_episodes_update ON public.episodes;
CREATE POLICY editor_roles_episodes_update ON public.episodes
FOR UPDATE TO authenticated
USING (public.can_edit_program(program_id))
WITH CHECK (public.can_edit_program(program_id));

DROP POLICY IF EXISTS editor_roles_episodes_delete ON public.episodes;
CREATE POLICY editor_roles_episodes_delete ON public.episodes
FOR DELETE TO authenticated
USING (public.can_edit_program(program_id));

-- episode_translations (via episodes.program_id)
DROP POLICY IF EXISTS editor_roles_episode_translations_insert ON public.episode_translations;
CREATE POLICY editor_roles_episode_translations_insert ON public.episode_translations
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.episodes e
    WHERE e.id = episode_id AND public.can_edit_program(e.program_id)
  )
);

DROP POLICY IF EXISTS editor_roles_episode_translations_update ON public.episode_translations;
CREATE POLICY editor_roles_episode_translations_update ON public.episode_translations
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.episodes e
    WHERE e.id = episode_id AND public.can_edit_program(e.program_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.episodes e
    WHERE e.id = episode_id AND public.can_edit_program(e.program_id)
  )
);

DROP POLICY IF EXISTS editor_roles_episode_translations_delete ON public.episode_translations;
CREATE POLICY editor_roles_episode_translations_delete ON public.episode_translations
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.episodes e
    WHERE e.id = episode_id AND public.can_edit_program(e.program_id)
  )
);

-- site_editorial: solo admin
DROP POLICY IF EXISTS editor_roles_site_editorial_all ON public.site_editorial;
CREATE POLICY editor_roles_site_editorial_all ON public.site_editorial
FOR ALL TO authenticated
USING (public.is_editor_admin())
WITH CHECK (public.is_editor_admin());

-- ---------------------------------------------------------------------------
-- 6. Storage: reemplazar políticas authenticated por rol/programa
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS program_logos_authenticated_insert ON storage.objects;
CREATE POLICY program_logos_authenticated_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'program-logos'
  AND public.can_edit_storage_object(bucket_id, name)
);

DROP POLICY IF EXISTS program_logos_authenticated_update ON storage.objects;
CREATE POLICY program_logos_authenticated_update ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'program-logos' AND public.can_edit_storage_object(bucket_id, name))
WITH CHECK (bucket_id = 'program-logos' AND public.can_edit_storage_object(bucket_id, name));

DROP POLICY IF EXISTS program_logos_authenticated_delete ON storage.objects;
CREATE POLICY program_logos_authenticated_delete ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'program-logos' AND public.can_edit_storage_object(bucket_id, name));

DROP POLICY IF EXISTS episode_covers_authenticated_insert ON storage.objects;
CREATE POLICY episode_covers_authenticated_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'episode-covers'
  AND public.can_edit_storage_object(bucket_id, name)
);

DROP POLICY IF EXISTS episode_covers_authenticated_update ON storage.objects;
CREATE POLICY episode_covers_authenticated_update ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'episode-covers' AND public.can_edit_storage_object(bucket_id, name))
WITH CHECK (bucket_id = 'episode-covers' AND public.can_edit_storage_object(bucket_id, name));

DROP POLICY IF EXISTS episode_covers_authenticated_delete ON storage.objects;
CREATE POLICY episode_covers_authenticated_delete ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'episode-covers' AND public.can_edit_storage_object(bucket_id, name));

DROP POLICY IF EXISTS episode_audio_authenticated_insert ON storage.objects;
CREATE POLICY episode_audio_authenticated_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'episode-audio'
  AND public.can_edit_storage_object(bucket_id, name)
);

DROP POLICY IF EXISTS episode_audio_authenticated_update ON storage.objects;
CREATE POLICY episode_audio_authenticated_update ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'episode-audio' AND public.can_edit_storage_object(bucket_id, name))
WITH CHECK (bucket_id = 'episode-audio' AND public.can_edit_storage_object(bucket_id, name));

DROP POLICY IF EXISTS episode_audio_authenticated_delete ON storage.objects;
CREATE POLICY episode_audio_authenticated_delete ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'episode-audio' AND public.can_edit_storage_object(bucket_id, name));

DROP POLICY IF EXISTS home_hero_authenticated_insert ON storage.objects;
CREATE POLICY home_hero_authenticated_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'home-hero' AND public.can_edit_storage_object(bucket_id, name));

DROP POLICY IF EXISTS home_hero_authenticated_update ON storage.objects;
CREATE POLICY home_hero_authenticated_update ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'home-hero' AND public.can_edit_storage_object(bucket_id, name))
WITH CHECK (bucket_id = 'home-hero' AND public.can_edit_storage_object(bucket_id, name));

DROP POLICY IF EXISTS home_hero_authenticated_delete ON storage.objects;
CREATE POLICY home_hero_authenticated_delete ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'home-hero' AND public.can_edit_storage_object(bucket_id, name));

-- Nota: si tras migrar un editor aún puede escribir en tablas ajenas, revisá en Dashboard
-- políticas authenticated heredadas y eliminá las permisivas que no empiecen por editor_roles_.
