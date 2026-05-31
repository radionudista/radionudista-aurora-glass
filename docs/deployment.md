# Deployment

This guide explains how to deploy Nudista Radio Aura Glass to any static hosting provider, with special notes for multilingual/static content and environment variables.

---

## 1. Build for Production

Run:
```bash
bun run build
# or npm run build
```
This generates a `dist/` directory with all static files (HTML, JS, CSS, images, content.json, etc). All language/content routing is pre-generated.

## 2. Choose a Hosting Provider

Any static site host will work, e.g.:
- [Cloudflare Pages](https://pages.cloudflare.com/)
- [Vercel](https://vercel.com/)
- [Netlify](https://www.netlify.com/)
- [GitHub Pages](https://pages.github.com/)
- [AWS S3 + CloudFront](https://aws.amazon.com/s3/)
- [Firebase Hosting](https://firebase.google.com/docs/hosting)

You can use manual upload or connect your Git repo for continuous deployment.

## 3. Configure Environment Variables

**Important:** Set all required `VITE_` variables in your provider's dashboard. See [Environment Variables](./environment-variables.md) for a full list. Key ones:
- `VITE_TWITCH_CHANNEL`, `VITE_TWITCH_STATIC_PARENTS`, `VITE_STREAM_URL`
- `VITE_LAUNCHING_DATE`, `VITE_SUPPORTED_LANGUAGES`, `VITE_DEFAULT_LANGUAGE`
- Any others used for content, radio, or debug

If deploying to a custom domain, set `VITE_TWITCH_STATIC_PARENTS` to include your domain.

## 4. Deploy

### Manual
Upload the contents of `dist/` to your static host.

### Continuous Deployment (Recommended)
1. Push your repo to GitHub/GitLab/Bitbucket.
2. Connect to your hosting provider.
3. Set build command: `bun run build` or `npm run build`
4. Set publish directory: `dist`
5. Set install command: `bun install` or `npm install`
6. Add all required environment variables.
7. Deploy!

## Multilingual & Static Content Notes

- All language routes and content are pre-generated at build time. No server-side logic is needed.
- Adding a new language or content file? Just add it and rebuild/deploy.
- `public/content.json` is auto-generated and used for dynamic navigation/content.

## Example: Cloudflare Pages

1. Connect your repo and set build command to `bun run build` (or `npm run build` if Bun is not supported).
2. Set publish directory to `dist`.
3. Add all required `VITE_` environment variables.
4. Deploy. Your site will be live at `https://your-project.pages.dev` or your custom domain.

## Editor en producción (Cloudflare Pages)

El editor usa **Supabase Auth** en el cliente y escribe directo a Postgres (RLS). Las Functions solo exponen secretos de traducción.

### Variables de build (`VITE_*`)

| Variable | Uso |
|----------|-----|
| `VITE_SUPABASE_URL` | URL del proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | clave anon (lectura pública + sesión editor) |

### Secretos de Functions (no expuestos al cliente)

| Variable | Uso |
|----------|-----|
| `SUPABASE_URL` | validar JWT del editor |
| `SUPABASE_ANON_KEY` | validar JWT del editor |
| `SUPABASE_SERVICE_ROLE_KEY` | cuota de traducción en `editor_translate_usage` |
| `IA_ACCESS_KEY` / `IA_SECRET_KEY` | subida directa de audio a Archive.org |
| `IA_COLLECTION` | colección IA (ej. `opensource_audio`) |
| `TRANSLATE_API_URL` / `TRANSLATE_API_KEY` | botón TRADUCIR (opcional) |
| `EDITOR_TRANSLATE_MONTHLY_CHAR_LIMIT` | límite mensual de caracteres |

### Comportamiento

- **`/editor-login`** → email + contraseña Supabase Auth.
- **Guardar / Aceptar** → upsert directo en Supabase (visible al instante, sin redeploy).
- **Imágenes** → Supabase Storage (`program-logos`, `episode-covers`). Ejecutar una vez [`scripts/supabase-storage-setup.sql`](../scripts/supabase-storage-setup.sql) en el SQL Editor del proyecto.
- **Audio de episodios** → MP3 directo a Archive.org desde el navegador (`prepare-archive-audio-upload` + PUT a `s3.us.archive.org`).
- **`POST /__dev/editor/prepare-archive-audio-upload`** — permiso para subir MP3 directo a Archive.org (JWT editor)
- **`POST /__dev/editor/translate-text`** → requiere `Authorization: Bearer <jwt>`.

El audio se convierte a **MP3 en el navegador** y se sube **directo a Archive.org** (un salto, sin pasar el archivo por la Function).

---
For more, see [Usage & Build](./usage.md) and [Environment Variables](./environment-variables.md).
## Example: Deploying to Vercel
