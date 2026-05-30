import { ARCHIVE_ALLOWED_AUDIO_MIME, sanitizeSegment } from './constants';

export const uploadEpisodeAudioToArchive = async (options: {
  accessKey: string;
  secretKey: string;
  collection: string;
  programId: string;
  episodeId: string;
  episodeTitle: string;
  date: string;
  description: string;
  tags: string[];
  mimeType: string;
  fileName: string;
  fileBuffer: ArrayBuffer;
}): Promise<{
  identifier: string;
  itemUrl: string;
  audioUrl: string;
  fileName: string;
}> => {
  const {
    accessKey,
    secretKey,
    collection,
    programId,
    episodeId,
    episodeTitle,
    date,
    description,
    tags,
    mimeType,
    fileName,
    fileBuffer,
  } = options;

  const ext = ARCHIVE_ALLOWED_AUDIO_MIME[mimeType];
  if (!ext) {
    throw new Error('mimeType inválido.');
  }

  const datePart = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10);
  const identifier = sanitizeSegment(`rn-${programId}-${episodeId}-${datePart}`);
  const baseFileName = sanitizeSegment(fileName.replace(/\.[a-z0-9]+$/i, ''));
  const uploadFileName = `${baseFileName || `${programId}-${episodeId}`}${ext}`;
  const archivePutUrl = `https://s3.us.archive.org/${encodeURIComponent(identifier)}/${encodeURIComponent(uploadFileName)}`;
  const itemUrl = `https://archive.org/details/${identifier}`;
  const audioUrl = `https://archive.org/download/${identifier}/${encodeURIComponent(uploadFileName)}`;

  const headers: Record<string, string> = {
    authorization: `LOW ${accessKey}:${secretKey}`,
    'x-archive-auto-make-bucket': '1',
    'x-archive-queue-derive': '0',
    'x-archive-meta-mediatype': 'audio',
    'x-archive-meta-collection': collection,
    'x-archive-meta-title': episodeTitle,
    'x-archive-meta-description': String(description || '').slice(0, 5000),
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
    throw new Error(`Archive upload error (${uploadResponse.status}): ${errText.slice(0, 400)}`);
  }

  return { identifier, itemUrl, audioUrl, fileName: uploadFileName };
};

export const decodeAudioBase64 = (dataBase64: string): ArrayBuffer => {
  const b64 = (() => {
    const raw = String(dataBase64).trim();
    const match = /^data:audio\/[a-z0-9.+-]+;base64,(.+)$/i.exec(raw);
    return match ? match[1] : raw;
  })();

  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

/** Node-friendly decode for local dev server. */
export const decodeAudioBase64Node = (dataBase64: string): Buffer => {
  const raw = String(dataBase64).trim();
  const match = /^data:audio\/[a-z0-9.+-]+;base64,(.+)$/i.exec(raw);
  const b64 = match ? match[1] : raw;
  return Buffer.from(b64, 'base64');
};
