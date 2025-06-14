
import React from 'react';
import { useAudio } from '../contexts/AudioContext';

const HomePage = () => {
  const { isPlaying, isLoading, currentTrack, togglePlay } = useAudio();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className=" max-w-4xl mx-auto">
        <div className="text-center mb-12">
          
        </div>
        
        {/* Radio Player Section */}
        <div className="glass-card mb-8">
          <div className="text-center">
            <h3 className="text-2xl font-bold text-white mb-6">{currentTrack}</h3>
            
            {/* Play Button and Audio Visualization */}
            <div className="flex justify-center items-center mb-6 space-x-6">
              <button 
                className="w-20 h-20 flex items-center justify-center hover:opacity-70 transition-opacity"
                onClick={togglePlay}
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : isPlaying ? (
                  <div className="flex space-x-2">
                    <div className="w-2 h-12 bg-white"></div>
                    <div className="w-2 h-12 bg-white"></div>
                  </div>
                ) : (
                  <div className="w-0 h-0 border-l-[30px] border-l-white border-t-[20px] border-t-transparent border-b-[20px] border-b-transparent ml-2"></div>
                )}
              </button>
              
              {/* FFT Audio Visualization */}
              {isPlaying && !isLoading && (
                <div className="flex items-end space-x-1 h-12">
                  {[...Array(8)].map((_, i) => (
                    <div
                      key={i}
                      className="w-1 bg-white rounded-t-sm animate-pulse"
                      style={{
                        height: `${20 + Math.random() * 28}px`,
                        animationDelay: `${i * 0.1}s`,
                        animationDuration: `${0.6 + Math.random() * 0.4}s`
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
            
            {/* Station Info */}

          </div>
        </div>
        
        {/* Features */}

      </div>
    </div>
  );
};

export default HomePage;
