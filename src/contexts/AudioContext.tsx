import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { MEDIA_CONSTANTS } from '../constants/mediaConstants';
import { STREAM_CONFIG } from '../constants/streamConstants';
import { RadioStreamService } from '../services/streamService';
import { AudioService, AudioValidationResult } from '../services/audioService';
import { toast } from '../hooks/use-toast';
import {
  bindMediaSessionActionHandlers,
  clearMediaSession,
  parseNowPlayingTrack,
  setMediaSessionPlaybackState,
  updateMediaSessionMetadata,
} from '../utils/mediaSession';

interface AudioContextType {
  isPlaying: boolean;
  isLoading: boolean;
  currentTrack: string;
  coverImageUrl: string | null;
  volume: number;
  isMuted: boolean;
  currentSource: 'radio' | 'program';
  currentProgramId: string | null;
  currentProgramTitle: string | null;
  error: string | null;
  togglePlayWithPause: () => void;
  togglePlay: () => void;
  playProgram: (programId: string, audioUrl: string, title: string) => void;
  stopProgram: () => void;
  returnToRadio: () => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  clearError: () => void;
}

const EXTERNAL_AUDIO_HOSTS = [
  'archive.org',
  'supabase.co',
  'soundcloud.com',
  'sndcdn.com',
  'dropbox.com',
  'dropboxusercontent.com',
  'drive.google.com',
  'googleusercontent.com',
];

const isExternalUrl = (url: string): boolean => /^https?:\/\//i.test(url);

const isAllowedExternalAudioUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    const hostname = parsed.hostname.toLowerCase();
    return EXTERNAL_AUDIO_HOSTS.some(
      (allowedHost) => hostname === allowedHost || hostname.endsWith(`.${allowedHost}`)
    );
  } catch {
    return false;
  }
};

const AudioContext = createContext<AudioContextType | undefined>(undefined);

/**
 * Audio Provider - Simplified and follows SOLID principles
 * Single Responsibility: Manages audio state and playback
 * Open/Closed: Extensible through services
 * Dependency Inversion: Depends on abstractions (services)
 */
