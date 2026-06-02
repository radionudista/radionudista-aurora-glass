import { assertSupabaseJwtAuthorized, jsonResponse } from '../../_shared/supabaseJwtAuth';
import { handleEditorRoute } from '../../_shared/editor/handlers';

interface Env {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  IA_ACCESS_KEY?: string;
  IA_SECRET_KEY?: string;
  IA_COLLECTION?: string;
  TRANSLATE_API_KEY?: string;
  GOOGLE_TRANSLATE_API_KEY?: string;
  TRANSLATE_API_URL?: string;
  GOOGLE_TRANSLATE_API_URL?: string;
  EDITOR_TRANSLATE_MONTHLY_CHAR_LIMIT?: string;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  const subpath = Array.isArray(params.path) ? params.path.join('/') : String(params.path ?? '');

  const authError = await assertSupabaseJwtAuthorized(request, env);
  if (authError) return authError;

  const isAudioProxy = request.method === 'POST' && subpath === 'upload-episode-audio-proxy';
  let body: unknown = {};
  let binaryBody: ArrayBuffer | undefined;

  if (isAudioProxy) {
    binaryBody = await request.arrayBuffer();
  } else if (request.method !== 'GET') {
    try {
      body = await request.json();
    } catch {
      return jsonResponse(400, { ok: false, message: 'JSON inválido.' });
    }
  }

  const requestHeaders = Object.fromEntries([...request.headers.entries()]);

  const result = await handleEditorRoute({
    method: request.method,
    subpath,
    body,
    binaryBody,
    requestHeaders,
    runtime: 'cloudflare',
    config: {
      archive: {
        accessKey: env.IA_ACCESS_KEY,
        secretKey: env.IA_SECRET_KEY,
        collection: env.IA_COLLECTION || 'opensource_audio',
      },
      translation: {
        apiKey: env.TRANSLATE_API_KEY || env.GOOGLE_TRANSLATE_API_KEY,
        endpointUrl: env.TRANSLATE_API_URL || env.GOOGLE_TRANSLATE_API_URL,
        monthlyCharLimit: Number(env.EDITOR_TRANSLATE_MONTHLY_CHAR_LIMIT || 500000),
      },
    },
    supabaseEnv: {
      SUPABASE_URL: env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
    },
  });

  return jsonResponse(result.status, result.body);
};
