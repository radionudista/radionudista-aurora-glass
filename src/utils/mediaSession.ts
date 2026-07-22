const DEFAULT_ARTWORK_PATH = '/icon-512.png';
const ARTWORK_SIZES = ['96x96', '192x192', '512x512'] as const;

export type NowPlayingParts = {
  title: string;
  artist: string;
};

/**
 * Split "Artist - Title" style now-playing strings from BRLogic.
 * Falls back to the full string as title when no separator is present.
 */
export function parseNowPlayingTrack(track: string, fallbackArtist = 'Radionudista'): NowPlayingParts {
  const cleaned = track.replace(/\s+/g, ' ').trim();
  if (!cleaned) {
    return { title: 'En vivo', artist: fallbackArtist };
  }

  const separators = [' - ', ' – ', ' — ', ' | '];
  for (const sep of separators) {
    const idx = cleaned.indexOf(sep);
    if (idx > 0 && idx < cleaned.length - sep.length) {
      const artist = cleaned.slice(0, idx).trim();
      const title = cleaned.slice(idx + sep.length).trim();
      if (artist && title) {
        return { title, artist };
      }
    }
  }

  return { title: cleaned, artist: fallbackArtist };
}

function toAbsoluteUrl(url: string): string | null {
  try {
    return new URL(url, typeof window !== 'undefined' ? window.location.origin : 'https://radionudista.com').href;
  } catch {
    return null;
  }
}

function buildArtwork(src: string | null | undefined): MediaImage[] {
  const absolute =
    toAbsoluteUrl(src || DEFAULT_ARTWORK_PATH) ||
    toAbsoluteUrl(DEFAULT_ARTWORK_PATH);

  if (!absolute) return [];

  return ARTWORK_SIZES.map((sizes) => ({
    src: absolute,
    sizes,
    type: 'image/png',
  }));
}

export function isMediaSessionSupported(): boolean {
  return typeof navigator !== 'undefined' && 'mediaSession' in navigator;
}

export function updateMediaSessionMetadata(options: {
  title: string;
  artist: string;
  album?: string;
  artworkUrl?: string | null;
}): void {
  if (!isMediaSessionSupported() || typeof MediaMetadata === 'undefined') return;

  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: options.title,
      artist: options.artist,
      album: options.album || 'Radionudista',
      artwork: buildArtwork(options.artworkUrl),
    });
  } catch {
    // Safari can throw if artwork URLs are invalid; ignore and keep playback.
  }
}

export function setMediaSessionPlaybackState(
  state: MediaSessionPlaybackState
): void {
  if (!isMediaSessionSupported()) return;
  try {
    navigator.mediaSession.playbackState = state;
  } catch {
    // Older Safari builds may not allow setting playbackState.
  }
}

export function clearMediaSession(): void {
  if (!isMediaSessionSupported()) return;
  try {
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.playbackState = 'none';
  } catch {
    // no-op
  }
}

type MediaSessionActionHandlers = {
  play: () => void;
  pause: () => void;
};

/**
 * Bind lock-screen / Control Center play/pause. Skip seek handlers on purpose
 * (live stream UX is imperfect on iOS and out of scope).
 */
export function bindMediaSessionActionHandlers(
  handlers: MediaSessionActionHandlers
): () => void {
  if (!isMediaSessionSupported()) return () => undefined;

  const actions: MediaSessionAction[] = ['play', 'pause'];

  for (const action of actions) {
    try {
      navigator.mediaSession.setActionHandler(action, () => {
        if (action === 'play') handlers.play();
        else handlers.pause();
      });
    } catch {
      // Action may be unsupported on this browser.
    }
  }

  return () => {
    for (const action of actions) {
      try {
        navigator.mediaSession.setActionHandler(action, null);
      } catch {
        // no-op
      }
    }
  };
}
