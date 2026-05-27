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

## Editor Auto-Publish to Production (`dev` -> `master`)

To let editors publish without manual PR handling:

1. Run the editor host on branch `dev` with:
   - `VITE_EDITOR_ENABLED=true`
   - `EDITOR_GIT_BRANCH=dev`
   - `EDITOR_GITHUB_TOKEN=<PAT with repo write>`
2. Add repository secret `EDITOR_GITHUB_TOKEN` for GitHub Actions (same PAT or bot PAT).
3. Keep branch rules for `master` active, but ensure the token owner can bypass PR approval
   requirements (admin/bypass actor), so auto-merge can complete once checks are green.

Behavior:
- Editor publishes to `dev`
- Actions open/update PR `dev` -> `master`
- `Validate Frontmatter` + `Build` run
- PR auto-merges only if checks pass

---
For more, see [Usage & Build](./usage.md) and [Environment Variables](./environment-variables.md).
## Example: Deploying to Vercel
