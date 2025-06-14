
import React, { useState, useEffect } from 'react';
import { useAudio } from '../contexts/AudioContext';

const HomePage = () => {
  const { isPlaying, isLoading, currentTrack, togglePlay } = useAudio();
  const [barHeights, setBarHeights] = useState<number[]>([]);

  // Generate random heights for FFT bars
  useEffect(() => {
    if (isPlaying && !isLoading) {
      const interval = setInterval(() => {
        const newHeights = Array.from({ length: 8 }, () => 
          Math.random() * 40 + 10 // Random height between 10px and 50px
        );
        setBarHeights(newHeights);
      }, 150); // Update every 150ms for smooth animation

      return () => clearInterval(interval);
    } else {
      setBarHeights([]);
    }
  }, [isPlaying, isLoading]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className=" max-w-4xl mx-auto">
        <div className="text-center mb-12">
          
        </div>
        
        {/* Radio Player Section */}
        <div 
          className={`glass-card mb-8 transition-colors ${!isLoading ? 'cursor-pointer hover:bg-white/10' : 'cursor-wait'}`}
          onClick={!isLoading ? togglePlay : undefined}
        >
          <div className="text-center">
            <h3 className="text-2xl font-bold text-white mb-6">{currentTrack}</h3>
            
            {/* Play Button and Audio Visualization */}
            <div className="flex justify-center items-center mb-6 space-x-6">
              {/* Container with fixed height to prevent layout shift */}
              <div className="h-20 flex items-center justify-center">
                {!isPlaying ? (
                  <div
                    className="w-20 h-20 flex items-center justify-center"
                  >
                    {isLoading ? (
                      <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <div className="w-0 h-0 border-l-[30px] border-l-white border-t-[20px] border-t-transparent border-b-[20px] border-b-transparent ml-2"></div>
                    )}
                  </div>
                ) : null}
                
                {/* Dynamic FFT Audio Visualization - Clickable for pause */}
                {isPlaying && !isLoading && (
                  <div
                    className="flex items-end space-x-1 h-12"
                  >
                    {barHeights.map((height, i) => (
                      <div
                        key={i}
                        className="w-1 bg-white rounded-t-sm transition-all duration-150 ease-out"
                        style={{
                          height: `${height}px`
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
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
