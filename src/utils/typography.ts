/**
 * Typography Utilities
 * 
 * Follows DRY Principle:
 * - Centralized typography styles and configurations
 * - Reusable across components
 */

export const TYPOGRAPHY = {
  /**
   * Font family constants
   */
  FONTS: {
    PRIMARY: 'AkzidenzGrotesk, sans-serif',
    FALLBACK: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", sans-serif'
  },

  /**
   * Font weight constants
   */
  WEIGHTS: {
    LIGHT: 300,
    REGULAR: 400,
    MEDIUM: 500,
    SEMIBOLD: 600,
    BOLD: 700,
    BLACK: 900
  },

  /**
   * Common text size configurations
   */
  SIZES: {
    COUNTDOWN: {
      LARGE: 'text-3xl md:text-5xl',
      MEDIUM: 'text-2xl md:text-4xl',
      SMALL: 'text-xl md:text-2xl'
    },
    LABEL: {
      LARGE: 'text-sm md:text-base',
      MEDIUM: 'text-xs md:text-sm',
      SMALL: 'text-xs'
    },
    LOGO: {
      LARGE: 'text-6xl md:text-8xl',
      MEDIUM: 'text-4xl md:text-6xl',
      SMALL: 'text-2xl md:text-4xl'
    }
  }
} as const;

/**
 * Get font style object for consistent typography
 */
export const getFontStyle = (weight: number = TYPOGRAPHY.WEIGHTS.REGULAR) => ({
  fontFamily: TYPOGRAPHY.FONTS.PRIMARY,
  fontWeight: weight
});

/**
 * Get combined CSS classes for text styling
 */
export const getTextClasses = (
  size: string,
  color: string = 'text-white',
  additional: string = ''
) => {
  return `${size} ${color} ${additional}`.trim();
};
