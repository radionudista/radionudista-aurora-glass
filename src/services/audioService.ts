/**
 * Enhanced audio validation result interface
 */
export interface AudioValidationResult {
  isValid: boolean;
  error?: string;
  errorCode?: 'NETWORK_ERROR' | 'FORMAT_UNSUPPORTED' | 'ACCESS_DENIED' | 'TIMEOUT' | 'UNKNOWN_ERROR';
  canPlay?: boolean;
  duration?: number;
}

/**
 * Audio Service - Manages audio instance creation and configuration
 * Follows Single Responsibility Principle - only handles audio management
 * Follows Open/Closed Principle - extensible for different audio types
 */
export class AudioService {
  private static shouldUseAnonymousCors(url: string): boolean {
    // Use anonymous CORS only for same-origin assets.
    // External hosts (e.g., Archive.org) can fail validation/playback if forced.
    if (!url) return false;
    if (url.startsWith('/')) return true;
    if (typeof window === 'undefined') return false;

    try {
      const parsed = new URL(url, window.location.origin);
      return parsed.origin === window.location.origin;
    } catch {
      return false;
    }
  }

  /**
   * Create configured HTML5 Audio instance
   */
  static createAudioInstance(url: string, volume: number = 0.8): HTMLAudioElement {
    const audio = new Audio(url);
    audio.preload = 'none';
    if (AudioService.shouldUseAnonymousCors(url)) {
      audio.crossOrigin = 'anonymous';
    }
    audio.volume = volume;
    return audio;
  }

  /**
   * Apply volume to existing audio instance
   */
  static setAudioVolume(audio: HTMLAudioElement | null, volume: number): void {
    if (audio) {
      audio.volume = Math.max(0, Math.min(1, volume));
    }
  }

  /**
   * Enhanced cleanup audio instance with proper memory management
   * Prevents memory leaks and ensures proper disposal of audio resources
   */
  static cleanupAudio(audio: HTMLAudioElement | null): void {
    if (audio) {
      try {
        // Pause playback first
        audio.pause();
        
        // Remove all event listeners to prevent memory leaks
        const eventTypes = [
          'loadstart', 'canplay', 'canplaythrough', 'loadedmetadata', 
          'playing', 'pause', 'ended', 'error', 'abort', 'stalled', 
          'suspend', 'waiting', 'timeupdate', 'volumechange'
        ];
        
        eventTypes.forEach(eventType => {
          audio.removeEventListener(eventType, () => {});
        });
        
        // Clear the source to stop any ongoing network requests
        audio.src = '';
        audio.srcObject = null;
        
        // Force garbage collection hint by removing from DOM if present
        if (audio.parentNode) {
          audio.parentNode.removeChild(audio);
        }
        
        // Set currentTime to 0 to reset playback position
        audio.currentTime = 0;
        
        // Call load() to reset the media element state
        audio.load();
        
      } catch (error) {
        // Silently handle cleanup errors to prevent breaking the application
        console.warn('Audio cleanup encountered an error:', error);
      }
    }
  }

  /**
   * Get user-friendly error message for MediaError codes
   */
  static getErrorMessage(error: MediaError | null): string {
    if (!error) return 'Unknown audio error occurred';

    switch (error.code) {
      case MediaError.MEDIA_ERR_ABORTED:
        return 'Audio playback was interrupted';
      case MediaError.MEDIA_ERR_NETWORK:
        return 'Network error - please check your connection and try again';
      case MediaError.MEDIA_ERR_DECODE:
        return 'Audio file format is corrupted or unsupported';
      case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
        return 'Audio format not supported by your browser';
      default:
        return 'Unknown audio error occurred';
    }
  }

