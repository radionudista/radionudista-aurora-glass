import React from 'react';
import { useVideo } from '../contexts/VideoContext';

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
 * - Only responsible for rendering background video
 * 
 * Follows Open/Closed Principle:
 * - Open for extension through props
 * - Closed for modification of core functionality
 */
const BackgroundVideo: React.FC<BackgroundVideoProps> = ({
  className = '',
  showFallbackGradient = true,
  showOverlay = true,
  overlayOpacity = 0.4
}) => {
  const { currentVideo } = useVideo();

  // Debug: Log the current video path
  console.log('BackgroundVideo - Current video:', currentVideo);

  return (
    <>
      {/* Background Video */}
      <video 
        className={`fixed inset-0 w-full h-full object-cover z-0 ${className}`}
        autoPlay
        muted
        loop
        playsInline
      >
        <source src={currentVideo} type="video/mp4" />
      </video>
      
      {/* Fallback gradient background */}
      {showFallbackGradient && (
        <div className="fixed inset-0 w-full h-full bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 z-[-1]" />
      )}
      
      {/* Overlay for better contrast */}
      {showOverlay && (
        <div 
          className="fixed inset-0 z-[1]" 
          style={{ backgroundColor: `rgba(0, 0, 0, ${overlayOpacity})` }}
        />
      )}
    </>
  );
};

export default BackgroundVideo;
