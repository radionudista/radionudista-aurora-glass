import React, { useState, useEffect, useRef } from 'react';
import { selectRandomVideo, VIDEO_CONFIG } from '../utils/videoConfig';
import { LAYOUT, getGlassOverlay } from '../constants/layoutConstants';
import { useBackgroundTransition } from '../hooks/useBackgroundTransition';

interface BackgroundVideoProps {
  /**
   * Additional CSS classes for the video element
   */
  className?: string;
  
  /**
   * Whether to show the fallback gradient background
   */
  showFallbackGradient?: boolean;
  
  /**
   * Whether to show the overlay for better contrast
   */
  showOverlay?: boolean;
  
  /**
   * Custom overlay opacity (0-1)
   */
  overlayOpacity?: number;
}

/**
 * BackgroundVideo Component
 * 
 * Follows Single Responsibility Principle:
 * - Only responsible for rendering background video with smooth image-to-video transition
 * 
 * Follows Open/Closed Principle:
 * - Open for extension through props
 * - Closed for modification of core functionality
 *
 * Follows DRY Principle:
 * - Uses centralized layout constants and background transition logic
 * - Reuses background image utilities and transition hook
 *
 * Features:
 * - Shows random background image while video loads
 * - Smooth transition from image to video
 * - Fallback gradient background
 * - Configurable overlay for better contrast
 */
const BackgroundVideo: React.FC<BackgroundVideoProps> = ({
  className = '',
  showFallbackGradient = true,
  showOverlay = true,
  overlayOpacity = 0.4
}) => {
  const [currentVideo, setCurrentVideo] = useState<string>(VIDEO_CONFIG.defaultVideo);
  const [videoKey, setVideoKey] = useState<number>(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Select a random video each time the component mounts
    const randomVideo = selectRandomVideo();
    setCurrentVideo(randomVideo);
    // Force video reload by changing the key
    setVideoKey(prev => prev + 1);
    
    // Debug: Log the selected video for development
    console.log('BackgroundVideo - Random video selected:', randomVideo);
    console.log('BackgroundVideo - Component initialized');
  }, []); // Empty dependency array ensures this runs once when component mounts

  useEffect(() => {
    // Force video to load when currentVideo changes
    if (videoRef.current) {
      videoRef.current.load();
      console.log('BackgroundVideo - Video load() called for:', currentVideo);
    }
  }, [currentVideo]);

  const overlayConfig = getGlassOverlay(overlayOpacity);

  return (
    <>
      {/* Background Image (shown while video loads) */}
      {showImage && currentImage && (
        <div
          className={`${LAYOUT.PATTERNS.FIXED_OVERLAY} bg-cover bg-center bg-no-repeat z-[${LAYOUT.Z_INDEX.BACKGROUND}]`}
          style={{
            backgroundImage: `url(${currentImage.path})`,
            ...transitionStyles.image
          }}
          role="img"
          aria-label={currentImage.alt}
        />
      )}

      {/* Background Video - Always rendered for smooth crossfade */}
      <video 
        ref={videoRef}
        key={videoKey}
        className={`${LAYOUT.PATTERNS.FIXED_OVERLAY} object-cover z-[${LAYOUT.Z_INDEX.BACKGROUND}] ${className}`}
        style={transitionStyles.video}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        onLoadedData={handleVideoLoadedData}
        onCanPlay={handleVideoCanPlay}
        onLoadStart={() => console.log('BackgroundVideo - Video started loading')}
        onProgress={() => console.log('BackgroundVideo - Video loading progress')}
        onCanPlayThrough={() => console.log('BackgroundVideo - Video can play through')}
      >
        <source src={`${currentVideo}?t=${videoKey}`} type="video/mp4" />
      </video>
      
      {/* Fallback gradient background */}
      {showFallbackGradient && (
        <div className={`${LAYOUT.PATTERNS.FIXED_OVERLAY} bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 z-[-1]`} />
      )}
      
      {/* Overlay for better contrast */}
      {showOverlay && (
        <div 
          className={`${overlayConfig.className} z-[${LAYOUT.Z_INDEX.OVERLAY}]`}
          style={overlayConfig.style}
        />
      )}

      {/* Debug Info - Remove in production */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed top-4 left-4 z-50 bg-black/80 text-white p-2 rounded text-xs space-y-1">
          <div>Image: {showImage ? 'Visible' : 'Hidden'} (opacity: {imageOpacity})</div>
          <div>Video: Ready={isVideoReady ? 'Yes' : 'No'} (opacity: {videoOpacity})</div>
          <div>Current Image: {currentImage?.id || 'None'}</div>
          <div>Current Video: {currentVideo.split('/').pop()}</div>
        </div>
      )}

      {/* Video Credits */}
      <div className={`fixed bottom-20 right-4 z-[${LAYOUT.Z_INDEX.CREDITS}] text-white/60 text-xs font-light backdrop-blur-sm bg-black/20 px-2 py-1 rounded-sm transition-all duration-300`}>
        Visuals by{' '}
        <a 
          href="https://www.instagram.com/gachapon3000" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 hover:underline transition-colors duration-200"
        >
          @Gachapon3000
        </a>
      </div>
    </>
  );
};

export default BackgroundVideo;