  /**
   * Validate if an audio URL is accessible with detailed error reporting
   * Returns a promise with detailed validation results
   */
  static async validateAudioUrlDetailed(url: string): Promise<AudioValidationResult> {
    return new Promise((resolve) => {
      const testAudio = new Audio();
      let hasResolved = false;
      
      const cleanup = () => {
        if (hasResolved) return;
        testAudio.removeEventListener('canplay', onCanPlay);
        testAudio.removeEventListener('canplaythrough', onCanPlayThrough);
        testAudio.removeEventListener('loadedmetadata', onLoadedMetadata);
        testAudio.removeEventListener('error', onError);
        testAudio.removeEventListener('abort', onAbort);
        testAudio.removeEventListener('stalled', onStalled);
        testAudio.removeEventListener('suspend', onSuspend);
        testAudio.src = '';
      };

      const resolveOnce = (result: AudioValidationResult) => {
        if (hasResolved) return;
        hasResolved = true;
        cleanup();
        resolve(result);
      };

      const onCanPlay = () => {
        resolveOnce({
          isValid: true,
          canPlay: true,
          duration: testAudio.duration || undefined
        });
      };

      const onCanPlayThrough = () => {
        resolveOnce({
          isValid: true,
          canPlay: true,
          duration: testAudio.duration || undefined
        });
      };

      const onLoadedMetadata = () => {
        // If we have metadata, the file is likely valid
        if (testAudio.duration && testAudio.duration > 0) {
          resolveOnce({
            isValid: true,
            canPlay: true,
            duration: testAudio.duration
          });
        }
      };

      const onError = (event: Event) => {
        const target = event.target as HTMLAudioElement;
        const mediaError = target.error;
        
        let errorCode: AudioValidationResult['errorCode'] = 'UNKNOWN_ERROR';
        let errorMessage = 'Unknown audio error occurred';

        if (mediaError) {
          switch (mediaError.code) {
            case MediaError.MEDIA_ERR_NETWORK:
              errorCode = 'NETWORK_ERROR';
              errorMessage = 'Network error - unable to access audio file';
              break;
            case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
              errorCode = 'FORMAT_UNSUPPORTED';
              errorMessage = 'Audio format not supported';
              break;
            case MediaError.MEDIA_ERR_DECODE:
              errorCode = 'FORMAT_UNSUPPORTED';
              errorMessage = 'Audio file is corrupted or in unsupported format';
              break;
            case MediaError.MEDIA_ERR_ABORTED:
              errorCode = 'ACCESS_DENIED';
              errorMessage = 'Audio loading was aborted - possibly access denied';
              break;
            default:
              errorMessage = AudioService.getErrorMessage(mediaError);
          }
        }

        resolveOnce({
          isValid: false,
          error: errorMessage,
          errorCode,
          canPlay: false
        });
      };

      const onAbort = () => {
        resolveOnce({
          isValid: false,
          error: 'Audio loading was aborted',
          errorCode: 'ACCESS_DENIED',
          canPlay: false
        });
      };

      const onStalled = () => {
        // Stalled doesn't necessarily mean invalid, but indicates network issues
        // We'll let the timeout handle this case
      };

      const onSuspend = () => {
        // Suspend means loading was paused, not necessarily an error
        // We'll let the timeout handle this case
      };

      // Set up event listeners
      testAudio.addEventListener('canplay', onCanPlay);
      testAudio.addEventListener('canplaythrough', onCanPlayThrough);
      testAudio.addEventListener('loadedmetadata', onLoadedMetadata);
      testAudio.addEventListener('error', onError);
      testAudio.addEventListener('abort', onAbort);
      testAudio.addEventListener('stalled', onStalled);
      testAudio.addEventListener('suspend', onSuspend);

      // Set timeout to avoid hanging
      setTimeout(() => {
        resolveOnce({
          isValid: false,
          error: 'Audio validation timed out - file may be too large or inaccessible',
          errorCode: 'TIMEOUT',
          canPlay: false
        });
      }, 15000); // 15 second timeout (increased from 10s for large files)

      // Start loading with minimal preload to test accessibility
      testAudio.preload = 'metadata';
      if (AudioService.shouldUseAnonymousCors(url)) {
        testAudio.crossOrigin = 'anonymous';
      }
      testAudio.src = url;
    });
  }

  /**
   * Legacy function for backward compatibility
   * Validate if an audio URL is accessible
   * Returns a promise that resolves to true if the audio can be loaded
   */
  static async validateAudioUrl(url: string): Promise<boolean> {
    const result = await AudioService.validateAudioUrlDetailed(url);
    return result.isValid;
  }

