import type { Plugin } from 'vite';
import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { timingSafeEqual } from 'node:crypto';
import matter from 'gray-matter';
import {
  contentIndexSchema,
  editorialSchema,
  programEpisodesSchema,
  programEpisodesTrashSchema,
  type ContentIndexData,
} from '../src/editor/contracts';
import { generateContentIndexFile } from '../src/plugins/contentJsonGenerator';

const execFileAsync = promisify(execFile);

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const yamlQuote = (value: string): string => {
  if (
    /^[\w\s.,\-¡!¿?áéíóúñÁÉÍÓÚÑüÜ]+$/u.test(value) &&
    !value.includes(':') &&
    !value.includes('#')
  ) {
    return value;
  }
  return JSON.stringify(value);
};

const programMarkdownFile = (options: {
  lang: 'es' | 'pt';
  id: string;
  title: string;
  program_order: number;
  schedule: string;
  body: string;
}): string => {
  const dateStr = new Date().toISOString().slice(0, 10);
  const { lang, id, title, program_order, schedule, body } = options;
  return `---
language: ${lang}
title: ${yamlQuote(title)}
slug: ${id}
id: ${id}
component: ProgramPage
public: true
program_order: ${program_order}
date: ${dateStr}
schedule: ${yamlQuote(schedule)}
talent: []
social: []
logo: 1.png
audio_source: ${id}.mp3
---

${body}
`;
};

const readNextProgramOrder = async (rootDir: string): Promise<number> => {
  const p = path.resolve(rootDir, 'src/contentIndex.json');
  try {
    const raw = await fs.readFile(p, 'utf8');
    const idx = JSON.parse(raw) as Record<string, Record<string, { program_order?: number } | undefined>>;
    let max = 0;
    for (const entry of Object.values(idx)) {
      if (!entry) continue;
      for (const lang of ['es', 'pt'] as const) {
        const o = entry[lang]?.program_order;
        if (typeof o === 'number' && !Number.isNaN(o)) max = Math.max(max, o);
      }
    }
    return max + 1;
  } catch {
    return 1;
  }
};

const syncProgramFieldsToMarkdown = async (rootDir: string, contentIndex: ContentIndexData): Promise<void> => {
  const updates: Promise<void>[] = [];

  for (const [id, localized] of Object.entries(contentIndex)) {
    for (const lang of ['es', 'pt'] as const) {
      const entry = localized?.[lang];
      if (!entry || entry.component !== 'ProgramPage') continue;
      const nextLogo = typeof entry.logo === 'string' ? entry.logo.trim() : '';
      const nextSchedule = typeof entry.schedule === 'string' ? entry.schedule : '';
      const nextScheduleMeta = (entry as Record<string, unknown>).schedule_meta;

      const markdownPath = path.resolve(rootDir, 'src/content', lang, `${id}.md`);
      if (!existsSync(markdownPath)) continue;

      updates.push(
        (async () => {
          const raw = await fs.readFile(markdownPath, 'utf8');
          const parsed = matter(raw);
          let changed = false;
          if (nextLogo && String(parsed.data.logo || '') !== nextLogo) {
            parsed.data.logo = nextLogo;
            changed = true;
          }
          if (nextSchedule && String(parsed.data.schedule || '') !== nextSchedule) {
            parsed.data.schedule = nextSchedule;
            changed = true;
          }
          if (nextScheduleMeta && JSON.stringify(parsed.data.schedule_meta || null) !== JSON.stringify(nextScheduleMeta)) {
            parsed.data.schedule_meta = nextScheduleMeta;
            changed = true;
          }
          if (!changed) return;
          const nextRaw = matter.stringify(parsed.content, parsed.data);
          await fs.writeFile(markdownPath, nextRaw, 'utf8');
        })()
      );
    }
  }

  await Promise.all(updates);
};

