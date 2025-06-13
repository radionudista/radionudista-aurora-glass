
import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause } from 'lucide-react';

interface StreamStatus {
  isMobile: boolean;
  streamingStatus: number;
  streamingType: string;
  currentTrack: string;
}

const MiniPlayer = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState('RadioNudista - Live Stream');
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const streamUrl = 'https://servidor30.brlogic.com:7024/live';
  const statusUrl = 'https://d36nr0u3xmc4mm.cloudfront.net/index.php/api/streaming/status/7024/2348c62ead2082a25b4573ed601473a3/SV1BR';

  // Fetch current track info
  const fetchCurrentTrack = async () => {
    try {
      const response = await fetch(statusUrl);
      const data: StreamStatus = await response.json();
      if (data.currentTrack) {
        setCurrentTrack(data.currentTrack);
      }
    } catch (error) {
      console.error('Error fetching track info:', error);
    }
  };

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
    const interval = setInterval(fetchCurrentTrack, 10000);
    return () => clearInterval(interval);
  }, []);

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
    <div className="flex items-center space-x-3 glass-card px-4 py-2 max-w-xs">
      <button
        onClick={togglePlay}
        disabled={isLoading}
        className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500/20 hover:bg-blue-500/30 transition-all"
      >
        {isLoading ? (
          <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
        ) : isPlaying ? (
          <Pause className="w-4 h-4 text-white" />
        ) : (
          <Play className="w-4 h-4 text-white ml-0.5" />
        )}
      </button>
      
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium truncate">{currentTrack}</p>
        <p className="text-gray-300 text-xs">RadioNudista</p>
      </div>
      
      <audio
        ref={audioRef}
        src={streamUrl}
        preload="none"
      />
    </div>
  );
};

export default MiniPlayer;
