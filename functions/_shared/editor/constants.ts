export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const MIME_TO_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
};

export const ARCHIVE_ALLOWED_AUDIO_MIME: Record<string, string> = {
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

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_AUDIO_BYTES = 512 * 1024 * 1024;

export const sanitizeSegment = (input: string): string =>
  input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);

export const safeIdSegment = (raw: string, label: string): string => {
  const s = raw
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
  if (!s) throw new Error(`${label} inválido.`);
  return s;
};

export const decodeBase64Payload = (raw: string, pattern?: RegExp): string => {
  let b64 = String(raw).trim();
  if (pattern) {
    const match = pattern.exec(b64);
    if (match) b64 = match[1];
  }
  return b64;
};
