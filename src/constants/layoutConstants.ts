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
 * Shared visual scale for primary screen titles (main h1).
 * Add `text-white` on dark backgrounds or a contrasting `text-*` on light pages.
 */
export const PAGE_SCREEN_TITLE_CLASS =
  "font-['Space_Grotesk'] text-6xl font-black uppercase tracking-tighter md:text-8xl";

/**
 * Shared shell below the fixed nav: gutter + top offset + bottom padding.
 * Keeps route titles aligned between Archivos (programación) and Schedule.
 */
export const PAGE_SHELL_BELOW_NAV =
  'bg-black px-3 pb-16 pt-24 text-white md:px-6';

/** Centered content column used by list-style pages (matches max width across routes). */
export const PAGE_SHELL_CONTENT = 'mx-auto w-full max-w-[1700px]';

/**
 * Get glass effect classes with custom opacity
 */
export const getGlassOverlay = (opacity: number = 0.4) => ({
  className: 'fixed inset-0',
  style: { backgroundColor: `rgba(0, 0, 0, ${opacity})` }
});
