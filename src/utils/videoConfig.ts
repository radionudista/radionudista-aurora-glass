/**
 * Video Configuration Utility
 * 
 * Follows Single Responsibility Principle:
 * - Only responsible for video-related configuration
 * 
 * Follows DRY Principle:
 * - Centralized list of available videos
 * - Reusable random selection logic
 */

export const VIDEO_CONFIG = {
  videos: [
    '/videos/background1.mp4',
    '/videos/background2.mp4',
    '/videos/background3.mp4',
    '/videos/background5.mp4',
    '/videos/background4.mp4',
    '/videos/background6.mp4'
  ],
  defaultVideo: '/videos/background5.mp4'
} as const;

/**
 * Selects a random video from the available video list
 * @returns {string} Path to a randomly selected video
 */
export const selectRandomVideo = (): string => {
  const randomIndex = Math.floor(Math.random() * VIDEO_CONFIG.videos.length);
  return VIDEO_CONFIG.videos[randomIndex];
};

const shuffleVideos = (videos: readonly string[]): string[] => {
  const pool = [...videos];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
};

/**
 * Gets the next video from a per-user randomized cycle.
 * It avoids repeats until all videos are consumed, then reshuffles.
 */
export const getNextVideoFromCycle = (storageKey: string): string => {
  const fallback = VIDEO_CONFIG.defaultVideo;
  const availableVideos = Array.from(new Set(VIDEO_CONFIG.videos));

  if (typeof window === 'undefined') {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    const parsed = raw ? (JSON.parse(raw) as { queue?: string[]; lastPlayed?: string } | string[]) : null;

    const legacyQueue = Array.isArray(parsed) ? parsed : [];
    const queueFromState = !Array.isArray(parsed) ? parsed?.queue ?? [] : [];
    const queueSource = queueFromState.length > 0 ? queueFromState : legacyQueue;
    const lastPlayed = !Array.isArray(parsed) ? parsed?.lastPlayed ?? null : null;

    let queue = queueSource
      .filter((path): path is string => typeof path === 'string')
      .filter((path) => availableVideos.includes(path))
      .filter((path, index, arr) => arr.indexOf(path) === index);

    if (queue.length === 0) {
      queue = shuffleVideos(availableVideos);
      // Avoid immediate repeat when a cycle restarts.
      if (lastPlayed && queue.length > 1 && queue[0] === lastPlayed) {
        const swapIndex = queue.findIndex((item) => item !== lastPlayed);
        if (swapIndex > 0) {
          [queue[0], queue[swapIndex]] = [queue[swapIndex], queue[0]];
        }
      }
    }

    // Guard against stale/corrupt state where the next candidate repeats immediately.
    if (lastPlayed && queue.length > 1 && queue[0] === lastPlayed) {
      const nextIndex = queue.findIndex((item) => item !== lastPlayed);
      if (nextIndex > 0) {
        [queue[0], queue[nextIndex]] = [queue[nextIndex], queue[0]];
      }
    }

    if (lastPlayed && queue.length === 1 && queue[0] === lastPlayed && availableVideos.length > 1) {
      queue = shuffleVideos(availableVideos.filter((video) => video !== lastPlayed));
    }

    const nextVideo = queue.shift() || fallback;
    const stateToPersist = {
      queue,
      lastPlayed: nextVideo,
    };
    window.localStorage.setItem(storageKey, JSON.stringify(stateToPersist));
    return nextVideo;
  } catch {
    return selectRandomVideo();
  }
};

/**
 * Validates if a video path exists in the available videos
 * @param videoPath - The video path to validate
 * @returns {boolean} True if the video exists in the configuration
 */
export const isValidVideo = (videoPath: string): boolean => {
  return VIDEO_CONFIG.videos.includes(videoPath as typeof VIDEO_CONFIG.videos[number]);
};
