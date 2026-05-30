import { assertEditorAuthorized, jsonResponse } from '../../_shared/editorAuth';
import { handleEditorRoute } from '../../_shared/editor/handlers';
import { createGithubEditorStore } from '../../_shared/editor/githubStore';
import { parseGithubRepo } from '../../_shared/editor/githubRepo';

interface Env {
  EDITOR_PASSWORD_HASH?: string;
  EDITOR_GITHUB_TOKEN?: string;
  EDITOR_GIT_BRANCH?: string;
  EDITOR_GITHUB_REPO?: string;
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
  const expectedHash = (env.EDITOR_PASSWORD_HASH || '').trim();

  const authError = assertEditorAuthorized(request, expectedHash);
  if (authError) return authError;

  const token = (env.EDITOR_GITHUB_TOKEN || '').trim();
  const branch = (env.EDITOR_GIT_BRANCH || 'master').trim();
  const repoRaw = (env.EDITOR_GITHUB_REPO || '').trim();

  if (!token || !repoRaw) {
    return jsonResponse(503, {
      ok: false,
      message: 'Faltan EDITOR_GITHUB_TOKEN o EDITOR_GITHUB_REPO en el servidor.',
    });
  }

  const { owner, repo } = parseGithubRepo(repoRaw);
  const store = createGithubEditorStore({ token, owner, repo, branch });

  let body: unknown = {};
  if (request.method !== 'GET') {
    try {
      body = await request.json();
    } catch {
      return jsonResponse(400, { ok: false, message: 'JSON inválido.' });
    }
  }

  const result = await handleEditorRoute({
    method: request.method,
    subpath,
    body,
    store,
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
  });

  return jsonResponse(result.status, result.body);
};