export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Audio State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<string>(MEDIA_CONSTANTS.STREAM.DEFAULT_TRACK);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);

  // Multi-source State
  const [currentSource, setCurrentSource] = useState<'radio' | 'program'>('radio');
  const [currentProgramId, setCurrentProgramId] = useState<string | null>(null);
  const [currentProgramTitle, setCurrentProgramTitle] = useState<string | null>(null);

  // Error State
  const [error, setError] = useState<string | null>(null);

  // Volume State with persistence
  const [volume, setVolumeState] = useState(() => {
    try {
      const savedVolume = localStorage.getItem('audioVolume');
      return savedVolume ? parseInt(savedVolume, 10) : 80;
    } catch {
      return 80;
    }
  });
  const [isMuted, setIsMuted] = useState(() => {
    try {
      const savedMuted = localStorage.getItem('audioMuted');
      return savedMuted === 'true';
    } catch {
      return false;
    }
  });
  const [previousVolume, setPreviousVolume] = useState(() => {
    try {
      const savedPrevVolume = localStorage.getItem('audioPreviousVolume');
      return savedPrevVolume ? parseInt(savedPrevVolume, 10) : 80;
    } catch {
      return 80;
    }
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const programAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioInstancesRef = useRef<Set<HTMLAudioElement>>(new Set());
  const currentTrackRef = useRef(currentTrack);
  currentTrackRef.current = currentTrack;
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const currentSourceRef = useRef(currentSource);
  currentSourceRef.current = currentSource;
  const mediaSessionHandlersRef = useRef<{ play: () => void; pause: () => void }>({
    play: () => undefined,
    pause: () => undefined,
  });
  const streamService = useRef(
    new RadioStreamService(
      STREAM_CONFIG.statusUrl,
      STREAM_CONFIG.streamUrl,
      MEDIA_CONSTANTS.STREAM.DEFAULT_TRACK
    )
  );

  /**
   * Enhanced audio instance management with memory leak prevention
   */
  const registerAudioInstance = useCallback((audio: HTMLAudioElement) => {
    audioInstancesRef.current.add(audio);
  }, []);

  const unregisterAudioInstance = useCallback((audio: HTMLAudioElement) => {
    audioInstancesRef.current.delete(audio);
  }, []);

  const cleanupAllAudioInstances = useCallback(() => {
    // Clean up all tracked audio instances
    audioInstancesRef.current.forEach(audio => {
      AudioService.cleanupAudio(audio);
    });
    audioInstancesRef.current.clear();

    // Clean up main refs
    if (audioRef.current) {
      AudioService.cleanupAudio(audioRef.current);
      audioRef.current = null;
    }
    if (programAudioRef.current) {
      AudioService.cleanupAudio(programAudioRef.current);
      programAudioRef.current = null;
    }
  }, []);

  const safeCleanupAudio = useCallback((audio: HTMLAudioElement | null) => {
    if (audio) {
      unregisterAudioInstance(audio);
      AudioService.cleanupAudio(audio);
    }
  }, [unregisterAudioInstance]);

  /**
   * Audio Event Handlers - DRY principle
   */
  const handleAudioLoadStart = useCallback(() => setIsLoading(true), []);
  const handleAudioCanPlay = useCallback(() => setIsLoading(false), []);
  const handleAudioWaiting = useCallback(() => setIsLoading(true), []);
  
  const handleAudioError = useCallback((event: Event) => {
    setIsLoading(false);
    setIsPlaying(false);
    const audioElement = event.target as HTMLAudioElement;
    const mediaError = audioElement.error;
    const isProgramAudio = audioElement === programAudioRef.current;

    if (mediaError) {
      // Only log detailed errors in development mode
      if (import.meta.env.DEV) {
        console.error('Audio playback error details:', {
          code: mediaError.code,
          message: mediaError.message,
          networkState: audioElement.networkState,
          readyState: audioElement.readyState,
          src: audioElement.src,
          sourceType: isProgramAudio ? 'program' : 'radio'
        });
      }

      // Get user-friendly error message
      const errorMessage = AudioService.getErrorMessage(mediaError);
      setError(errorMessage);

      // Only show toast notifications in development mode
      if (import.meta.env.DEV) {
        toast({
          variant: "destructive",
          title: isProgramAudio ? "Program Audio Error" : "Radio Stream Error",
          description: errorMessage,
        });
      }

      // If program audio fails, reset to radio state
      if (isProgramAudio) {
        if (import.meta.env.DEV) {
          console.error(`Program audio error: ${errorMessage}`);
        }
        
        // Clean up failed program audio
        if (programAudioRef.current) {
          safeCleanupAudio(programAudioRef.current);
          programAudioRef.current = null;
        }
        
        // Reset to radio state
        setCurrentSource('radio');
        setCurrentProgramId(null);
        setCurrentProgramTitle(null);
        
        if (import.meta.env.DEV) {
          console.error('Program audio failed, returned to radio state');
        }
      } else {
        // For radio errors, try to recover after a delay
        setTimeout(() => {
          if (audioRef.current && !audioRef.current.src) {
            if (import.meta.env.DEV) {
              console.log('Attempting to recover radio stream...');
            }
            audioRef.current.src = STREAM_CONFIG.streamUrl;
            audioRef.current.load();
          }
        }, 3000);
      }
    } else {
      const fallbackMessage = 'Audio playback error: No error details available';
      setError(fallbackMessage);
      
      if (import.meta.env.DEV) {
        console.error(fallbackMessage);
        toast({
          variant: "destructive",
          title: "Audio Error",
          description: fallbackMessage,
        });
      }
    }
  }, [safeCleanupAudio]);

  /**
   * Create audio instance with proper configuration and registration
   */
  const createConfiguredAudio = useCallback(() => {
    const effectiveVolume = isMuted ? 0 : volume / 100;
    const audio = AudioService.createAudioInstance(STREAM_CONFIG.streamUrl, effectiveVolume);

    // Register the instance for cleanup tracking
    registerAudioInstance(audio);

    // Apply event listeners
    audio.addEventListener('loadstart', handleAudioLoadStart);
    audio.addEventListener('canplay', handleAudioCanPlay);
    audio.addEventListener('waiting', handleAudioWaiting);
    audio.addEventListener('error', handleAudioError);

    return audio;
  }, [volume, isMuted, handleAudioLoadStart, handleAudioCanPlay, handleAudioWaiting, handleAudioError, registerAudioInstance]);

  /**
   * Volume Control - Following SRP
   */
  const setVolume = useCallback((newVolume: number) => {
    setVolumeState(newVolume);
    if (newVolume > 0 && isMuted) {
      setIsMuted(false);
    }
    // Apply volume to currently active audio source
    if (currentSource === 'radio' && audioRef.current) {
      AudioService.setAudioVolume(audioRef.current, newVolume / 100);
    } else if (currentSource === 'program' && programAudioRef.current) {
      AudioService.setAudioVolume(programAudioRef.current, newVolume / 100);
    }
    
    // Persist volume setting
    try {
      localStorage.setItem('audioVolume', newVolume.toString());
    } catch (error) {
      console.warn('Failed to persist volume setting:', error);
    }
  }, [isMuted, currentSource]);

  const toggleMute = useCallback(() => {
    if (isMuted) {
      setVolumeState(previousVolume);
      setIsMuted(false);
      // Apply volume to currently active audio source
      if (currentSource === 'radio' && audioRef.current) {
        AudioService.setAudioVolume(audioRef.current, previousVolume / 100);
      } else if (currentSource === 'program' && programAudioRef.current) {
        AudioService.setAudioVolume(programAudioRef.current, previousVolume / 100);
      }
    } else {
      setPreviousVolume(volume);
      setVolumeState(0);
      setIsMuted(true);
      // Mute currently active audio source
      if (currentSource === 'radio' && audioRef.current) {
        AudioService.setAudioVolume(audioRef.current, 0);
      } else if (currentSource === 'program' && programAudioRef.current) {
        AudioService.setAudioVolume(programAudioRef.current, 0);
      }
    }
    
    // Persist mute settings
    try {
      localStorage.setItem('audioMuted', (!isMuted).toString());
      localStorage.setItem('audioPreviousVolume', (isMuted ? volume : previousVolume).toString());
    } catch (error) {
      console.warn('Failed to persist mute settings:', error);
    }
  }, [isMuted, volume, previousVolume, currentSource]);

  /**
   * Playback Control - Following SRP
   */
  const togglePlayWithPause = useCallback(() => {
    // If program is playing, stop it and switch to radio
    if (currentSource === 'program') {
      if (programAudioRef.current) {
        safeCleanupAudio(programAudioRef.current);
        programAudioRef.current = null;
      }
      setCurrentSource('radio');
      setCurrentProgramId(null);
      setCurrentProgramTitle(null);
    }

    if (!audioRef.current) {
      audioRef.current = createConfiguredAudio();
    }

    if (isPlaying && currentSource === 'radio') {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      setIsLoading(true);
      // Use safe play method with autoplay handling
      AudioService.safePlay(audioRef.current).then(result => {
        if (result.success) {
          setIsPlaying(true);
          setCurrentSource('radio');
          setError(null); // Clear any previous errors on successful play
        } else {
          setIsLoading(false);
          if (import.meta.env.DEV) {
            console.error('Radio playback failed:', result.error);
          }
          if (result.requiresUserInteraction) {
            setError('Click play to start audio - autoplay is blocked');
          } else {
            setError(result.error || 'Failed to start radio playback');
          }
        }
      });
    }
  }, [isPlaying, currentSource, createConfiguredAudio, safeCleanupAudio]);

  const togglePlay = useCallback(() => {
    // If program is playing, stop it first
    if (currentSource === 'program') {
      if (programAudioRef.current) {
        safeCleanupAudio(programAudioRef.current);
        programAudioRef.current = null;
      }
      setCurrentProgramId(null);
      setCurrentProgramTitle(null);
    }

    if (isPlaying && audioRef.current && currentSource === 'radio') {
      safeCleanupAudio(audioRef.current);
      audioRef.current = null;
      setIsPlaying(false);
      setIsLoading(false);
    } else {
      const shouldRestoreAudibleVolume = isMuted || volume === 0;
      const restoredVolume = previousVolume > 0 ? previousVolume : 80;

      // Ensure playback is audible when user explicitly presses play.
      // This prevents a "playing but silent" state when volume was persisted as muted/0.
      if (shouldRestoreAudibleVolume) {
        setIsMuted(false);
        setVolumeState(restoredVolume);
      }

      // Clean up any existing radio audio
      if (audioRef.current) {
        safeCleanupAudio(audioRef.current);
      }
      audioRef.current = createConfiguredAudio();
      setIsLoading(true);
      if (shouldRestoreAudibleVolume) {
        AudioService.setAudioVolume(audioRef.current, restoredVolume / 100);
      }
      // Use safe play method with autoplay handling
      AudioService.safePlay(audioRef.current).then(result => {
        if (result.success) {
          setIsPlaying(true);
          setError(null); // Clear any previous errors on successful play
        } else {
          setIsLoading(false);
          if (import.meta.env.DEV) {
            console.error('Radio playback failed:', result.error);
          }
          if (result.requiresUserInteraction) {
            setError('Click play to start audio - autoplay is blocked');
          } else {
            setError(result.error || 'Failed to start radio playback');
          }
        }
      });
    }

    setCurrentSource('radio');
  }, [isPlaying, currentSource, createConfiguredAudio, safeCleanupAudio, isMuted, volume, previousVolume]);

  /**
   * Program Audio Control - Following SRP
   */
  const playProgram = useCallback(async (programId: string, audioUrl: string, title: string) => {
    if (import.meta.env.DEV) {
      console.log(`Starting program playback: ${title} (${programId})`);
    }
    
    // Clear any previous errors
    setError(null);
    
    // Set loading state immediately when switching sources
    setIsLoading(true);
    setIsPlaying(false);
    
    // Stop any currently playing audio
    if (audioRef.current) {
      safeCleanupAudio(audioRef.current);
      audioRef.current = null;
    }
    if (programAudioRef.current) {
      safeCleanupAudio(programAudioRef.current);
      programAudioRef.current = null;
    }

    // Update state to program source immediately
    setCurrentSource('program');
    setCurrentProgramId(programId);
    setCurrentProgramTitle(title);

    try {
      // External providers (Archive, SoundCloud, etc.) can fail preflight validation
      // even when direct playback is valid. Only hard-validate local/same-origin assets.
      if (!isExternalUrl(audioUrl)) {
        if (import.meta.env.DEV) {
          console.log('Validating local audio URL with retry logic...');
        }
        const validationResult: AudioValidationResult = await AudioService.validateAudioUrlWithRetry(audioUrl, 2, 1500);

        if (!validationResult.isValid) {
          const errorMessage = validationResult.error || 'Audio file is not accessible or supported';
          if (import.meta.env.DEV) {
            console.error(`Audio validation failed: ${errorMessage} (Code: ${validationResult.errorCode})`);
          }
          throw new Error(errorMessage);
        }

        if (import.meta.env.DEV) {
          console.log(`Audio validation successful. Duration: ${validationResult.duration || 'unknown'}s`);
        }
      } else {
        if (!isAllowedExternalAudioUrl(audioUrl)) {
          throw new Error('External audio host is not allowed.');
        }
        if (import.meta.env.DEV) {
          console.log('Skipping strict pre-validation for allowed external audio URL:', audioUrl);
        }
      }

      // Create new program audio instance with persisted volume settings
      const effectiveVolume = isMuted ? 0 : volume / 100;
      
      // Ensure we have a valid audio URL
      if (!audioUrl || audioUrl.trim() === '') {
        throw new Error('Invalid audio URL provided');
      }
      
      if (import.meta.env.DEV) {
        console.log('Creating program audio with URL:', audioUrl);
      }
      
      programAudioRef.current = AudioService.createAudioInstance(audioUrl, effectiveVolume);
      registerAudioInstance(programAudioRef.current);

      // Enhanced event listeners for better loading and error handling
      programAudioRef.current.addEventListener('loadstart', () => {
        if (import.meta.env.DEV) {
          console.log('Program audio loading started');
        }
        setIsLoading(true);
        setError(null);
      });
      
      programAudioRef.current.addEventListener('canplay', () => {
        if (import.meta.env.DEV) {
          console.log('Program audio ready to play');
        }
        setIsLoading(false);
        setError(null);
      });
      
      programAudioRef.current.addEventListener('waiting', () => {
        if (import.meta.env.DEV) {
          console.log('Program audio buffering');
        }
        setIsLoading(true);
      });
      
      programAudioRef.current.addEventListener('playing', () => {
        if (import.meta.env.DEV) {
          console.log('Program audio started playing');
        }
        setIsLoading(false);
        setIsPlaying(true);
        setError(null); // Clear any previous errors when playback starts
      });
      
      programAudioRef.current.addEventListener('pause', () => {
        if (import.meta.env.DEV) {
          console.log('Program audio paused');
        }
        setIsPlaying(false);
      });
      
      programAudioRef.current.addEventListener('stalled', () => {
        if (import.meta.env.DEV) {
          console.log('Program audio stalled - network issues');
          toast({
            title: "Buffering",
            description: "Audio is buffering due to network conditions...",
          });
        }
        setIsLoading(true);
      });
      
      programAudioRef.current.addEventListener('suspend', () => {
        if (import.meta.env.DEV) {
          console.log('Program audio suspended - loading paused');
        }
        setIsLoading(false);
      });
      
      programAudioRef.current.addEventListener('error', handleAudioError);

      // Add ended event listener to auto-return to radio stream
      programAudioRef.current.addEventListener('ended', () => {
        if (import.meta.env.DEV) {
          console.log('Program audio ended, returning to radio stream');
        }
        
        // Clean up program audio
        if (programAudioRef.current) {
          safeCleanupAudio(programAudioRef.current);
          programAudioRef.current = null;
        }
        
        // Reset all program-related state to initial state
        setCurrentSource('radio');
        setCurrentProgramId(null);
        setCurrentProgramTitle(null);
        setIsPlaying(false);
        setIsLoading(false);
        setError(null);
        
        if (import.meta.env.DEV) {
          console.log('Program player states reset to initial state');
        }
      });

      // Start playback with enhanced error handling and autoplay support
      const playResult = await AudioService.safePlay(programAudioRef.current);
      if (playResult.success) {
        if (import.meta.env.DEV) {
          console.log('Program audio playback started successfully');
        }
        setIsPlaying(true);
        setError(null); // Clear any previous errors on successful play
      } else {
        throw new Error(playResult.error || 'Failed to start program playback');
      }
      
    } catch (error: unknown) {
      if (import.meta.env.DEV) {
        console.error('Failed to start program audio playback:', error);
      }
      setIsLoading(false);
      setIsPlaying(false);
      
      let errorMessage = 'Failed to play program audio';
      
      // Handle specific error types
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          errorMessage = 'Autoplay blocked - please click play to start audio';
          if (import.meta.env.DEV) {
            console.error('Autoplay blocked - user interaction required');
          }
        } else if (error.name === 'NotSupportedError') {
          errorMessage = 'Audio format not supported by your browser';
          if (import.meta.env.DEV) {
            console.error('Audio format not supported');
          }
        } else if (error.name === 'AbortError') {
          errorMessage = 'Audio loading was interrupted';
          if (import.meta.env.DEV) {
            console.error('Audio loading aborted');
          }
        } else if (error.message) {
          errorMessage = error.message;
        }
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      setError(errorMessage);
      
      // Only show user feedback in development mode
      if (import.meta.env.DEV) {
        toast({
          variant: "destructive",
          title: "Program Audio Error",
          description: errorMessage,
        });
      }
      
      // Reset to radio state on error
      setCurrentSource('radio');
      setCurrentProgramId(null);
      setCurrentProgramTitle(null);
    }
  }, [volume, isMuted, handleAudioError, registerAudioInstance, safeCleanupAudio]);

  const stopProgram = useCallback(() => {
    if (programAudioRef.current) {
      safeCleanupAudio(programAudioRef.current);
      programAudioRef.current = null;
    }

    // Reset program state
    setCurrentSource('radio');
    setCurrentProgramId(null);
    setCurrentProgramTitle(null);
    setIsPlaying(false);
    setIsLoading(false);
    setError(null);
  }, [safeCleanupAudio]);

  const returnToRadio = useCallback(() => {
    if (import.meta.env.DEV) {
      console.log('Returning to radio stream');
    }
    
    // Stop program audio if playing
    if (programAudioRef.current) {
      safeCleanupAudio(programAudioRef.current);
      programAudioRef.current = null;
    }

    // Reset all program-related state to initial state
    setCurrentSource('radio');
    setCurrentProgramId(null);
    setCurrentProgramTitle(null);
    setIsPlaying(false);
    setIsLoading(false);
    setError(null);
    
    if (import.meta.env.DEV) {
      console.log('All program player states reset to initial state');
    }
  }, [safeCleanupAudio]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * State persistence utilities for maintaining playback across navigation
   */
  const persistAudioState = useCallback(() => {
    try {
      const state = {
        volume,
        isMuted,
        previousVolume,
        currentSource,
        currentProgramId,
        currentProgramTitle,
        isPlaying,
        timestamp: Date.now()
      };
      localStorage.setItem('audioState', JSON.stringify(state));
      localStorage.setItem('audioVolume', volume.toString());
      localStorage.setItem('audioMuted', isMuted.toString());
      localStorage.setItem('audioPreviousVolume', previousVolume.toString());
    } catch (error) {
      console.warn('Failed to persist audio state:', error);
    }
  }, [volume, isMuted, previousVolume, currentSource, currentProgramId, currentProgramTitle, isPlaying]);

  const restoreAudioState = useCallback(() => {
    try {
      const savedState = localStorage.getItem('audioState');
      if (savedState) {
        const state = JSON.parse(savedState);
        const age = Date.now() - (state.timestamp || 0);
        
        // Only restore state if it's less than 1 hour old
        if (age < 3600000) {
          // Restore volume settings (already handled in useState initializers)
          // Only restore program state if it was recently active
          if (state.currentSource === 'program' && state.currentProgramId && age < 300000) { // 5 minutes
            setCurrentSource(state.currentSource);
            setCurrentProgramId(state.currentProgramId);
            setCurrentProgramTitle(state.currentProgramTitle);
            // Note: We don't restore isPlaying state to avoid auto-resuming
            // User will need to click play again due to browser autoplay restrictions
          }
        }
      }
    } catch (error) {
      console.warn('Failed to restore audio state:', error);
    }
  }, []);

  const clearPersistedState = useCallback(() => {
    try {
      localStorage.removeItem('audioState');
    } catch (error) {
      console.warn('Failed to clear persisted audio state:', error);
    }
  }, []);

  /**
   * Track Information - Following SRP
   * Keep polling while audio is playing even if the tab is backgrounded,
   * so iOS lock-screen metadata can update.
   */
  const fetchCurrentTrack = useCallback(async () => {
    if (document.hidden && !isPlayingRef.current) return;
    try {
      const trackName = await streamService.current.fetchCurrentTrack();
      if (trackName !== currentTrackRef.current) {
        setCurrentTrack(trackName);
        const coverUrl = await streamService.current.fetchSongCover(trackName);
        setCoverImageUrl(coverUrl);
      }
    } catch {
      // Errores ya manejados en streamService (sin ruido en consola)
    }
  }, []);

  // Polling del now-playing: visible siempre; en background solo si está reproduciendo
  useEffect(() => {
    void fetchCurrentTrack();

    const interval = setInterval(() => {
      void fetchCurrentTrack();
    }, MEDIA_CONSTANTS.STREAM.UPDATE_INTERVAL);

    const onVisibilityChange = () => {
      if (!document.hidden || isPlayingRef.current) void fetchCurrentTrack();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [fetchCurrentTrack]);

  // Keep Media Session handlers pointing at the latest play/pause logic
  mediaSessionHandlersRef.current = {
    play: () => {
      if (currentSourceRef.current === 'program' && programAudioRef.current) {
        void AudioService.safePlay(programAudioRef.current).then((result) => {
          if (result.success) {
            setIsPlaying(true);
            setError(null);
          }
        });
        return;
      }
      if (!isPlayingRef.current) {
        togglePlayWithPause();
      }
    },
    pause: () => {
      if (currentSourceRef.current === 'program' && programAudioRef.current) {
        programAudioRef.current.pause();
        setIsPlaying(false);
        return;
      }
      if (isPlayingRef.current && currentSourceRef.current === 'radio' && audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    },
  };

  useEffect(() => {
    return bindMediaSessionActionHandlers({
      play: () => mediaSessionHandlersRef.current.play(),
      pause: () => mediaSessionHandlersRef.current.pause(),
    });
  }, []);

  // Push now-playing metadata to iOS Control Center / lock screen
  useEffect(() => {
    const hasActiveAudio =
      (currentSource === 'radio' && Boolean(audioRef.current)) ||
      (currentSource === 'program' && Boolean(programAudioRef.current));

    if (!isPlaying && !hasActiveAudio) {
      clearMediaSession();
      return;
    }

    if (currentSource === 'program') {
      updateMediaSessionMetadata({
        title: currentProgramTitle || 'Programa',
        artist: 'Radionudista',
        album: 'Radionudista',
        artworkUrl: coverImageUrl,
      });
    } else {
      const { title, artist } = parseNowPlayingTrack(currentTrack);
      updateMediaSessionMetadata({
        title,
        artist,
        album: 'Radionudista',
        artworkUrl: coverImageUrl,
      });
    }

    setMediaSessionPlaybackState(isPlaying ? 'playing' : 'paused');
  }, [
    isPlaying,
    currentSource,
    currentTrack,
    coverImageUrl,
    currentProgramTitle,
  ]);

  // Cleanup effect - ensures all audio instances are properly disposed on unmount
  useEffect(() => {
    return () => {
      if (import.meta.env.DEV) {
        console.log('AudioProvider unmounting - cleaning up all audio instances');
      }
      clearMediaSession();
      cleanupAllAudioInstances();
    };
  }, [cleanupAllAudioInstances]);

  // State restoration effect - restore audio state on mount
  useEffect(() => {
    restoreAudioState();
  }, [restoreAudioState]);

  // State persistence effect - persist state changes
  useEffect(() => {
    persistAudioState();
  }, [persistAudioState]);

  // Page visibility effect - handle tab switching and maintain audio continuity
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page is hidden - persist current state
        persistAudioState();
      } else {
        // Page is visible again - audio should continue playing if it was before
        // No need to restore state as audio elements persist across visibility changes
      }
    };

    const handleBeforeUnload = () => {
      // Persist state before page unload
      persistAudioState();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [persistAudioState]);

  const contextValue: AudioContextType = {
    isPlaying,
    isLoading,
    currentTrack,
    coverImageUrl,
    volume,
    isMuted,
    currentSource,
    currentProgramId,
    currentProgramTitle,
    error,
    togglePlayWithPause,
    togglePlay,
    playProgram,
    stopProgram,
    returnToRadio,
    setVolume,
    toggleMute,
    clearError,
  };

  return (
    <AudioContext.Provider value={contextValue}>
      {children}
    </AudioContext.Provider>
  );
};

export const useAudio = (): AudioContextType => {
  const context = useContext(AudioContext);
  if (context === undefined) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
};
