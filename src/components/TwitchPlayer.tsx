
import React from 'react';

const TwitchPlayer = () => {
  return (
    <div className="min-h-screen w-full overflow-hidden relative">
      {/* Background Video */}
      <video 
        className="fixed inset-0 w-full h-full object-cover"
        autoPlay
        muted
        loop
        playsInline
      >
        <source src="/videos/background5.mp4" type="video/mp4" />
      </video>
      
      {/* Overlay for better contrast */}
      <div className="fixed inset-0 bg-black/60" />
      
      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6">
        {/* Logo */}
        <div className="flex items-center space-x-3 mb-8">
          <img 
            src="/lovable-uploads/ba6f20be-002c-47a0-ab7b-2e545a599205.png" 
            alt="RadioNudista Logo" 
            className="h-8 w-auto"
          />
          <h1 className="text-2xl md:text-3xl font-bold text-white">
            radio<span className="text-purple-400">nudista</span>
          </h1>
        </div>

        {/* Twitch Player Container */}
        <div className="glass-card p-4 w-full max-w-5xl">
          <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
            <iframe
              src="https://player.twitch.tv/?channel=radionudista&parent=localhost&parent=lovableproject.com&autoplay=true&muted=false"
              className="absolute top-0 left-0 w-full h-full rounded-lg"
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
