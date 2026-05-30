import {
  contentIndexSchema,
  programEpisodesSchema,
  type ContentIndexData,
} from '../../../src/editor/contracts';
import {
  MIME_TO_EXT,
  MAX_IMAGE_BYTES,
  SLUG_RE,
  decodeBase64Payload,
  safeIdSegment,
} from './constants';
import {
  buildNewProgramIndexEntry,
  programMarkdownFile,
  readNextProgramOrder,
} from './programMarkdown';
import { buildSavePayloadFiles, type SavePayloadInput } from './savePayload';
import {
  commitRepoFiles,
  readGithubTextFile,
  type GithubRepoConfig,
} from './githubRepo';
import type { EditorStore, RepoFileWrite } from './types';

const USAGE_PATH = '.editor-translate-usage.json';

const base64ToUtf8 = (b64: string): string => {
  const normalized = b64.replace(/\n/g, '');
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder('utf-8').decode(bytes);
};

export const createGithubEditorStore = (config: GithubRepoConfig): EditorStore => {
  const readContentIndex = async (): Promise<ContentIndexData> => {
    const raw =
      (await readGithubTextFile(config, 'src/contentIndex.json')) ??
      (await readGithubTextFile(config, 'public/contentIndex.json'));
    if (!raw) return {};
    return contentIndexSchema.parse(JSON.parse(raw));
  };

  const commit = async (
    files: RepoFileWrite[],
    deletions: string[],
    message: string
  ): Promise<void> => {
    await commitRepoFiles(config, files, deletions, message);
  };

  return {
    async getStatus() {
      return { branch: config.branch, hasChanges: false };
    },

    async persistSavePayload(body) {
      const files = buildSavePayloadFiles(body);
      if (files.length === 0) throw new Error('Nada que guardar.');
      await commit(files, [], 'content: update editable json from editor');
    },

    async publishSavePayload(body) {
      const files = buildSavePayloadFiles(body);
      if (files.length === 0) throw new Error('Nada que publicar.');
      await commit(files, [], 'content: publish editable json from editor');
    },

    async uploadImage(input) {
      const ext = MIME_TO_EXT[input.mimeType];
      if (!ext) throw new Error('Tipo de imagen no permitido (usa PNG, JPEG o WebP).');

      const b64 = decodeBase64Payload(
        input.dataBase64,
        /^data:image\/(png|jpeg|webp);base64,(.+)$/i
      );
      const binary = atob(b64);
      if (binary.length > MAX_IMAGE_BYTES) throw new Error('Imagen demasiado grande (máx. 8 MB).');
      if (binary.length < 32) throw new Error('Archivo vacío o corrupto.');

      const prog = safeIdSegment(input.programId, 'programId');
      const ts = Date.now();

      if (input.scope === 'program-logo') {
        const fileName = `${prog}-${ts}${ext}`;
        await commit(
          [{ path: `public/images/logos/${fileName}`, content: b64, encoding: 'base64' }],
          [],
          `content: upload program logo ${fileName}`
        );
        return { logoFileName: fileName };
      }

      if (!input.episodeId) throw new Error('episodeId requerido para episode-cover.');
      const ep = safeIdSegment(input.episodeId, 'episodeId');
      const fileName = `${prog}-${ep}-${ts}${ext}`;
      const relPublic = `images/episode-covers/${fileName}`;
      await commit(
        [{ path: `public/images/episode-covers/${fileName}`, content: b64, encoding: 'base64' }],
        [],
        `content: upload episode cover ${fileName}`
      );
      return { coverPublicPath: relPublic };
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

      const contentIndex = await readContentIndex();
      if (contentIndex[id]) {
        throw new Error(`Ya existe un programa o página con el id "${id}".`);
      }

      const program_order = readNextProgramOrder(contentIndex);
      const bodyEs =
        'Descripción provisional. Edita en la ficha del programa o en el archivo markdown.';
      const bodyPt =
        'Descrição provisória. Edite na ficha do programa ou no arquivo markdown.';

      const esMd = programMarkdownFile({ lang: 'es', id, title: titleEs, program_order, schedule, body: bodyEs });
      const ptMd = programMarkdownFile({ lang: 'pt', id, title: titlePt, program_order, schedule, body: bodyPt });
      const emptyEpisodes = programEpisodesSchema.parse({ programId: id, episodes: [] });

      const nextIndex: ContentIndexData = {
        ...contentIndex,
        [id]: {
          es: buildNewProgramIndexEntry({ lang: 'es', id, title: titleEs, program_order, schedule, body: bodyEs }),
          pt: buildNewProgramIndexEntry({ lang: 'pt', id, title: titlePt, program_order, schedule, body: bodyPt }),
        },
      };

      const serializedIndex = `${JSON.stringify(nextIndex, null, 2)}\n`;
      const serializedEpisodes = `${JSON.stringify(emptyEpisodes, null, 2)}\n`;

      await commit(
        [
          { path: `src/content/es/${id}.md`, content: esMd, encoding: 'utf-8' },
          { path: `src/content/pt/${id}.md`, content: ptMd, encoding: 'utf-8' },
          { path: `public/episodes/${id}.json`, content: serializedEpisodes, encoding: 'utf-8' },
          { path: `public/episodes/trash/${id}.json`, content: serializedEpisodes, encoding: 'utf-8' },
          { path: 'src/contentIndex.json', content: serializedIndex, encoding: 'utf-8' },
          { path: 'public/contentIndex.json', content: serializedIndex, encoding: 'utf-8' },
        ],
        [],
        `content: create program ${id}`
      );

      return { programId: id };
    },

    async deleteProgram(input) {
      const id = input.id.trim().toLowerCase().replace(/\s+/g, '-').replace(/_/g, '-');
      const confirmText = input.confirmText.trim().toLowerCase();
      if (!SLUG_RE.test(id)) throw new Error('ID inválido para eliminar.');
      if (confirmText !== 'eliminar') {
        throw new Error('Confirmación inválida. Escribe "eliminar".');
      }

      const contentIndex = await readContentIndex();
      if (!contentIndex[id]) {
        throw new Error(`No se encontró el programa "${id}" para eliminar.`);
      }

      const nextIndex = { ...contentIndex };
      delete nextIndex[id];
      const serializedIndex = `${JSON.stringify(nextIndex, null, 2)}\n`;

      await commit(
        [
          { path: 'src/contentIndex.json', content: serializedIndex, encoding: 'utf-8' },
          { path: 'public/contentIndex.json', content: serializedIndex, encoding: 'utf-8' },
        ],
        [
          `src/content/es/${id}.md`,
          `src/content/pt/${id}.md`,
          `public/episodes/${id}.json`,
          `public/episodes/trash/${id}.json`,
        ],
        `content: delete program ${id}`
      );

      return { programId: id };
    },

    async readTranslateUsage(month) {
      const raw = await readGithubTextFile(config, USAGE_PATH);
      if (!raw) return 0;
      try {
        const usage = JSON.parse(raw) as { month?: string; usedChars?: number };
        return usage.month === month ? Number(usage.usedChars || 0) : 0;
      } catch {
        return 0;
      }
    },

    async writeTranslateUsage(month, usedChars, monthlyLimit) {
      const content = `${JSON.stringify({ month, usedChars, monthlyLimit }, null, 2)}\n`;
      await commit(
        [{ path: USAGE_PATH, content, encoding: 'utf-8' }],
        [],
        'content: update translate usage'
      );
    },
  };
};

export { base64ToUtf8 };
