# Content Management

The site uses **Supabase** as the single source of truth at runtime. Pages, programs, episodes, and editorial copy (home, about, contact) live in Postgres and are read with the anon key; the authenticated editor writes directly from the browser (RLS).

## Flow

- **Public site:** `PublicContentProvider` loads `content_items`, translations, and `site_editorial` on startup.
- **Editor:** sign in at `/editor-login` with a Supabase Auth user; save/publish upserts into the DB (no redeploy).
- **Import / disaster recovery:** `npm run seed:supabase` reads backup JSON from `scripts/backup-json/` (not app-served files).

## Main tables

| Table | Purpose |
|-------|---------|
| `content_items` + `content_item_translations` | Pages and programs (title, slug, markdown body in `body`) |
| `episodes` + `episode_translations` | Episodes per program (`deleted_at` = trash) |
| `site_editorial` | Home / about / contact JSON |
| `editor_translate_usage` | Monthly auto-translation quota |

## Seed

```bash
npm run seed:supabase
npm run seed:supabase:dry
```

Backup copies: `scripts/backup-json/contentIndex.json`, `scripts/backup-json/editor/home-about-contact.json`, `scripts/backup-json/episodes/*.json`.

Markdown under `src/content/` no longer feeds the build; it may remain as historical archive.

## Edge (secrets only)

Dos rutas requieren el servidor (JWT Supabase):

- `POST /__dev/editor/prepare-archive-audio-upload` — permiso PUT directo a Archive.org
- `POST /__dev/editor/translate-text` — LibreTranslate / Google

Episode audio: convert to MP3 in the browser, then upload **directly to Archive.org** (single hop).
