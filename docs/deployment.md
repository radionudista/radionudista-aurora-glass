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

El login con hash funciona en prod si configurás **variables del cliente** (build) y **secretos del servidor** (Functions):

### Variables de build (`VITE_*` en Cloudflare Pages)

| Variable | Valor |
|----------|--------|
| `VITE_EDITOR_ENABLED` | `true` |
| `VITE_EDITOR_SALT` | mismo salt que en local |
| `VITE_EDITOR_PASSWORD_HASH` | hash SHA-256 de `salt+contraseña` |

### Secretos de Functions (Settings → Environment variables, **no** expuestos al cliente)

| Variable | Uso |
|----------|-----|
| `EDITOR_PASSWORD_HASH` | mismo valor que `VITE_EDITOR_PASSWORD_HASH` (valida el token en `/__dev/editor/*`) |
| `EDITOR_GITHUB_TOKEN` | PAT con permiso `repo` para commitear JSON e imágenes |
| `EDITOR_GITHUB_REPO` | `owner/repo` (ej. `tu-org/radionudista-web`) |
| `EDITOR_GIT_BRANCH` | `master` (prod directo; Cloudflare redeploy automático) |
| `IA_ACCESS_KEY` / `IA_SECRET_KEY` | subida de episodios a Archive.org |
| `IA_COLLECTION` | colección IA (ej. `opensource_audio`) |
| `TRANSLATE_API_URL` / `TRANSLATE_API_KEY` | botón TRADUCIR del editor (opcional) |
| `EDITOR_TRANSLATE_MONTHLY_CHAR_LIMIT` | límite mensual de caracteres traducidos |

Local y prod usan la **misma API** (`/__dev/editor/*`) y los mismos endpoints; local escribe en disco + git push, prod commitea vía GitHub API.

### Comportamiento

- **`/editor-login`** → login con contraseña (hash en cliente).
- **Aceptar** → POST `/__dev/editor/save` → commit directo a GitHub (rama `master`).
- No hay botón «Publicar GitHub» en prod (solo en local, para hacer `git push` tras guardar en disco).

En **local** (`npm run dev`), el plugin Vite escribe en disco; **Publicar GitHub** hace el push. En **prod**, cada **Aceptar** ya commitea a GitHub (no hay disco intermedio).

### Publicación automática a producción (`master`)

1. Configurá los secretos anteriores en Cloudflare con `EDITOR_GIT_BRANCH=master`.
2. El PAT de `EDITOR_GITHUB_TOKEN` debe poder **escribir en `master`** (usuario admin o bypass del ruleset «prod env»).
3. Cada guardado commitea a `master` → Cloudflare Pages rebuilda → cambios visibles en radionudista.com (~1–3 min).
4. GitHub Actions valida frontmatter/build en push a `master` (avisos si algo falla; el deploy ya puede estar en curso).

---
For more, see [Usage & Build](./usage.md) and [Environment Variables](./environment-variables.md).
## Example: Deploying to Vercel
