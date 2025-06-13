
import React from 'react';
import { useAudio } from '../contexts/AudioContext';

const HomePage = () => {
  const { isPlaying, isLoading, currentTrack, togglePlay } = useAudio();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="glass-container max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-6xl font-bold text-white mb-6">
            Welcome to <span className="text-blue-300">RadioNudista</span>
          </h2>
          <p className="text-xl md:text-2xl text-gray-200 mb-8">
            Your gateway to unlimited music and entertainment
          </p>
        </div>
        
        {/* Radio Player Section */}
        <div className="glass-card mb-8">
          <div className="text-center">
            <h3 className="text-2xl font-bold text-white mb-6">Now Playing</h3>
            
            {/* Play Button */}
            <div className="flex justify-center mb-6">
              <button 
                className="play-button"
                onClick={togglePlay}
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : isPlaying ? (
                  <div className="flex space-x-1">
                    <div className="w-1 h-6 bg-white"></div>
                    <div className="w-1 h-6 bg-white"></div>
                  </div>
                ) : (
                  <div className="w-0 h-0 border-l-[30px] border-l-white border-t-[20px] border-t-transparent border-b-[20px] border-b-transparent ml-2"></div>
                )}
              </button>
            </div>
            
            {/* Station Info */}
            <div className="space-y-2">
              <p className="text-lg text-gray-200">{currentTrack}</p>
              <p className="text-sm text-gray-300">RadioNudista - 24/7 Music & Entertainment</p>
            </div>
          </div>
        </div>
        
        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6">
          <div className="glass-card text-center">
            <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🎵</span>
            </div>
            <h4 className="text-lg font-semibold text-white mb-2">24/7 Music</h4>
            <p className="text-gray-300 text-sm">Non-stop music streaming</p>
          </div>
          
          <div className="glass-card text-center">
            <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🎧</span>
            </div>
            <h4 className="text-lg font-semibold text-white mb-2">High Quality</h4>
            <p className="text-gray-300 text-sm">Crystal clear audio</p>
          </div>
          
          <div className="glass-card text-center">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🌍</span>
            </div>
            <h4 className="text-lg font-semibold text-white mb-2">Global Reach</h4>
            <p className="text-gray-300 text-sm">Listen from anywhere</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
