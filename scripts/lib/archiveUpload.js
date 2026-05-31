/** Lógica compartida para subir MP3 a Archive.org (IAS3). */

export const ARCHIVE_ALLOWED_AUDIO_MIME = {
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

export const EXT_TO_MIME = Object.fromEntries(
  Object.entries(ARCHIVE_ALLOWED_AUDIO_MIME).map(([mime, ext]) => [ext, mime])
);

export const sanitizeSegment = (input) =>
  String(input || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);

export const buildArchiveUploadPlan = ({
  accessKey,
  secretKey,
  collection,
  programId,
  episodeId,
  date,
  mimeType = 'audio/mpeg',
  fileName,
}) => {
  const ext = ARCHIVE_ALLOWED_AUDIO_MIME[mimeType];
  if (!ext) throw new Error(`mimeType inválido: ${mimeType}`);

  const datePart = /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? date
    : new Date().toISOString().slice(0, 10);
  const identifier = sanitizeSegment(`rn-${programId}-${episodeId}-${datePart}`);
  const baseFileName = sanitizeSegment(String(fileName).replace(/\.[a-z0-9]+$/i, ''));
  const uploadFileName = `${baseFileName || `${programId}-${episodeId}`}${ext}`;
  const putUrl = `https://s3.us.archive.org/${encodeURIComponent(identifier)}/${encodeURIComponent(uploadFileName)}`;
  const itemUrl = `https://archive.org/details/${identifier}`;
  const audioUrl = `https://archive.org/download/${identifier}/${encodeURIComponent(uploadFileName)}`;

  const uploadHeaders = {
    authorization: `LOW ${accessKey}:${secretKey}`,
    'x-archive-auto-make-bucket': '1',
    'x-archive-queue-derive': '0',
    'x-archive-meta-mediatype': 'audio',
    'x-archive-meta-collection': collection,
    'x-archive-meta-title': identifier,
    'x-archive-meta-date': datePart,
    'x-archive-meta-creator': programId,
    'content-type': mimeType,
  };

  return { identifier, itemUrl, audioUrl, fileName: uploadFileName, putUrl, uploadHeaders };
};

export const checkArchiveUploadLimit = async (accessKey, bucket = 'bulk-check') => {
  const url = `https://s3.us.archive.org/?check_limit=1&accesskey=${encodeURIComponent(accessKey)}&bucket=${encodeURIComponent(bucket)}`;
  const res = await fetch(url);
  if (!res.ok) return { ready: false, detail: `check_limit HTTP ${res.status}` };
  const body = await res.json();
  return {
    ready: body.over_limit === 0,
    detail: body.detail ?? '',
    overLimit: body.over_limit,
  };
};

export const uploadBufferToArchive = async (options) => {
  const { fileBuffer, ...planInput } = options;
  const plan = buildArchiveUploadPlan(planInput);

  const uploadResponse = await fetch(plan.putUrl, {
    method: 'PUT',
    headers: plan.uploadHeaders,
    body: fileBuffer,
  });

  if (!uploadResponse.ok) {
    const errText = await uploadResponse.text();
    throw new Error(`Archive upload error (${uploadResponse.status}): ${errText.slice(0, 400)}`);
  }

  return {
    identifier: plan.identifier,
    itemUrl: plan.itemUrl,
    audioUrl: plan.audioUrl,
    fileName: plan.fileName,
  };
};

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const uploadBufferWithRetry = async (options, retryOptions = {}) => {
  const {
    maxAttempts = 6,
    baseDelayMs = 30_000,
    accessKey,
    onWait,
  } = retryOptions;

  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const limit = await checkArchiveUploadLimit(accessKey, options.programId);
    if (!limit.ready) {
      const waitMs = baseDelayMs * attempt;
      onWait?.(`Cola IA saturada (over_limit=${limit.overLimit}). Esperando ${Math.round(waitMs / 1000)}s…`);
      await sleep(waitMs);
      continue;
    }

    try {
      return await uploadBufferToArchive(options);
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const isSlowDown = /503|SlowDown|slow down/i.test(message);
      if (!isSlowDown || attempt === maxAttempts) throw error;
      const waitMs = baseDelayMs * attempt;
      onWait?.(`503 SlowDown. Reintento ${attempt}/${maxAttempts} en ${Math.round(waitMs / 1000)}s…`);
      await sleep(waitMs);
    }
  }

  throw lastError ?? new Error('Upload failed after retries.');
};
