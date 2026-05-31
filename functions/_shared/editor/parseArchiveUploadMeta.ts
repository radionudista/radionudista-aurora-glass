import { sanitizeSegment } from './constants';

export interface ArchiveUploadMeta {
  programId: string;
  episodeId: string;
  date: string;
  fileName: string;
}

const base64ToUtf8 = (b64: string): string => {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(b64, 'base64').toString('utf8');
  }
  const binary = atob(b64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

const parseMetaJson = (raw: unknown): ArchiveUploadMeta | null => {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  return {
    programId: sanitizeSegment(String(data.programId || '')),
    episodeId: sanitizeSegment(String(data.episodeId || '')),
    date: String(data.date || '').trim(),
    fileName: String(data.fileName || 'episodio.mp3'),
  };
};

export const parseArchiveUploadMetaFromHeaders = (
  headers: Record<string, string | undefined>
): ArchiveUploadMeta => {
  const metaB64 = headers['x-upload-meta'] || headers['X-Upload-Meta'];
  if (metaB64) {
    try {
      const parsed = parseMetaJson(JSON.parse(base64ToUtf8(metaB64)));
      if (parsed) return parsed;
    } catch {
      // fall through to legacy headers
    }
  }

  return {
    programId: sanitizeSegment(String(headers['x-program-id'] || headers['X-Program-Id'] || '')),
    episodeId: sanitizeSegment(String(headers['x-episode-id'] || headers['X-Episode-Id'] || '')),
    date: String(headers['x-episode-date'] || headers['X-Episode-Date'] || '').trim(),
    fileName: String(headers['x-file-name'] || headers['X-File-Name'] || 'episodio.mp3'),
  };
};

export const isArchiveOrgAudioUrl = (url: string): boolean => /archive\.org/i.test(url);
