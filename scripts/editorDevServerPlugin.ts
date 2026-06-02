import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleEditorRoute } from '../functions/_shared/editor/handlers';
import { assertSupabaseJwtAuthorized } from '../functions/_shared/supabaseJwtAuth';

interface PluginOptions {
  enabled: boolean;
  supabase?: {
    url?: string;
    anonKey?: string;
    serviceRoleKey?: string;
  };
  archive?: {
    accessKey?: string;
    secretKey?: string;
    collection?: string;
  };
  translation?: {
    apiKey?: string;
    endpointUrl?: string;
    monthlyCharLimit?: number;
  };
}

const sendJson = (res: ServerResponse, code: number, data: unknown) => {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
};

const readBody = async (req: IncomingMessage): Promise<unknown> =>
  new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk: Buffer) => {
      raw += chunk.toString('utf8');
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });

const readBinaryBody = async (req: IncomingMessage): Promise<ArrayBuffer> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });
    req.on('end', () => {
      const buffer = Buffer.concat(chunks);
      resolve(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer);
    });
    req.on('error', reject);
  });

const headerRecord = (req: IncomingMessage): Record<string, string | undefined> =>
  Object.fromEntries(
    Object.entries(req.headers).map(([key, value]) => [
      key,
      Array.isArray(value) ? value[0] : value,
    ])
  );

export const editorDevServerPlugin = ({
  enabled,
  supabase,
  archive,
  translation,
}: PluginOptions): Plugin => ({
  name: 'editor-dev-server',
  apply: 'serve',
  configureServer(server) {
    if (!enabled) return;

    server.middlewares.use('/__dev/editor', async (req, res) => {
      try {
        const supabaseUrl = (
          supabase?.url ||
          process.env.SUPABASE_URL ||
          process.env.VITE_SUPABASE_URL ||
          ''
        ).trim();
        const supabaseAnonKey = (
          supabase?.anonKey ||
          process.env.SUPABASE_ANON_KEY ||
          process.env.VITE_SUPABASE_ANON_KEY ||
          ''
        ).trim();
        const serviceKey = (
          supabase?.serviceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
        ).trim();

        const authRequest = new Request('http://local/__dev/editor', {
          method: req.method || 'GET',
          headers: Object.fromEntries(
            Object.entries(req.headers).map(([key, value]) => [
              key,
              Array.isArray(value) ? value[0] : value ?? '',
            ])
          ),
        });

        const authError = await assertSupabaseJwtAuthorized(authRequest, {
          SUPABASE_URL: supabaseUrl,
          SUPABASE_ANON_KEY: supabaseAnonKey,
        });
        if (authError) {
          const payload = await authError.json();
          return sendJson(res, authError.status, payload);
        }

        const url = req.url || '/';
        const subpath = url.replace(/^\//, '').split('?')[0];
        const method = req.method || 'GET';
        const requestHeaders = headerRecord(req);
        const isAudioProxy = method === 'POST' && subpath === 'upload-episode-audio-proxy';
        const body = method === 'GET' || isAudioProxy ? {} : await readBody(req);
        const binaryBody = isAudioProxy ? await readBinaryBody(req) : undefined;

        const result = await handleEditorRoute({
          method,
          subpath,
          body,
          binaryBody,
          requestHeaders,
          runtime: 'local',
          config: {
            archive: {
              accessKey: archive?.accessKey || process.env.IA_ACCESS_KEY,
              secretKey: archive?.secretKey || process.env.IA_SECRET_KEY,
              collection: archive?.collection || process.env.IA_COLLECTION,
            },
            translation: {
              apiKey:
                translation?.apiKey ||
                process.env.TRANSLATE_API_KEY ||
                process.env.GOOGLE_TRANSLATE_API_KEY,
              endpointUrl:
                translation?.endpointUrl ||
                process.env.TRANSLATE_API_URL ||
                process.env.GOOGLE_TRANSLATE_API_URL,
              monthlyCharLimit: Number(
                translation?.monthlyCharLimit || process.env.EDITOR_TRANSLATE_MONTHLY_CHAR_LIMIT || 500000
              ),
            },
          },
          supabaseEnv: {
            SUPABASE_URL: supabaseUrl,
            SUPABASE_SERVICE_ROLE_KEY: serviceKey,
          },
        });

        return sendJson(res, result.status, result.body);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return sendJson(res, 500, { ok: false, message });
      }
    });
  },
});
