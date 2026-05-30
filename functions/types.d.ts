/** Minimal Cloudflare Pages Functions typing (no wrangler dependency). */
type PagesFunction<Env = unknown> = (context: {
  request: Request;
  env: Env;
  params: Record<string, string | string[] | undefined>;
}) => Response | Promise<Response>;
