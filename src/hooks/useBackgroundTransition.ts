/**
 * Background Transition Hook
 * 
 * Follows SOLID Principles:
 * - SRP: Single responsibility for background transition logic
 * - OCP: Open for extension with different transition types
 * - DRY: Reusable transition logic
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  BackgroundImage, 
  selectRandomBackgroundImage, 
  BACKGROUND_TRANSITIONS,
  TransitionCurve
} from '../utils/backgroundImages';

export interface BackgroundTransitionState {
  currentImage: BackgroundImage | null;
  isVideoReady: boolean;
  isTimerReady: boolean; // New: tracks if 10 seconds have passed
  showImage: boolean;
  showVideo: boolean;
  imageOpacity: number;
  videoOpacity: number;
}

export interface UseBackgroundTransitionOptions {
  videoRef: React.RefObject<HTMLVideoElement>;
  transitionDuration?: number;
  minimumDisplayTime?: number; // Changed from preTransitionDelay to minimumDisplayTime (10 seconds)
  transitionCurve?: TransitionCurve; // New: customizable transition curve
}

export const useBackgroundTransition = ({
  videoRef,
  transitionDuration = 1000, // 1 second default transition
  minimumDisplayTime = 10000, // 10 seconds default
  transitionCurve = 'ELEGANT' // Default to elegant curve
}: UseBackgroundTransitionOptions) => {
  const [state, setState] = useState<BackgroundTransitionState>({
    currentImage: null,
    isVideoReady: false,
    isTimerReady: false,
    showImage: true,
    showVideo: false,
    imageOpacity: BACKGROUND_TRANSITIONS.OPACITY_FULL,
    videoOpacity: BACKGROUND_TRANSITIONS.OPACITY_HIDDEN
  });

  // Initialize with random background image and start timer
  useEffect(() => {
    const randomImage = selectRandomBackgroundImage();
    setState(prev => ({
      ...prev,
      currentImage: randomImage
    }));

    console.log('BackgroundTransition - Random image selected:', randomImage);
    console.log('BackgroundTransition - Starting 10 second timer');

    // Set timer for minimum display time (10 seconds)
    const timer = setTimeout(() => {
      console.log('BackgroundTransition - 10 second timer completed');
      setState(prev => ({
        ...prev,
        isTimerReady: true
      }));
    }, minimumDisplayTime);

    return () => clearTimeout(timer);
  }, [minimumDisplayTime]);

  // Start the transition from image to video
  const startTransition = useCallback(() => {
    console.log('BackgroundTransition - Starting crossfade transition');
    
    // Start showing video and begin simultaneous opacity transition
    setState(prev => ({
      ...prev,
      showVideo: true,
      // Start crossfade: video opacity increases while image opacity decreases
      videoOpacity: BACKGROUND_TRANSITIONS.OPACITY_FULL,
      imageOpacity: BACKGROUND_TRANSITIONS.OPACITY_HIDDEN
    }));

    // Hide image completely after transition completes
    setTimeout(() => {
      setState(prev => ({
        ...prev,
        showImage: false
      }));
      console.log('BackgroundTransition - Crossfade transition completed');
    }, transitionDuration);
  }, [transitionDuration]);

  // Check if we can start transition (both timer and video ready)
  useEffect(() => {
    console.log('BackgroundTransition - State check:', { 
      isTimerReady: state.isTimerReady, 
      isVideoReady: state.isVideoReady 
    });
    
    if (state.isTimerReady && state.isVideoReady) {
      console.log('BackgroundTransition - Both conditions met, starting transition');
      startTransition();
    }
  }, [state.isTimerReady, state.isVideoReady, startTransition]);

  // Handle video ready state
  const handleVideoReady = useCallback(() => {
    console.log('BackgroundTransition - Video is ready');
    setState(prev => ({ ...prev, isVideoReady: true }));
  }, []);

  // Reset transition state when video changes
  const resetTransition = useCallback(() => {
    const randomImage = selectRandomBackgroundImage();
    setState({
      currentImage: randomImage,
      isVideoReady: false,
      isTimerReady: false,
      showImage: true,
      showVideo: false,
      imageOpacity: BACKGROUND_TRANSITIONS.OPACITY_FULL,
      videoOpacity: BACKGROUND_TRANSITIONS.OPACITY_HIDDEN
    });
  }, []);

  // Video event handlers
  const handleVideoLoadedData = useCallback(() => {
    handleVideoReady();
  }, [handleVideoReady]);

  const handleVideoCanPlay = useCallback(() => {
    if (videoRef.current && state.isVideoReady) {
      videoRef.current.play().catch(error => {
        console.log('Video autoplay prevented:', error);
      });
    }
  }, [videoRef, state.isVideoReady]);

  return {
    ...state,
    handleVideoLoadedData,
    handleVideoCanPlay,
    resetTransition,
    transitionStyles: {
      image: {
        opacity: state.imageOpacity,
        transition: `opacity ${transitionDuration}ms ${BACKGROUND_TRANSITIONS.EASING_CURVES[transitionCurve]}`,
        willChange: 'opacity'
      },
      video: {
        opacity: state.videoOpacity,
        transition: `opacity ${transitionDuration}ms ${BACKGROUND_TRANSITIONS.EASING_CURVES[transitionCurve]}`,
        willChange: 'opacity'
      }
    }
  };
};
