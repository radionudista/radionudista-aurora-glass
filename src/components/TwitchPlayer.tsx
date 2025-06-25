
import React from 'react';
import BackgroundVideo from './BackgroundVideo';
import Logo from './Logo';
import { getAspectRatioPadding } from '../constants/mediaConstants';

const TwitchPlayer = () => {
  return (
    <div className="min-h-screen w-full overflow-hidden relative">
      <BackgroundVideo overlayOpacity={0.6} />
      
      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6">
        {/* Logo */}
        <Logo size="medium" className="mb-8" />

        {/* Twitch Player Container */}
        <div className="glass-card p-4 w-full max-w-5xl">
          <div 
            className="relative w-full" 
            style={getAspectRatioPadding('VIDEO_16_9')}
          >
            <iframe
              src="https://player.twitch.tv/?channel=radionudista&parent=localhost&parent=lovableproject.com&autoplay=true&muted=false"
              className="absolute top-0 left-0 w-full h-full rounded-md"
              allowFullScreen
              title="RadioNudista Twitch Stream"
            />
          </div>
        </div>

        {/* Live indicator */}
        <div className="mt-6 flex items-center space-x-2">
          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
          <span className="text-white font-medium">LIVE NOW</span>
        </div>
      </div>
    </div>
  );
};

export default TwitchPlayer;
