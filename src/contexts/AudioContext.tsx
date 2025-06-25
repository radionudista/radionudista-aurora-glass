
import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { MEDIA_CONSTANTS } from '../constants/mediaConstants';
import { STREAM_CONFIG } from '../constants/contactInfo';

interface StreamStatus {
  isMobile: boolean;
  streamingStatus: number;
  streamingType: string;
  currentTrack: string;
}

interface AudioContextType {
  isPlaying: boolean;
  isLoading: boolean;
  currentTrack: string;
  togglePlay: () => Promise<void>;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<string>(MEDIA_CONSTANTS.STREAM.DEFAULT_TRACK);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const streamUrl = STREAM_CONFIG.streamUrl;
  const statusUrl = STREAM_CONFIG.statusUrl;

  // Fetch current track info
  const fetchCurrentTrack = useCallback(async () => {
    try {
      const response = await fetch(statusUrl);
      const data: StreamStatus = await response.json();
      if (data.currentTrack) {
        setCurrentTrack(data.currentTrack);
      }
    } catch (error) {
      console.error('Error fetching track info:', error);
    }
  }, [statusUrl]);

  // Toggle play/pause
  const togglePlay = async () => {
    if (!audioRef.current) return;

    setIsLoading(true);
    
    try {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        await audioRef.current.play();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Error playing audio:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Update track info periodically
  useEffect(() => {
    fetchCurrentTrack();
    const interval = setInterval(fetchCurrentTrack, MEDIA_CONSTANTS.STREAM.UPDATE_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchCurrentTrack]);

  // Handle audio events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleCanPlay = () => setIsLoading(false);
    const handleWaiting = () => setIsLoading(true);
    const handleError = () => {
      setIsLoading(false);
      setIsPlaying(false);
      console.error('Audio playback error');
    };

    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('error', handleError);
    };
  }, []);

  return (
    <AudioContext.Provider value={{
      isPlaying,
      isLoading,
      currentTrack,
      togglePlay
    }}>
      {children}
      <audio
        ref={audioRef}
        src={streamUrl}
        preload={MEDIA_CONSTANTS.STREAM.PRELOAD}
      />
    </AudioContext.Provider>
  );
};

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (context === undefined) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
};
