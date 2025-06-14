
import React from 'react';
import { useAudio } from '../contexts/AudioContext';

const MiniPlayer = () => {
  const { isPlaying, isLoading, currentTrack, togglePlay } = useAudio();

  return (
    <div className="flex items-center space-x-3 glass-card px-4 py-2 max-w-xs">
      <button
        onClick={togglePlay}
        disabled={isLoading}
        className="flex items-center justify-center w-6 h-6 hover:opacity-70 transition-opacity"
      >
        {isLoading ? (
          <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
        ) : isPlaying ? (
          <div className="flex space-x-1">
            <div className="w-0.5 h-4 bg-white"></div>
            <div className="w-0.5 h-4 bg-white"></div>
          </div>
        ) : (
          <div className="w-0 h-0 border-l-[12px] border-l-white border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent ml-1"></div>
        )}
      </button>
      
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium truncate">{currentTrack}</p>
      </div>
    </div>
  );
};

export default MiniPlayer;
