import {
  ARCHIVE_ALLOWED_AUDIO_MIME,
  MAX_AUDIO_BYTES,
  sanitizeSegment,
  SLUG_RE,
} from './constants';
import type { EditorRuntimeConfig, EditorStore } from './types';
import { translateTextWithProviders } from './translateText';
import { decodeAudioBase64, decodeAudioBase64Node, uploadEpisodeAudioToArchive } from './uploadEpisodeAudio';
import type { SavePayloadInput } from './savePayload';

export interface EditorHandlerResult {
  status: number;
  body: Record<string, unknown>;
}

const ok = (body: Record<string, unknown>, status = 200): EditorHandlerResult => ({ status, body: { ok: true, ...body } });
const fail = (message: string, status = 400, extra: Record<string, unknown> = {}): EditorHandlerResult => ({
  status,
  body: { ok: false, message, ...extra },
});

export const handleEditorRoute = async (options: {
  method: string;
  subpath: string;
  body: unknown;
  store: EditorStore;
  config: EditorRuntimeConfig;
  runtime: 'local' | 'cloudflare';
}): Promise<EditorHandlerResult> => {
  const { method, subpath, store, config, runtime } = options;
  const body = (options.body ?? {}) as Record<string, unknown>;

  if (method === 'GET' && subpath === 'status') {
    const status = await store.getStatus();
    return ok({ enabled: true, ...status });
  }

  if (method === 'POST' && subpath === 'save') {
    try {
      await store.persistSavePayload(body as SavePayloadInput);
      return ok({ message: 'Cambios guardados en JSON.' });
    } catch (error) {
      return fail(error instanceof Error ? error.message : 'Error al guardar.', 500);
    }
  }

  if (method === 'POST' && subpath === 'publish') {
    try {
      await store.publishSavePayload(body as SavePayloadInput);
      const message =
        runtime === 'cloudflare'
          ? `Cambios publicados en GitHub. El deploy se activará automáticamente.`
          : 'Cambios publicados a GitHub.';
      return ok({ message });
    } catch (error) {
      return fail(error instanceof Error ? error.message : 'Error al publicar.', 500);
    }
  }

  if (method === 'POST' && subpath === 'upload-image') {
    try {
      const scope = String(body.scope || '');
      if (scope !== 'program-logo' && scope !== 'episode-cover') {
        return fail('scope debe ser program-logo o episode-cover.');
      }
      if (!body.programId || !body.dataBase64 || !body.mimeType) {
        return fail('Faltan programId, mimeType o dataBase64.');
      }
      const result = await store.uploadImage({
        scope,
        programId: String(body.programId),
        episodeId: body.episodeId ? String(body.episodeId) : undefined,
        mimeType: String(body.mimeType),
        dataBase64: String(body.dataBase64),
      });
      return ok({
        message:
          result.logoFileName
            ? 'Logo guardado en public/images/logos.'
            : 'Portada guardada en public/images/episode-covers.',
        ...result,
      });
    } catch (error) {
      return fail(error instanceof Error ? error.message : 'Error al subir imagen.', 500);
    }
  }

  if (method === 'POST' && subpath === 'create-program') {
    try {
      const result = await store.createProgram({
        id: String(body.id || ''),
        titleEs: String(body.titleEs || ''),
        titlePt: String(body.titlePt || ''),
        schedule: body.schedule ? String(body.schedule) : undefined,
      });
      return ok({ message: `Programa "${result.programId}" creado (markdown, episodios e índice).`, ...result });
    } catch (error) {
      return fail(error instanceof Error ? error.message : 'Error al crear programa.', 500);
    }
  }

  if (method === 'POST' && subpath === 'delete-program') {
    try {
      const result = await store.deleteProgram({
        id: String(body.id || ''),
        confirmText: String(body.confirmText || ''),
      });
      return ok({ message: `Programa "${result.programId}" eliminado.`, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al eliminar programa.';
      const status = message.includes('No se encontró') ? 404 : 500;
      return fail(message, status);
    }
  }

  if (method === 'POST' && subpath === 'upload-episode-audio') {
    const accessKey = config.archive?.accessKey || '';
    const secretKey = config.archive?.secretKey || '';
    const collection = config.archive?.collection || 'opensource_audio';
    if (!accessKey || !secretKey) {
      return fail('Faltan IA_ACCESS_KEY o IA_SECRET_KEY en entorno.');
    }

    const programId = sanitizeSegment(String(body.programId || ''));
    const episodeId = sanitizeSegment(String(body.episodeId || ''));
    const episodeTitle = String(body.episodeTitle || '').trim();
    const date = String(body.date || '').trim();
    const mimeType = String(body.mimeType || '').trim().toLowerCase();
    const ext = ARCHIVE_ALLOWED_AUDIO_MIME[mimeType];

    if (!programId || !episodeId || !episodeTitle || !body.dataBase64 || !mimeType || !ext) {
      return fail('Faltan campos requeridos o mimeType inválido.');
    }

    try {
      let arrayBuffer: ArrayBuffer;
      let size: number;

      if (runtime === 'local') {
        const buf = decodeAudioBase64Node(String(body.dataBase64));
        size = buf.length;
        arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
      } else {
        arrayBuffer = decodeAudioBase64(String(body.dataBase64));
        size = arrayBuffer.byteLength;
      }

      if (size < 1024) return fail('Audio vacío o corrupto.');
      if (size > MAX_AUDIO_BYTES) return fail('Audio demasiado grande (máx. 512 MB).');

      const tags = Array.isArray(body.tags)
        ? body.tags.map((tag) => String(tag || '').trim()).filter(Boolean).slice(0, 30)
        : [];

      const uploaded = await uploadEpisodeAudioToArchive({
        accessKey,
        secretKey,
        collection,
        programId,
        episodeId,
        episodeTitle,
        date,
        description: String(body.description || ''),
        tags,
        mimeType,
        fileName: String(body.fileName || `${episodeId}.mp3`),
        fileBuffer: arrayBuffer,
      });

      return ok({ message: 'Audio subido a Archive.org.', ...uploaded });
    } catch (error) {
      return fail(error instanceof Error ? error.message : 'Error al subir audio.', 502);
    }
  }

  if (method === 'POST' && subpath === 'translate-text') {
    const apiKey = config.translation?.apiKey || '';
    const configuredEndpoint = config.translation?.endpointUrl || '';
    const endpointCandidates = Array.from(
      new Set(
        [
          configuredEndpoint,
          'https://translate.argosopentech.com/translate',
          'https://libretranslate.com/translate',
        ].filter(Boolean)
      )
    );
    const monthlyLimit = Math.max(1, Number(config.translation?.monthlyCharLimit || 500000));

    const source = String(body.source || '').trim().toLowerCase();
    const text = String(body.text || '');
    const rawTargets = Array.isArray(body.targets) ? body.targets : [];
    const targets = rawTargets
      .map((item) => String(item || '').trim().toLowerCase())
      .filter((item): item is 'en' | 'pt' => item === 'en' || item === 'pt');

    if (source !== 'es') return fail('source debe ser es.');
    if (!text.trim()) return fail('text es obligatorio.');
    if (targets.length === 0) return fail('targets debe incluir en y/o pt.');

    const month = new Date().toISOString().slice(0, 7);
    const requestedChars = text.length * targets.length;
    const usedChars = await store.readTranslateUsage(month);

    if (usedChars + requestedChars > monthlyLimit) {
      const remainingChars = Math.max(0, monthlyLimit - usedChars);
      return fail(
        `Límite mensual alcanzado (${usedChars}/${monthlyLimit}). Restante: ${remainingChars}.`,
        429,
        { month, usedChars, remainingChars }
      );
    }

    try {
      const translated = await translateTextWithProviders({
        text,
        source,
        targets,
        apiKey,
        endpointCandidates,
      });
      const nextUsedChars = usedChars + requestedChars;
      await store.writeTranslateUsage(month, nextUsedChars, monthlyLimit);
      return ok({
        message: 'Texto traducido.',
        month,
        usedChars: nextUsedChars,
        remainingChars: Math.max(0, monthlyLimit - nextUsedChars),
        translated,
      });
    } catch (error) {
      return fail(
        `Translate provider error: ${(error instanceof Error ? error.message : 'unknown').slice(0, 480)}`,
        502
      );
    }
  }

  return fail('Endpoint no encontrado.', 404);
};

export const normalizeProgramId = (raw: string): string => {
  const id = raw.trim().toLowerCase().replace(/\s+/g, '-').replace(/_/g, '-');
  if (!SLUG_RE.test(id)) throw new Error('ID inválido.');
  return id;
};
