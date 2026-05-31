import type { Episode } from '../types';

type ArchiveMetadataFile = { name?: string; size?: string };

export type EpisodeAudioAvailabilityState = 'ready' | 'pending' | 'checking';

const MIN_AUDIO_BYTES = 1024;

export const parseArchiveOrgDownloadUrl = (
  url: string
): { identifier: string; fileName: string } | null => {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes('archive.org')) return null;
    const match = /^\/download\/([^/]+)\/(.+)$/.exec(parsed.pathname);
    if (!match) return null;
    return {
      identifier: decodeURIComponent(match[1]),
      fileName: decodeURIComponent(match[2]),
    };
  } catch {
    return null;
  }
};

/** Any episode with a remote audio URL should be verified before showing Escuchar. */
export const episodeNeedsAudioAvailabilityCheck = (episode: Episode): boolean => {
  const url = episode.audioUrl?.trim() ?? '';
  return /^https?:\/\//i.test(url);
};

const archiveMetadataListsAudio = async (
  audioUrl: string,
  archiveIdentifier?: string
): Promise<boolean> => {
  const parsed = parseArchiveOrgDownloadUrl(audioUrl);
  const identifier = archiveIdentifier?.trim() || parsed?.identifier;
  const expectedFile = parsed?.fileName;

  if (!identifier) return false;

  try {
    const res = await fetch(`https://archive.org/metadata/${encodeURIComponent(identifier)}`);
    if (!res.ok) return false;
    const body = (await res.json()) as { files?: ArchiveMetadataFile[] };
    const files = body.files ?? [];
    if (!files.length) return false;

    if (expectedFile) {
      const file = files.find(
        (entry) =>
          entry.name === expectedFile ||
          entry.name === decodeURIComponent(expectedFile) ||
          entry.name?.endsWith(expectedFile.split('/').pop() ?? '')
      );
      return Boolean(file && Number(file.size ?? 0) > MIN_AUDIO_BYTES);
    }

    const audioFile = files.find((entry) => /\.(mp3|m4a|ogg|flac|wav)$/i.test(entry.name ?? ''));
    return Boolean(audioFile && Number(audioFile.size ?? 0) > MIN_AUDIO_BYTES);
  } catch {
    return false;
  }
};

const isDirectAudioUrlPlayable = async (audioUrl: string): Promise<boolean> => {
  try {
    const head = await fetch(audioUrl, { method: 'HEAD', mode: 'cors' });
    if (head.ok) {
      const length = Number(head.headers.get('content-length') ?? 0);
      if (length === 0 || length > MIN_AUDIO_BYTES) return true;
    }

    const range = await fetch(audioUrl, {
      method: 'GET',
      mode: 'cors',
      headers: { Range: 'bytes=0-4095' },
    });
    if (!(range.ok || range.status === 206)) return false;

    const blob = await range.blob();
    return blob.size > MIN_AUDIO_BYTES;
  } catch {
    return false;
  }
};

export const isEpisodeAudioReady = async (
  audioUrl: string,
  archiveIdentifier?: string
): Promise<boolean> => {
  const url = audioUrl.trim();
  if (!url) return false;

  const isArchive = /archive\.org/i.test(url) || Boolean(archiveIdentifier?.trim());

  if (isArchive) {
    const listed = await archiveMetadataListsAudio(url, archiveIdentifier);
    if (!listed) return false;
  }

  const playable = await isDirectAudioUrlPlayable(url);
  if (playable) return true;

  // Archive.org: metadata can lag behind the download URL (or the reverse).
  if (isArchive) {
    return archiveMetadataListsAudio(url, archiveIdentifier);
  }

  return false;
};

export const resolveEpisodeAudioAvailability = async (
  episode: Episode
): Promise<EpisodeAudioAvailabilityState> => {
  if (!episodeNeedsAudioAvailabilityCheck(episode)) return 'ready';
  const ready = await isEpisodeAudioReady(episode.audioUrl, episode.archiveIdentifier);
  return ready ? 'ready' : 'pending';
};

/** @deprecated Use episodeNeedsAudioAvailabilityCheck */
export const episodeNeedsArchiveAvailabilityCheck = episodeNeedsAudioAvailabilityCheck;

/** @deprecated Use isEpisodeAudioReady */
export const isArchiveOrgEpisodeAudioReady = isEpisodeAudioReady;
