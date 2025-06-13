
import React from 'react';
import { useAudio } from '../contexts/AudioContext';

const HomePage = () => {
  const { isPlaying, isLoading, currentTrack, togglePlay } = useAudio();

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md w-full">
        {/* Play Button */}
        <div className="flex justify-center mb-8">
          <button 
            className="play-button"
            onClick={togglePlay}
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : isPlaying ? (
              <div className="flex space-x-2">
                <div className="w-2 h-8 bg-white rounded"></div>
                <div className="w-2 h-8 bg-white rounded"></div>
              </div>
            ) : (
              <div className="w-0 h-0 border-l-[24px] border-l-white border-t-[16px] border-t-transparent border-b-[16px] border-b-transparent ml-1"></div>
            )}
          </button>
        </div>
        
        {/* Track Info */}
        <div className="space-y-2">
          <p className="text-white text-lg font-light">{currentTrack}</p>
          <p className="text-gray-400 text-sm font-light">RadioNudista</p>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
