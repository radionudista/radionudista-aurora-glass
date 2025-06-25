
import React from 'react';
import { useAudio } from '../contexts/AudioContext';
import MediaButton from './ui/MediaButton';

const MiniPlayer = () => {
  const { isPlaying, isLoading, currentTrack, togglePlay } = useAudio();

  return (
    <div 
      className={`flex items-center space-x-3 glass-card px-3 py-2 max-w-xs transition-colors ${!isLoading ? 'cursor-pointer hover:bg-white/10' : 'cursor-wait'}`}
      onClick={!isLoading ? togglePlay : undefined}
    >
      <MediaButton
        isPlaying={isPlaying}
        isLoading={isLoading}
        onClick={togglePlay}
        size="small"
      />
      
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium truncate">{currentTrack}</p>
      </div>
    </div>
  );
};

export default MiniPlayer;
