import React, { useState, useEffect, useRef } from 'react';
import { selectRandomVideo, VIDEO_CONFIG } from '../utils/videoConfig';

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
  }, []); // Empty dependency array ensures this runs once when component mounts

  useEffect(() => {
    // Force video to load when currentVideo changes
    if (videoRef.current) {
      videoRef.current.load();
    }
  }, [currentVideo]);

  const handleVideoLoadedData = () => {
    // Ensure video starts playing after loading new source
    if (videoRef.current) {
      videoRef.current.play().catch(error => {
        console.log('Video autoplay prevented:', error);
      });
    }
  };

  return (
    <>
      {/* Background Video */}
      <video 
        ref={videoRef}
        key={videoKey}
        className={`fixed inset-0 w-full h-full object-cover z-0 ${className}`}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        onLoadedData={handleVideoLoadedData}
      >
        <source src={`${currentVideo}?t=${videoKey}`} type="video/mp4" />
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
