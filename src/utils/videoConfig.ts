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
    '/videos/background5.mp4'
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

/**
 * Validates if a video path exists in the available videos
 * @param videoPath - The video path to validate
 * @returns {boolean} True if the video exists in the configuration
 */
export const isValidVideo = (videoPath: string): boolean => {
  return VIDEO_CONFIG.videos.includes(videoPath as typeof VIDEO_CONFIG.videos[number]);
};
