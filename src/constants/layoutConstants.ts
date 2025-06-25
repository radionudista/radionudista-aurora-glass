/**
 * Layout Configuration Constants
 * 
 * Follows DRY Principle:
 * - Centralized layout values and spacing
 * - Consistent spacing across components
 */

export const LAYOUT = {
  /**
   * Z-index levels for layering
   */
  Z_INDEX: {
    BACKGROUND: 0,
    OVERLAY: 1,
    CONTENT: 10,
    NAVIGATION: 50,
    CREDITS: 60,
    MODAL: 100
  },

  /**
   * Common spacing values
   */
  SPACING: {
    PAGE_PADDING: 'px-6',
    SECTION_MARGIN: 'mb-12',
    GRID_GAP: 'gap-4 md:gap-8',
    CONTAINER_PADDING: 'p-8',
    NAVIGATION_HEIGHT: 'pt-20 pb-20'
  },

  /**
   * Glass morphism classes
   */
  GLASS: {
    CARD: 'glass-card',
    NAVBAR: 'glass-navbar',
    FOOTER: 'glass-footer',
    CONTAINER: 'glass-container',
    INPUT: 'glass-input',
    BUTTON: 'glass-button'
  },

  /**
   * Common layout patterns
   */
  PATTERNS: {
    FULLSCREEN: 'min-h-screen w-full overflow-hidden relative',
    CENTERED: 'min-h-screen flex flex-col items-center justify-center',
    FIXED_OVERLAY: 'fixed inset-0 w-full h-full'
  }
} as const;

/**
 * Get glass effect classes with custom opacity
 */
export const getGlassOverlay = (opacity: number = 0.4) => ({
  className: 'fixed inset-0',
  style: { backgroundColor: `rgba(0, 0, 0, ${opacity})` }
});
