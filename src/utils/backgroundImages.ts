/**
 * Background Image Configuration
 * 
 * Follows SOLID Principles:
 * - SRP: Single responsibility for background image management
 * - OCP: Open for extension with new images
 * - DRY: Centralized image configuration
 */

export interface BackgroundImage {
  id: string;
  path: string;
  alt: string;
}

/**
 * Available background images for loading states
 */
export const BACKGROUND_IMAGES: BackgroundImage[] = [
  {
    id: 'bg1',
    path: '/images/backgrounds/background1.png',
    alt: 'Background 1'
  },
  {
    id: 'bg2', 
    path: '/images/backgrounds/background2.png',
    alt: 'Background 2'
  },
  {
    id: 'bg3',
    path: '/images/backgrounds/background3.png', 
    alt: 'Background 3'
  },
  {
    id: 'bg4',
    path: '/images/backgrounds/background4.png',
    alt: 'Background 4'
  },
  {
    id: 'bg5',
    path: '/images/backgrounds/background5.png',
    alt: 'Background 5'
  },
  {
    id: 'bg6',
    path: '/images/backgrounds/background6.png',
    alt: 'Background 6'
  },
  {
    id: 'bg7',
    path: '/images/backgrounds/background7.png',
    alt: 'Background 7'
  },
  {
    id: 'bg8',
    path: '/images/backgrounds/background8.png',
    alt: 'Background 8'
  },
  {
    id: 'bg9',
    path: '/images/backgrounds/background9.png',
    alt: 'Background 9'
  },
  {
    id: 'bg10',
    path: '/images/backgrounds/background10.png',
    alt: 'Background 10'
  }
];

/**
 * Select a random background image
 */
export const selectRandomBackgroundImage = (): BackgroundImage => {
  const randomIndex = Math.floor(Math.random() * BACKGROUND_IMAGES.length);
  return BACKGROUND_IMAGES[randomIndex];
};

/**
 * Preload background images for better performance
 */
export const preloadBackgroundImages = (imagesToPreload: BackgroundImage[] = BACKGROUND_IMAGES): Promise<void[]> => {
  const preloadPromises = imagesToPreload.map(image => {
    return new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => reject(new Error(`Failed to preload image: ${image.path}`));
      img.src = image.path;
    });
  });

  return Promise.all(preloadPromises);
};

/**
 * Background image transitions configuration
 */
export const BACKGROUND_TRANSITIONS = {
  FADE_DURATION: 1000,        // Fade transition duration in ms
  IMAGE_TO_VIDEO_DELAY: 500,  // Delay before starting video transition
  OPACITY_FULL: 1,            // Full opacity
  OPACITY_HIDDEN: 0,          // Hidden opacity
  
  // Enhanced transition curves
  EASING_CURVES: {
    SMOOTH: 'cubic-bezier(0.4, 0.0, 0.2, 1)',     // Material Design standard
    ELEGANT: 'cubic-bezier(0.25, 0.1, 0.25, 1)',   // Elegant and natural
    DRAMATIC: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)', // Dramatic with slight bounce
    LINEAR: 'linear'                                // Linear transition
  }
} as const;

export type TransitionCurve = keyof typeof BACKGROUND_TRANSITIONS.EASING_CURVES;
