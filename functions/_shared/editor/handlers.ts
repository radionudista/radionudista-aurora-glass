import {
  ARCHIVE_ALLOWED_AUDIO_MIME,
  MAX_AUDIO_BYTES,
  sanitizeSegment,
} from './constants';
import { translateTextWithProviders } from './translateText';
import { decodeAudioBase64, decodeAudioBase64Node, buildArchiveUploadPlan, uploadEpisodeAudioToArchive } from './uploadEpisodeAudio';
import { parseArchiveUploadMetaFromHeaders } from './parseArchiveUploadMeta';
import { createTranslateUsageStore } from './translateUsage';
import type { EditorRuntimeConfig } from './types';
import { canAccessProgram, type EditorAuthProfile } from '../editorAuth';
import { handleAdminRoute } from './adminHandlers';

export interface EditorHandlerResult {
  status: number;
  body: Record<string, unknown>;
}

const ok = (body: Record<string, unknown>, status = 200): EditorHandlerResult => ({
  status,
  body: { ok: true, ...body },
});

const fail = (message: string, status = 400, extra: Record<string, unknown> = {}): EditorHandlerResult => ({
  status,
  body: { ok: false, message, ...extra },
});

export const handleEditorRoute = async (options: {
  method: string;
  subpath: string;
  body: unknown;
  config: EditorRuntimeConfig;
  runtime: 'local' | 'cloudflare';
  supabaseEnv?: {
    SUPABASE_URL?: string;
    SUPABASE_ANON_KEY?: string;
    SUPABASE_SERVICE_ROLE_KEY?: string;
  };
  authProfile?: EditorAuthProfile;
  binaryBody?: ArrayBuffer;
  requestHeaders?: Record<string, string | undefined>;
}): Promise<EditorHandlerResult> => {
  const { method, subpath, config, runtime, supabaseEnv, authProfile } = options;
  const body = (options.body ?? {}) as Record<string, unknown>;
  const usageStore = createTranslateUsageStore(supabaseEnv ?? {});

  if (method === 'POST' && subpath.startsWith('admin/')) {
    if (!authProfile) return fail('No autenticado.', 401);
    return handleAdminRoute({
      subpath,
      body,
      profile: authProfile,
      env: supabaseEnv ?? {},
    });
  }

  if (method === 'POST' && subpath === 'prepare-archive-audio-upload') {
    const accessKey = config.archive?.accessKey || '';
    const secretKey = config.archive?.secretKey || '';
    const collection = config.archive?.collection || 'opensource_audio';
    if (!accessKey || !secretKey) {
      return fail('Faltan IA_ACCESS_KEY o IA_SECRET_KEY en entorno.');
    }

    const programId = sanitizeSegment(String(body.programId || ''));
    const episodeId = sanitizeSegment(String(body.episodeId || ''));
    const date = String(body.date || '').trim();
    const mimeType = String(body.mimeType || 'audio/mpeg').trim().toLowerCase();
    const fileSizeBytes = Number(body.fileSizeBytes || 0);

    if (!programId || !episodeId) {
      return fail('Faltan campos requeridos.');
    }
    if (authProfile && !canAccessProgram(authProfile, programId)) {
      return fail('No tenés permiso para subir audio a este programa.', 403);
    }
    if (mimeType !== 'audio/mpeg' && mimeType !== 'audio/mp3') {
      return fail('Solo se permite subir MP3 a Archive.org.');
    }
    if (fileSizeBytes < 1024) return fail('Audio vacío o corrupto.');
    if (fileSizeBytes > MAX_AUDIO_BYTES) return fail('Audio demasiado grande (máx. 512 MB).');

    try {
      const plan = buildArchiveUploadPlan({
        accessKey,
        secretKey,
        collection,
        programId,
        episodeId,
        date,
        mimeType: 'audio/mpeg',
        fileName: String(body.fileName || `${episodeId}.mp3`),
      });

      return ok({
        message: 'Permiso de subida a Archive.org generado.',
        identifier: plan.identifier,
        itemUrl: plan.itemUrl,
        audioUrl: plan.audioUrl,
        fileName: plan.fileName,
        putUrl: plan.putUrl,
        uploadHeaders: plan.uploadHeaders,
      });
    } catch (error) {
      return fail(error instanceof Error ? error.message : 'Error al preparar subida.', 502);
    }
  }

  if (method === 'POST' && subpath === 'upload-episode-audio-proxy') {
    const accessKey = config.archive?.accessKey || '';
    const secretKey = config.archive?.secretKey || '';
    const collection = config.archive?.collection || 'opensource_audio';
    if (!accessKey || !secretKey) {
      return fail('Faltan IA_ACCESS_KEY o IA_SECRET_KEY en entorno.');
    }

    const fileBuffer = options.binaryBody;
    if (!fileBuffer || fileBuffer.byteLength < 1024) {
      return fail('Audio vacío o corrupto.');
    }
    if (fileBuffer.byteLength > MAX_AUDIO_BYTES) {
      return fail('Audio demasiado grande (máx. 512 MB).');
    }

    const meta = parseArchiveUploadMetaFromHeaders(options.requestHeaders ?? {});
    if (!meta.programId || !meta.episodeId) {
      return fail('Faltan metadatos del episodio (programId, episodeId).');
    }
    if (authProfile && !canAccessProgram(authProfile, meta.programId)) {
      return fail('No tenés permiso para subir audio a este programa.', 403);
    }

    try {
      const uploaded = await uploadEpisodeAudioToArchive({
        accessKey,
        secretKey,
        collection,
        programId: meta.programId,
        episodeId: meta.episodeId,
        date: meta.date,
        mimeType: 'audio/mpeg',
        fileName: meta.fileName,
        fileBuffer,
      });

      return ok({ message: 'Audio subido a Archive.org.', ...uploaded });
    } catch (error) {
      return fail(error instanceof Error ? error.message : 'Error al subir audio.', 502);
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
    const date = String(body.date || '').trim();
    const mimeType = String(body.mimeType || '').trim().toLowerCase();
    const ext = ARCHIVE_ALLOWED_AUDIO_MIME[mimeType];

    if (!programId || !episodeId || !body.dataBase64 || !mimeType || !ext) {
      return fail('Faltan campos requeridos o mimeType inválido.');
    }
    if (authProfile && !canAccessProgram(authProfile, programId)) {
      return fail('No tenés permiso para subir audio a este programa.', 403);
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

      const uploaded = await uploadEpisodeAudioToArchive({
        accessKey,
        secretKey,
        collection,
        programId,
        episodeId,
        date,
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
    const usedChars = await usageStore.readTranslateUsage(month);

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
      await usageStore.writeTranslateUsage(month, nextUsedChars, monthlyLimit);
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