  /**
   * Retry audio validation with exponential backoff
   * @param url - The audio URL to validate
   * @param maxRetries - Maximum number of retry attempts (default: 3)
   * @param initialDelay - Initial delay in milliseconds (default: 1000)
   * @returns Promise with validation result after retries
   */
  static async validateAudioUrlWithRetry(
    url: string, 
    maxRetries: number = 3, 
    initialDelay: number = 1000
  ): Promise<AudioValidationResult> {
    let lastResult: AudioValidationResult;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      lastResult = await AudioService.validateAudioUrlDetailed(url);
      
      // If successful or it's a format/access error (not worth retrying), return immediately
      if (lastResult.isValid || 
          lastResult.errorCode === 'FORMAT_UNSUPPORTED' || 
          lastResult.errorCode === 'ACCESS_DENIED') {
        return lastResult;
      }
      
      // If this is not the last attempt and it's a network/timeout error, retry
      if (attempt < maxRetries && 
          (lastResult.errorCode === 'NETWORK_ERROR' || lastResult.errorCode === 'TIMEOUT')) {
        const delay = initialDelay * Math.pow(2, attempt); // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // Return the last result if we've exhausted retries
      return lastResult;
    }
    
    return lastResult!;
  }

  /**
   * Check if browser supports specific audio formats
   * @param formats - Array of MIME types to check (e.g., ['audio/mpeg', 'audio/mp4'])
   * @returns Object mapping MIME types to support level
   */
  static checkAudioFormatSupport(formats: string[] = ['audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav']): Record<string, string> {
    const audio = new Audio();
    const support: Record<string, string> = {};
    
    formats.forEach(format => {
      support[format] = audio.canPlayType(format);
    });
    
    return support;
  }

  /**
   * Get recommended audio formats based on browser support
   * @returns Array of MIME types in order of preference
   */
  static getRecommendedAudioFormats(): string[] {
    const support = AudioService.checkAudioFormatSupport();
    const formats: string[] = [];
    
    // Order by preference and support level
    if (support['audio/mpeg'] === 'probably' || support['audio/mpeg'] === 'maybe') {
      formats.push('audio/mpeg');
    }
    if (support['audio/mp4'] === 'probably' || support['audio/mp4'] === 'maybe') {
      formats.push('audio/mp4');
    }
    if (support['audio/ogg'] === 'probably' || support['audio/ogg'] === 'maybe') {
      formats.push('audio/ogg');
    }
    if (support['audio/wav'] === 'probably' || support['audio/wav'] === 'maybe') {
      formats.push('audio/wav');
    }
    
    return formats;
  }

  /**
   * Safely attempt audio playback with autoplay restriction handling
   * @param audio - The audio element to play
   * @returns Promise that resolves to success status and any error details
   */
  static async safePlay(audio: HTMLAudioElement): Promise<{
    success: boolean;
    error?: string;
    requiresUserInteraction?: boolean;
  }> {
    try {
      await audio.play();
      return { success: true };
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          return {
            success: false,
            error: 'Autoplay blocked - user interaction required',
            requiresUserInteraction: true
          };
        } else if (error.name === 'NotSupportedError') {
          return {
            success: false,
            error: 'Audio format not supported by browser'
          };
        } else if (error.name === 'AbortError') {
          return {
            success: false,
            error: 'Audio playback was interrupted'
          };
        }
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown playback error'
      };
    }
  }

  /**
   * Check if autoplay is likely to be allowed in the current context
   * @returns Promise that resolves to autoplay capability status
   */
  static async checkAutoplayCapability(): Promise<{
    canAutoplay: boolean;
    requiresUserInteraction: boolean;
  }> {
    try {
      // Create a silent test audio element
      const testAudio = new Audio();
      testAudio.volume = 0;
      testAudio.muted = true;
      
      // Try to play a data URL audio (very short silent audio)
      testAudio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT';
      
      const playResult = await AudioService.safePlay(testAudio);
      
      // Clean up test audio
      AudioService.cleanupAudio(testAudio);
      
      return {
        canAutoplay: playResult.success,
        requiresUserInteraction: playResult.requiresUserInteraction || false
      };
    } catch (error) {
      return {
        canAutoplay: false,
        requiresUserInteraction: true
      };
    }
  }
}