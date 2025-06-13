
import React from 'react';
import { Play, Pause } from 'lucide-react';
import { useAudio } from '../contexts/AudioContext';

const MiniPlayer = () => {
  const { isPlaying, isLoading, currentTrack, togglePlay } = useAudio();

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
      </div>
    </div>
  );
};

export default MiniPlayer;
