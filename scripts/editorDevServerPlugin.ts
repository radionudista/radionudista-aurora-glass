import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { handleEditorRoute } from '../functions/_shared/editor/handlers';
import { createLocalEditorStore } from '../functions/_shared/editor/localStore';

interface PluginOptions {
  rootDir: string;
  enabled: boolean;
  passwordHash?: string;
  supportedLanguages?: string[];
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

const safeCompare = (actual: string, expected: string): boolean => {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
};

const readEditorToken = (req: IncomingMessage): string => {
  const header = req.headers['x-editor-token'] ?? req.headers.authorization;
  const raw = Array.isArray(header) ? header[0] : header;
  if (!raw) return '';
  return raw.replace(/^Bearer\s+/i, '').trim();
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

export const editorDevServerPlugin = ({
  rootDir,
  enabled,
  passwordHash,
  supportedLanguages = ['es', 'pt', 'en'],
  archive,
  translation,
}: PluginOptions): Plugin => ({
  name: 'editor-dev-server',
  apply: 'serve',
  configureServer(server) {
    if (!enabled) return;

    const store = createLocalEditorStore({
      rootDir,
      supportedLanguages,
      gitRemote: process.env.EDITOR_GIT_REMOTE || 'origin',
      gitBranch: process.env.EDITOR_GIT_BRANCH || 'master',
      githubToken: process.env.EDITOR_GITHUB_TOKEN || '',
    });

    server.middlewares.use('/__dev/editor', async (req, res) => {
      try {
        const expectedHash = (passwordHash || process.env.VITE_EDITOR_PASSWORD_HASH || '').trim();
        if (!expectedHash) {
          return sendJson(res, 503, {
            ok: false,
            message: 'VITE_EDITOR_PASSWORD_HASH es obligatorio para usar el editor dev.',
          });
        }

        if (!safeCompare(readEditorToken(req), expectedHash)) {
          return sendJson(res, 401, {
            ok: false,
            message: 'Sesión del editor dev inválida. Volvé a /editor-login.',
          });
        }

        const url = req.url || '/';
        const subpath = url.replace(/^\//, '').split('?')[0];
        const method = req.method || 'GET';
        const body = method === 'GET' ? {} : await readBody(req);

        const result = await handleEditorRoute({
          method,
          subpath,
          body,
          store,
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
            supportedLanguages,
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
