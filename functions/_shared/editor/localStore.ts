import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import matter from 'gray-matter';
import {
  contentIndexSchema,
  programEpisodesSchema,
  type ContentIndexData,
} from '../../../src/editor/contracts';
import { generateContentIndexFile } from '../../../src/plugins/contentJsonGenerator';
import {
  MIME_TO_EXT,
  MAX_IMAGE_BYTES,
  SLUG_RE,
  decodeBase64Payload,
  safeIdSegment,
} from './constants';
import { programMarkdownFile, readNextProgramOrder } from './programMarkdown';
import { buildSavePayloadFiles, type SavePayloadInput } from './savePayload';
import type { EditorStore } from './types';

const execFileAsync = promisify(execFile);
const USAGE_PATH = '.editor-translate-usage.json';

const writeJsonAtomic = async (filePath: string, data: unknown) => {
  const tempPath = `${filePath}.tmp`;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(tempPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  await fs.rename(tempPath, filePath);
};

const syncProgramFieldsToMarkdown = async (rootDir: string, contentIndex: ContentIndexData) => {
  for (const [id, localized] of Object.entries(contentIndex)) {
    for (const lang of ['es', 'pt'] as const) {
      const entry = localized?.[lang];
      if (!entry || entry.component !== 'ProgramPage') continue;
      const nextLogo = typeof entry.logo === 'string' ? entry.logo.trim() : '';
      const nextSchedule = typeof entry.schedule === 'string' ? entry.schedule : '';
      const nextScheduleMeta = (entry as Record<string, unknown>).schedule_meta;

      const markdownPath = path.resolve(rootDir, 'src/content', lang, `${id}.md`);
      if (!existsSync(markdownPath)) continue;

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
      if (
        nextScheduleMeta &&
        JSON.stringify(parsed.data.schedule_meta || null) !== JSON.stringify(nextScheduleMeta)
      ) {
        parsed.data.schedule_meta = nextScheduleMeta;
        changed = true;
      }
      if (!changed) continue;
      await fs.writeFile(markdownPath, matter.stringify(parsed.content, parsed.data), 'utf8');
    }
  }
};

const writeSavePayload = async (rootDir: string, body: SavePayloadInput) => {
  const files = buildSavePayloadFiles(body);
  for (const file of files) {
    const target = path.resolve(rootDir, file.path);
    await writeJsonAtomic(target, JSON.parse(file.content));
  }
  if (body.contentIndex) {
    await syncProgramFieldsToMarkdown(rootDir, body.contentIndex);
  }
};

const runGit = async (rootDir: string, args: string[]) => {
  const result = await execFileAsync('git', args, { cwd: rootDir });
  return result.stdout.trim();
};

export interface LocalEditorStoreOptions {
  rootDir: string;
  supportedLanguages: string[];
  gitRemote?: string;
  gitBranch?: string;
  githubToken?: string;
}

export const createLocalEditorStore = (options: LocalEditorStoreOptions): EditorStore => {
  const { rootDir, supportedLanguages } = options;
  const gitRemote = options.gitRemote || 'origin';
  const gitBranch = options.gitBranch || 'dev';
  const githubToken = options.githubToken || '';

  const regenerateContentIndex = async () => {
    const contentDir = path.resolve(rootDir, 'src/content');
    const outputFile = path.resolve(rootDir, 'src/contentIndex.json');
    await generateContentIndexFile({ contentDir, outputFile, supportedLanguages, verbose: false });
    await fs.copyFile(outputFile, path.resolve(rootDir, 'public/contentIndex.json'));
  };

  return {
    async getStatus() {
      const branch = await runGit(rootDir, ['rev-parse', '--abbrev-ref', 'HEAD']);
      const diff = await runGit(rootDir, ['status', '--porcelain']);
      return { branch, hasChanges: diff.length > 0 };
    },

    async persistSavePayload(body) {
      await writeSavePayload(rootDir, body);
    },

    async publishSavePayload(body) {
      await writeSavePayload(rootDir, body);

      if (!githubToken) {
        throw new Error('Falta EDITOR_GITHUB_TOKEN en entorno.');
      }

      const branch = await runGit(rootDir, ['rev-parse', '--abbrev-ref', 'HEAD']);
      if (branch !== gitBranch) {
        throw new Error(`Current branch "${branch}" does not match EDITOR_GIT_BRANCH "${gitBranch}".`);
      }

      const filesToTrack = [
        'public/contentIndex.json',
        'src/contentIndex.json',
        'public/editor/home-about-contact.json',
        'public/episodes',
        'public/images/logos',
        'public/images/episode-covers',
        'src/content/es',
        'src/content/pt',
        USAGE_PATH,
      ];
      await runGit(rootDir, [
        'add',
        ...filesToTrack.filter((file) => existsSync(path.resolve(rootDir, file))),
      ]);

      const diff = await runGit(rootDir, ['diff', '--cached', '--name-only']);
      if (!diff) return;

      await runGit(rootDir, ['commit', '-m', 'content: update editable json data from dev editor']);
      const remoteUrl = await runGit(rootDir, ['remote', 'get-url', gitRemote]);
      const authenticatedUrl = remoteUrl.replace('https://', `https://x-access-token:${githubToken}@`);
      await runGit(rootDir, ['push', authenticatedUrl, `HEAD:${gitBranch}`]);
    },

    async uploadImage(input) {
      const ext = MIME_TO_EXT[input.mimeType];
      if (!ext) throw new Error('Tipo de imagen no permitido (usa PNG, JPEG o WebP).');

      const b64 = decodeBase64Payload(
        input.dataBase64,
        /^data:image\/(png|jpeg|webp);base64,(.+)$/i
      );
      const buffer = Buffer.from(b64, 'base64');
      if (buffer.length > MAX_IMAGE_BYTES) throw new Error('Imagen demasiado grande (máx. 8 MB).');
      if (buffer.length < 32) throw new Error('Archivo vacío o corrupto.');

      const prog = safeIdSegment(input.programId, 'programId');
      const ts = Date.now();

      if (input.scope === 'program-logo') {
        const fileName = `${prog}-${ts}${ext}`;
        const dir = path.resolve(rootDir, 'public/images/logos');
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(path.join(dir, fileName), buffer);
        return { logoFileName: fileName };
      }

      if (!input.episodeId) throw new Error('episodeId requerido para episode-cover.');
      const ep = safeIdSegment(input.episodeId, 'episodeId');
      const fileName = `${prog}-${ep}-${ts}${ext}`;
      const dir = path.resolve(rootDir, 'public/images/episode-covers');
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, fileName), buffer);
      return { coverPublicPath: `images/episode-covers/${fileName}` };
    },

    async createProgram(input) {
      const id = input.id.trim().toLowerCase().replace(/\s+/g, '-').replace(/_/g, '-');
      if (!SLUG_RE.test(id)) {
        throw new Error('ID inválido: minúsculas, números y guiones (ej. mi-programa-nuevo).');
      }
      const titleEs = input.titleEs.trim();
      const titlePt = input.titlePt.trim();
      const schedule = (input.schedule || 'Horario por definir').trim();
      if (!titleEs) throw new Error('El título en español es obligatorio.');
      if (!titlePt) throw new Error('Falta el título en portugués (o deja igual al ES).');

      const esPath = path.resolve(rootDir, 'src/content/es', `${id}.md`);
      const ptPath = path.resolve(rootDir, 'src/content/pt', `${id}.md`);
      if (existsSync(esPath) || existsSync(ptPath)) {
        throw new Error(`Ya existe un programa o página con el id "${id}".`);
      }

      const rawIndex = await fs.readFile(path.resolve(rootDir, 'src/contentIndex.json'), 'utf8');
      const program_order = readNextProgramOrder(contentIndexSchema.parse(JSON.parse(rawIndex)));
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

      const emptyEpisodes = programEpisodesSchema.parse({ programId: id, episodes: [] });
      await writeJsonAtomic(path.resolve(rootDir, `public/episodes/${id}.json`), emptyEpisodes);
      await writeJsonAtomic(path.resolve(rootDir, `public/episodes/trash/${id}.json`), emptyEpisodes);
      await regenerateContentIndex();

      return { programId: id };
    },

    async deleteProgram(input) {
      const id = input.id.trim().toLowerCase().replace(/\s+/g, '-').replace(/_/g, '-');
      const confirmText = input.confirmText.trim().toLowerCase();
      if (!SLUG_RE.test(id)) throw new Error('ID inválido para eliminar.');
      if (confirmText !== 'eliminar') {
        throw new Error('Confirmación inválida. Escribe "eliminar".');
      }

      const esPath = path.resolve(rootDir, 'src/content/es', `${id}.md`);
      const ptPath = path.resolve(rootDir, 'src/content/pt', `${id}.md`);
      const epPath = path.resolve(rootDir, `public/episodes/${id}.json`);
      const epTrashPath = path.resolve(rootDir, `public/episodes/trash/${id}.json`);

      const existed = existsSync(esPath) || existsSync(ptPath) || existsSync(epPath);
      if (!existed) throw new Error(`No se encontró el programa "${id}" para eliminar.`);

      await fs.rm(esPath, { force: true });
      await fs.rm(ptPath, { force: true });
      await fs.rm(epPath, { force: true });
      await fs.rm(epTrashPath, { force: true });
      await regenerateContentIndex();

      return { programId: id };
    },

    async readTranslateUsage(month) {
      const usagePath = path.resolve(rootDir, USAGE_PATH);
      if (!existsSync(usagePath)) return 0;
      try {
        const usageRaw = JSON.parse(await fs.readFile(usagePath, 'utf8')) as {
          month?: string;
          usedChars?: number;
        };
        return usageRaw.month === month ? Number(usageRaw.usedChars || 0) : 0;
      } catch {
        return 0;
      }
    },

    async writeTranslateUsage(month, usedChars, monthlyLimit) {
      await writeJsonAtomic(path.resolve(rootDir, USAGE_PATH), { month, usedChars, monthlyLimit });
    },
  };
};
