/**
 * Media Constants
 * 
 * Follows DRY Principle:
 * - Centralized media-related constants
 * - Eliminates magic numbers for aspect ratios and media settings
 */

export const MEDIA_CONSTANTS = {
  /**
   * Common aspect ratios
   */
  ASPECT_RATIOS: {
    VIDEO_16_9: '56.25%', // 16:9 aspect ratio
    VIDEO_4_3: '75%',     // 4:3 aspect ratio
    SQUARE: '100%',       // 1:1 aspect ratio
    WIDE: '42.857%'       // 21:9 ultrawide
  },

  /**
   * Animation and update intervals (in milliseconds)
   */
  INTERVALS: {
    FFT_UPDATE: 150,        // FFT visualization update rate
    TRACK_INFO_UPDATE: 10000, // Track info fetch interval
    LOADING_ANIMATION: 200   // Loading state animation
  },

  /**
   * Audio visualization settings
   */
  VISUALIZATION: {
    FFT_BARS: 8,           // Number of FFT bars
    MIN_BAR_HEIGHT: 10,    // Minimum bar height in pixels
    MAX_BAR_HEIGHT: 50,    // Maximum bar height in pixels
    BAR_UPDATE_RATE: 150   // Bar animation update rate
  },

  /**
   * Stream configuration
   */
  STREAM: {
    DEFAULT_TRACK: 'RadioNudista - Live Stream',
    PRELOAD: 'none' as const,
    UPDATE_INTERVAL: 10000
  },

  /**
   * Media control sizes
   */
  CONTROL_SIZES: {
    SMALL: {
      container: 24,    // 6 * 4px
      spinner: 12,      // 3 * 4px
      icon: 16          // 4 * 4px
    },
    MEDIUM: {
      container: 48,    // 12 * 4px
      spinner: 16,      // 4 * 4px
      icon: 24          // 6 * 4px
    },
    LARGE: {
      container: 80,    // 20 * 4px
      spinner: 24,      // 6 * 4px
      icon: 32          // 8 * 4px
    }
  }
} as const;

/**
 * Get aspect ratio padding for video containers
 */
export const getAspectRatioPadding = (ratio: keyof typeof MEDIA_CONSTANTS.ASPECT_RATIOS) => ({
  paddingBottom: MEDIA_CONSTANTS.ASPECT_RATIOS[ratio]
});

/**
 * Generate random FFT bar height within configured range
 */
export const generateRandomBarHeight = (): number => {
  return Math.random() * 
    (MEDIA_CONSTANTS.VISUALIZATION.MAX_BAR_HEIGHT - MEDIA_CONSTANTS.VISUALIZATION.MIN_BAR_HEIGHT) + 
    MEDIA_CONSTANTS.VISUALIZATION.MIN_BAR_HEIGHT;
};

/**
 * Generate array of random bar heights for FFT visualization
 */
export const generateFFTBars = (count: number = MEDIA_CONSTANTS.VISUALIZATION.FFT_BARS): number[] => {
  return Array.from({ length: count }, generateRandomBarHeight);
};
