/**
 * Time Constants
 * 
 * Follows DRY Principle:
 * - Centralized time-related constants
 * - Avoids magic numbers throughout the codebase
 */

export const TIME_CONSTANTS = {
  /**
   * Milliseconds in different time units
   */
  MILLISECONDS: {
    SECOND: 1000,
    MINUTE: 1000 * 60,
    HOUR: 1000 * 60 * 60,
    DAY: 1000 * 60 * 60 * 24
  },

  /**
   * Common time intervals
   */
  INTERVALS: {
    COUNTDOWN_UPDATE: 1000, // 1 second
    CLOCK_UPDATE: 1000,     // 1 second
    MINUTE_UPDATE: 60000    // 1 minute
  },

  /**
   * Time unit labels (can be localized later)
   */
  LABELS: {
    DAYS: 'Days',
    HOURS: 'Hours', 
    MINUTES: 'Minutes',
    SECONDS: 'Seconds'
  },

  /**
   * Spanish labels (for current use)
   */
  LABELS_ES: {
    DAYS: 'Días',
    HOURS: 'Horas',
    MINUTES: 'Minutos', 
    SECONDS: 'Segundos'
  }
} as const;