interface PluginOptions {
  rootDir: string;
  enabled: boolean;
  editorToken?: string;
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

const writeJsonAtomic = async (filePath: string, data: unknown) => {
  const tempPath = `${filePath}.tmp`;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(tempPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  await fs.rename(tempPath, filePath);
};

const ARCHIVE_ALLOWED_AUDIO_MIME: Record<string, string> = {
  'audio/mpeg': '.mp3',
  'audio/mp3': '.mp3',
  'audio/wav': '.wav',
  'audio/x-wav': '.wav',
  'audio/flac': '.flac',
  'audio/aac': '.aac',
  'audio/ogg': '.ogg',
  'audio/x-m4a': '.m4a',
  'audio/mp4': '.m4a',
};

const sanitizeSegment = (input: string): string =>
  input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);

const runGit = async (rootDir: string, args: string[]) => {
  const result = await execFileAsync('git', args, { cwd: rootDir });
  return result.stdout.trim();
};

const ensureAllowedBranch = async (rootDir: string, expectedBranch: string) => {
  const branch = await runGit(rootDir, ['rev-parse', '--abbrev-ref', 'HEAD']);
  if (branch !== expectedBranch) {
    throw new Error(`Current branch "${branch}" does not match EDITOR_GIT_BRANCH "${expectedBranch}".`);
  }
  return branch;
};

export const editorDevServerPlugin = ({
  rootDir,
  enabled,
  editorToken,
  supportedLanguages = ['es', 'pt'],
  archive,
  translation,
}: PluginOptions): Plugin => ({
  name: 'editor-dev-server',
  apply: 'serve',
  configureServer(server) {
    if (!enabled) return;

    server.middlewares.use('/__dev/editor', async (req, res) => {
      try {
        const expectedToken = editorToken?.trim();
        if (!expectedToken) {
          return sendJson(res, 503, {
            ok: false,
            message: 'EDITOR_DEV_TOKEN es obligatorio para usar el editor dev.',
          });
        }

        if (!safeCompare(readEditorToken(req), expectedToken)) {
          return sendJson(res, 401, { ok: false, message: 'Token del editor dev inválido.' });
        }

        if (req.method === 'GET' && req.url === '/status') {
          const branch = await runGit(rootDir, ['rev-parse', '--abbrev-ref', 'HEAD']);
          const diff = await runGit(rootDir, ['status', '--porcelain']);
          return sendJson(res, 200, { enabled: true, branch, hasChanges: diff.length > 0 });
        }

        if (req.method === 'POST' && req.url === '/upload-image') {
          const MIME_TO_EXT: Record<string, string> = {
            'image/png': '.png',
            'image/jpeg': '.jpg',
            'image/webp': '.webp',
          };
          const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

          const safeIdSegment = (raw: string, label: string) => {
            const s = raw
              .replace(/[^a-zA-Z0-9._-]/g, '-')
              .replace(/-+/g, '-')
              .replace(/^-|-$/g, '')
              .slice(0, 64);
            if (!s) throw new Error(`${label} inválido.`);
            return s;
          };

          const body = (await readBody(req)) as {
            scope?: string;
            programId?: string;
            episodeId?: string;
            dataBase64?: string;
            mimeType?: string;
          };

          if (body.scope !== 'program-logo' && body.scope !== 'episode-cover') {
            return sendJson(res, 400, { ok: false, message: 'scope debe ser program-logo o episode-cover.' });
          }
          if (!body.programId || !body.dataBase64 || !body.mimeType) {
            return sendJson(res, 400, { ok: false, message: 'Faltan programId, mimeType o dataBase64.' });
          }

          const ext = MIME_TO_EXT[body.mimeType];
          if (!ext) {
            return sendJson(res, 400, {
              ok: false,
              message: 'Tipo de imagen no permitido (usa PNG, JPEG o WebP).',
            });
          }

          let b64 = String(body.dataBase64).trim();
          const dataUrlMatch = /^data:image\/(png|jpeg|webp);base64,(.+)$/i.exec(b64);
          if (dataUrlMatch) b64 = dataUrlMatch[2];

          let buffer: Buffer;
          try {
            buffer = Buffer.from(b64, 'base64');
          } catch {
            return sendJson(res, 400, { ok: false, message: 'Base64 inválido.' });
          }

          if (buffer.length > MAX_IMAGE_BYTES) {
            return sendJson(res, 400, { ok: false, message: 'Imagen demasiado grande (máx. 8 MB).' });
          }
          if (buffer.length < 32) {
            return sendJson(res, 400, { ok: false, message: 'Archivo vacío o corrupto.' });
          }

          const prog = safeIdSegment(body.programId, 'programId');
          const ts = Date.now();

          if (body.scope === 'program-logo') {
            const fileName = `${prog}-${ts}${ext}`;
            const dir = path.resolve(rootDir, 'public/images/logos');
            await fs.mkdir(dir, { recursive: true });
            await fs.writeFile(path.join(dir, fileName), buffer);
            return sendJson(res, 200, {
              ok: true,
              message: 'Logo guardado en public/images/logos.',
              logoFileName: fileName,
            });
          }

          if (!body.episodeId) {
            return sendJson(res, 400, { ok: false, message: 'episodeId requerido para episode-cover.' });
          }
          const ep = safeIdSegment(body.episodeId, 'episodeId');
          const fileName = `${prog}-${ep}-${ts}${ext}`;
          const relPublic = `images/episode-covers/${fileName}`;
          const dir = path.resolve(rootDir, 'public/images/episode-covers');
          await fs.mkdir(dir, { recursive: true });
          await fs.writeFile(path.join(dir, fileName), buffer);
          return sendJson(res, 200, {
            ok: true,
            message: 'Portada guardada en public/images/episode-covers.',
            coverPublicPath: relPublic,
          });
        }

        if (req.method === 'POST' && req.url === '/create-program') {
          const raw = (await readBody(req)) as {
            id?: string;
            titleEs?: string;
            titlePt?: string;
            schedule?: string;
          };
          const id = String(raw.id || '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/_/g, '-');
          if (!SLUG_RE.test(id)) {
            return sendJson(res, 400, {
              ok: false,
              message: 'ID inválido: minúsculas, números y guiones (ej. mi-programa-nuevo).',
            });
          }
          const titleEs = String(raw.titleEs || '').trim();
          const titlePt = String(raw.titlePt || raw.titleEs || '').trim();
          const schedule = String(raw.schedule || 'Horario por definir').trim();
          if (!titleEs) {
            return sendJson(res, 400, { ok: false, message: 'El título en español es obligatorio.' });
          }
          if (!titlePt) {
            return sendJson(res, 400, { ok: false, message: 'Falta el título en portugués (o deja igual al ES).' });
          }

          const esPath = path.resolve(rootDir, 'src/content/es', `${id}.md`);
          const ptPath = path.resolve(rootDir, 'src/content/pt', `${id}.md`);
          if (existsSync(esPath) || existsSync(ptPath)) {
            return sendJson(res, 400, {
              ok: false,
              message: `Ya existe un programa o página con el id "${id}".`,
            });
          }

          const program_order = await readNextProgramOrder(rootDir);
          const bodyEs =
            'Descripción provisional. Edita en la ficha del programa o en el archivo markdown.';
          const bodyPt =
            'Descrição provisória. Edite na ficha do programa ou no arquivo markdown.';

          await fs.mkdir(path.dirname(esPath), { recursive: true });
          await fs.writeFile(
            esPath,
            programMarkdownFile({ lang: 'es', id, title: titleEs, program_order, schedule, body: bodyEs }),
            'utf8'
          );
          await fs.writeFile(
            ptPath,
            programMarkdownFile({ lang: 'pt', id, title: titlePt, program_order, schedule, body: bodyPt }),
            'utf8'
          );

          const epPath = path.resolve(rootDir, `public/episodes/${id}.json`);
          const epTrashPath = path.resolve(rootDir, `public/episodes/trash/${id}.json`);
          const emptyEpisodes = programEpisodesSchema.parse({ programId: id, episodes: [] });
          await writeJsonAtomic(epPath, emptyEpisodes);
          await writeJsonAtomic(epTrashPath, emptyEpisodes);

          const contentDir = path.resolve(rootDir, 'src/content');
          const outputFile = path.resolve(rootDir, 'src/contentIndex.json');
          await generateContentIndexFile({
            contentDir,
            outputFile,
            supportedLanguages,
            verbose: false,
          });

          const pubIdx = path.resolve(rootDir, 'public/contentIndex.json');
          await fs.copyFile(outputFile, pubIdx);

          return sendJson(res, 200, {
            ok: true,
            message: `Programa "${id}" creado (markdown, episodios e índice).`,
            programId: id,
          });
        }

        if (req.method === 'POST' && req.url === '/upload-episode-audio') {
          const IA_ACCESS_KEY = archive?.accessKey || process.env.IA_ACCESS_KEY || '';
          const IA_SECRET_KEY = archive?.secretKey || process.env.IA_SECRET_KEY || '';
          const IA_COLLECTION = archive?.collection || process.env.IA_COLLECTION || 'opensource_audio';

          if (!IA_ACCESS_KEY || !IA_SECRET_KEY) {
            return sendJson(res, 400, {
              ok: false,
              message: 'Faltan IA_ACCESS_KEY o IA_SECRET_KEY en entorno.',
            });
          }

          const body = (await readBody(req)) as {
            programId?: string;
            episodeId?: string;
            episodeTitle?: string;
            date?: string;
            description?: string;
            tags?: string[];
            mimeType?: string;
            fileName?: string;
            dataBase64?: string;
          };

          const programId = sanitizeSegment(String(body.programId || ''));
          const episodeId = sanitizeSegment(String(body.episodeId || ''));
          const episodeTitle = String(body.episodeTitle || '').trim();
          const date = String(body.date || '').trim();
          const mimeType = String(body.mimeType || '').trim().toLowerCase();
          const baseFileName = sanitizeSegment(String(body.fileName || '').replace(/\.[a-z0-9]+$/i, ''));
          const ext = ARCHIVE_ALLOWED_AUDIO_MIME[mimeType];

          if (!programId || !episodeId || !episodeTitle || !body.dataBase64 || !mimeType || !ext) {
            return sendJson(res, 400, {
              ok: false,
              message: 'Faltan campos requeridos o mimeType inválido.',
            });
          }

          let b64 = String(body.dataBase64).trim();
          const dataUrlMatch = /^data:audio\/[a-z0-9.+-]+;base64,(.+)$/i.exec(b64);
          if (dataUrlMatch) b64 = dataUrlMatch[1];

          let fileBuffer: Buffer;
          try {
            fileBuffer = Buffer.from(b64, 'base64');
          } catch {
            return sendJson(res, 400, { ok: false, message: 'Base64 inválido.' });
          }

          const MAX_AUDIO_BYTES = 512 * 1024 * 1024;
          if (fileBuffer.length < 1024) {
            return sendJson(res, 400, { ok: false, message: 'Audio vacío o corrupto.' });
          }
          if (fileBuffer.length > MAX_AUDIO_BYTES) {
            return sendJson(res, 400, { ok: false, message: 'Audio demasiado grande (máx. 512 MB).' });
          }

          const datePart = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10);
          const identifier = sanitizeSegment(`rn-${programId}-${episodeId}-${datePart}`);
          const uploadFileName = `${baseFileName || `${programId}-${episodeId}`}${ext}`;
          const archivePutUrl = `https://s3.us.archive.org/${encodeURIComponent(identifier)}/${encodeURIComponent(uploadFileName)}`;
          const itemUrl = `https://archive.org/details/${identifier}`;
          const audioUrl = `https://archive.org/download/${identifier}/${encodeURIComponent(uploadFileName)}`;
          const tags = Array.isArray(body.tags)
            ? body.tags.map((tag) => String(tag || '').trim()).filter(Boolean).slice(0, 30)
            : [];

          const headers: Record<string, string> = {
            authorization: `LOW ${IA_ACCESS_KEY}:${IA_SECRET_KEY}`,
            'x-archive-auto-make-bucket': '1',
            'x-archive-queue-derive': '0',
            'x-archive-meta-mediatype': 'audio',
            'x-archive-meta-collection': IA_COLLECTION,
            'x-archive-meta-title': episodeTitle,
            'x-archive-meta-description': String(body.description || '').slice(0, 5000),
            'x-archive-meta-date': datePart,
            'content-type': mimeType,
          };
          if (programId) headers['x-archive-meta-creator'] = programId;
          if (tags.length) headers['x-archive-meta-subject'] = tags.join('; ');

          const uploadResponse = await fetch(archivePutUrl, {
            method: 'PUT',
            headers,
            body: fileBuffer,
          });

          if (!uploadResponse.ok) {
            const errText = await uploadResponse.text();
            return sendJson(res, 502, {
              ok: false,
              message: `Archive upload error (${uploadResponse.status}): ${errText.slice(0, 400)}`,
            });
          }

          return sendJson(res, 200, {
            ok: true,
            message: 'Audio subido a Archive.org.',
            identifier,
            itemUrl,
            audioUrl,
            fileName: uploadFileName,
          });
        }

        if (req.method === 'POST' && req.url === '/delete-program') {
          const raw = (await readBody(req)) as {
            id?: string;
            confirmText?: string;
          };
          const id = String(raw.id || '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/_/g, '-');
          const confirmText = String(raw.confirmText || '').trim().toLowerCase();

          if (!SLUG_RE.test(id)) {
            return sendJson(res, 400, {
              ok: false,
              message: 'ID inválido para eliminar.',
            });
          }
          if (confirmText !== 'eliminar') {
            return sendJson(res, 400, {
              ok: false,
              message: 'Confirmación inválida. Escribe "eliminar".',
            });
          }

          const esPath = path.resolve(rootDir, 'src/content/es', `${id}.md`);
          const ptPath = path.resolve(rootDir, 'src/content/pt', `${id}.md`);
          const epPath = path.resolve(rootDir, `public/episodes/${id}.json`);

          const existed = existsSync(esPath) || existsSync(ptPath) || existsSync(epPath);
          if (!existed) {
            return sendJson(res, 404, {
              ok: false,
              message: `No se encontró el programa "${id}" para eliminar.`,
            });
          }

          await fs.rm(esPath, { force: true });
          await fs.rm(ptPath, { force: true });
          await fs.rm(epPath, { force: true });
          await fs.rm(epTrashPath, { force: true });

          const contentDir = path.resolve(rootDir, 'src/content');
          const outputFile = path.resolve(rootDir, 'src/contentIndex.json');
          await generateContentIndexFile({
            contentDir,
            outputFile,
            supportedLanguages,
            verbose: false,
          });

          const pubIdx = path.resolve(rootDir, 'public/contentIndex.json');
          await fs.copyFile(outputFile, pubIdx);

          return sendJson(res, 200, {
            ok: true,
            message: `Programa "${id}" eliminado.`,
            programId: id,
          });
        }

        if (req.method === 'POST' && req.url === '/translate-text') {
          const apiKey =
            translation?.apiKey ||
            process.env.TRANSLATE_API_KEY ||
            process.env.GOOGLE_TRANSLATE_API_KEY ||
            '';
          const configuredEndpoint =
            translation?.endpointUrl || process.env.TRANSLATE_API_URL || process.env.GOOGLE_TRANSLATE_API_URL || '';
          const endpointCandidates = Array.from(
            new Set(
              [
                configuredEndpoint,
                'https://translate.argosopentech.com/translate',
                'https://libretranslate.com/translate',
              ].filter(Boolean)
            )
          );
          const monthlyLimit = Math.max(
            1,
            Number(translation?.monthlyCharLimit || process.env.EDITOR_TRANSLATE_MONTHLY_CHAR_LIMIT || 500000)
          );

          const body = (await readBody(req)) as {
            text?: string;
            source?: string;
            targets?: string[];
          };
          const source = String(body.source || '').trim().toLowerCase();
          const text = String(body.text || '');
          const rawTargets = Array.isArray(body.targets) ? body.targets : [];
          const targets = rawTargets
            .map((item) => String(item || '').trim().toLowerCase())
            .filter((item): item is 'en' | 'pt' => item === 'en' || item === 'pt');

          if (source !== 'es') {
            return sendJson(res, 400, { ok: false, message: 'source debe ser es.' });
          }
          if (!text.trim()) {
            return sendJson(res, 400, { ok: false, message: 'text es obligatorio.' });
          }
          if (targets.length === 0) {
            return sendJson(res, 400, { ok: false, message: 'targets debe incluir en y/o pt.' });
          }

          const usagePath = path.resolve(rootDir, '.editor-translate-usage.json');
          const month = new Date().toISOString().slice(0, 7);
          const requestedChars = text.length * targets.length;
          let usedChars = 0;

          if (existsSync(usagePath)) {
            try {
              const usageRaw = JSON.parse(await fs.readFile(usagePath, 'utf8')) as {
                month?: string;
                usedChars?: number;
              };
              if (usageRaw.month === month) {
                usedChars = Number(usageRaw.usedChars || 0);
              }
            } catch {
              usedChars = 0;
            }
          }

          if (usedChars + requestedChars > monthlyLimit) {
            const remainingChars = Math.max(0, monthlyLimit - usedChars);
            return sendJson(res, 429, {
              ok: false,
              message: `Límite mensual alcanzado (${usedChars}/${monthlyLimit}). Restante: ${remainingChars}.`,
              month,
              usedChars,
              remainingChars,
            });
          }

          const translated: Record<'en' | 'pt', string> = {
            en: text,
            pt: text,
          };

          const translateWithFallback = async (target: 'en' | 'pt'): Promise<string> => {
            const errors: string[] = [];

            for (const endpointUrl of endpointCandidates) {
              const isGoogleEndpoint = /translation\.googleapis\.com/i.test(endpointUrl);
              if (isGoogleEndpoint && !apiKey) {
                errors.push(`${endpointUrl}: missing API key`);
                continue;
              }

              try {
                const requestUrl = isGoogleEndpoint
                  ? `${endpointUrl}?key=${encodeURIComponent(apiKey)}`
                  : endpointUrl;
                const requestBody = isGoogleEndpoint
                  ? {
                      q: text,
                      source,
                      target,
                      format: 'text',
                    }
                  : {
                      q: text,
                      source,
                      target,
                      format: 'text',
                      api_key: apiKey || undefined,
                    };

                const response = await fetch(requestUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(requestBody),
                });

                if (!response.ok) {
                  const errText = await response.text();
                  errors.push(`${endpointUrl} -> (${response.status}) ${errText.slice(0, 160)}`);
                  continue;
                }

                const payload = (await response.json()) as {
                  data?: { translations?: Array<{ translatedText?: string }> };
                  translatedText?: string;
                };
                const translatedText = isGoogleEndpoint
                  ? payload.data?.translations?.[0]?.translatedText
                  : payload.translatedText;

                if (!translatedText || typeof translatedText !== 'string') {
                  errors.push(`${endpointUrl} -> invalid response payload`);
                  continue;
                }

                return translatedText;
              } catch (error) {
                const message = error instanceof Error ? error.message : 'unknown fetch error';
                errors.push(`${endpointUrl} -> ${message}`);
                continue;
              }
            }

            // Final fallback: public Google endpoint without API key.
            try {
              const googlePublicUrl =
                `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(source)}` +
                `&tl=${encodeURIComponent(target)}&dt=t&q=${encodeURIComponent(text)}`;
              const googleResponse = await fetch(googlePublicUrl);
              if (!googleResponse.ok) {
                const errText = await googleResponse.text();
                errors.push(`googleapis public -> (${googleResponse.status}) ${errText.slice(0, 160)}`);
              } else {
                const payload = (await googleResponse.json()) as unknown;
                if (Array.isArray(payload) && Array.isArray(payload[0])) {
                  const chunks = payload[0] as unknown[];
                  const translatedText = chunks
                    .map((chunk) => (Array.isArray(chunk) ? String(chunk[0] ?? '') : ''))
                    .join('')
                    .trim();
                  if (translatedText) {
                    return translatedText;
                  }
                  errors.push('googleapis public -> empty translated text');
                } else {
                  errors.push('googleapis public -> invalid response payload');
                }
              }
            } catch (error) {
              const message = error instanceof Error ? error.message : 'unknown fetch error';
              errors.push(`googleapis public -> ${message}`);
            }

            throw new Error(errors.join(' | '));
          };

          for (const target of targets) {
            try {
              translated[target] = await translateWithFallback(target);
            } catch (error) {
              const message = error instanceof Error ? error.message : 'unknown translation provider error';
              return sendJson(res, 502, {
                ok: false,
                message: `Translate provider error: ${message.slice(0, 480)}`,
              });
            }
          }

          const nextUsedChars = usedChars + requestedChars;
          await writeJsonAtomic(usagePath, { month, usedChars: nextUsedChars, monthlyLimit });

          return sendJson(res, 200, {
            ok: true,
            message: 'Texto traducido.',
            month,
            usedChars: nextUsedChars,
            remainingChars: Math.max(0, monthlyLimit - nextUsedChars),
            translated,
          });
        }

        if (req.method !== 'POST' || (req.url !== '/save' && req.url !== '/publish')) {
          return sendJson(res, 404, { ok: false, message: 'Endpoint no encontrado.' });
        }

        const body = (await readBody(req)) as {
          contentIndex?: unknown;
          editorial?: unknown;
          episodesByProgram?: Record<string, unknown>;
          episodesTrashByProgram?: Record<string, unknown>;
        };

        const contentIndexPath = path.resolve(rootDir, 'public/contentIndex.json');
        const srcContentIndexPath = path.resolve(rootDir, 'src/contentIndex.json');
        const editorialPath = path.resolve(rootDir, 'public/editor/home-about-contact.json');

        if (body.contentIndex) {
          const parsed = contentIndexSchema.parse(body.contentIndex);
          await writeJsonAtomic(contentIndexPath, parsed);
          await writeJsonAtomic(srcContentIndexPath, parsed);
          // Keep markdown (build source of truth) aligned with editor field changes.
          await syncProgramFieldsToMarkdown(rootDir, parsed);
        }

        if (body.editorial) {
          const parsed = editorialSchema.parse(body.editorial);
          await writeJsonAtomic(editorialPath, parsed);
        }

        if (body.episodesByProgram) {
          for (const [programId, payload] of Object.entries(body.episodesByProgram)) {
            const parsed = programEpisodesSchema.parse(payload);
            const outputPath = path.resolve(rootDir, `public/episodes/${programId}.json`);
            await writeJsonAtomic(outputPath, parsed);
          }
        }

        if (body.episodesTrashByProgram) {
          for (const [programId, payload] of Object.entries(body.episodesTrashByProgram)) {
            const parsed = programEpisodesTrashSchema.parse(payload);
            const outputPath = path.resolve(rootDir, `public/episodes/trash/${programId}.json`);
            await writeJsonAtomic(outputPath, parsed);
          }
        }

        if (req.url === '/save') {
          return sendJson(res, 200, { ok: true, message: 'Cambios guardados en JSON.' });
        }

        const remote = process.env.EDITOR_GIT_REMOTE || 'origin';
        const branch = process.env.EDITOR_GIT_BRANCH || 'main';
        const token = process.env.EDITOR_GITHUB_TOKEN || '';
        if (!token) {
          return sendJson(res, 400, { ok: false, message: 'Falta EDITOR_GITHUB_TOKEN en entorno.' });
        }

        await ensureAllowedBranch(rootDir, branch);

        const filesToTrack = [
          'public/contentIndex.json',
          'src/contentIndex.json',
          'public/editor/home-about-contact.json',
          'public/episodes',
          'public/images/logos',
          'public/images/episode-covers',
          'src/content/es',
          'src/content/pt',
        ];
        await runGit(rootDir, ['add', ...filesToTrack.filter((file) => existsSync(path.resolve(rootDir, file)))]);

        const diff = await runGit(rootDir, ['diff', '--cached', '--name-only']);
        if (!diff) {
          return sendJson(res, 200, { ok: true, message: 'No hay cambios para publicar.' });
        }

        await runGit(rootDir, ['commit', '-m', 'content: update editable json data from dev editor']);

        const remoteUrl = await runGit(rootDir, ['remote', 'get-url', remote]);
        const authenticatedUrl = remoteUrl.replace('https://', `https://x-access-token:${token}@`);
        await runGit(rootDir, ['push', authenticatedUrl, `HEAD:${branch}`]);

        return sendJson(res, 200, { ok: true, message: 'Cambios publicados a GitHub.' });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return sendJson(res, 500, { ok: false, message });
      }
    });
  },
});
