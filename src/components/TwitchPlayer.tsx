
import React, { useState, useEffect } from 'react';
import BackgroundVideo from './BackgroundVideo';
import Logo from './Logo';
import { getDynamicPlayerSize } from '../constants/mediaConstants';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { getTwitchPlayerUrl } from '../utils/twitchUtils';

// Extend Navigator interface for Brave browser detection
interface BraveNavigator extends Navigator {
  brave?: {
    isBrave(): Promise<boolean>;
  };
}

const TwitchPlayer = () => {
  const [isBraveOrBlocked, setIsBraveOrBlocked] = useState(false);
  const [playerError, setPlayerError] = useState(false);
  const [twitchUrl, setTwitchUrl] = useState('');

  useEffect(() => {
    const url = getTwitchPlayerUrl();
    setTwitchUrl(url);

    logger.info('TwitchPlayer component mounted', {
      twitchSrcUrl: url,
      streamUrl: env.STREAM_URL,
      playerSizePercent: env.TWITCH_PLAYER_WINDOW_SIZE_PERCENT
    });

    // Detect Brave browser or check for blocked content
    const detectBraveOrBlocking = async () => {
      // Check if navigator.brave exists (Brave browser)
      const braveNavigator = navigator as BraveNavigator;
      if (braveNavigator.brave && await braveNavigator.brave.isBrave()) {
        logger.warn('Brave browser detected, may block Twitch player');
        setIsBraveOrBlocked(true);
      }
    };

    detectBraveOrBlocking();
  }, []);

  const handleIframeError = () => {
    logger.error('Twitch iframe failed to load');
    setPlayerError(true);
  };
  return (
    <div className="min-h-screen w-full overflow-hidden relative">
      <BackgroundVideo overlayOpacity={0.6} />
      
      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6">
        {/* Logo */}
        <Logo size="medium" className="mb-8" />

        {/* Twitch Player Container */}
        <div className="glass-card p-4 w-full max-w-5xl">
          {(isBraveOrBlocked || playerError) ? (
            // Fallback content for Brave browser or when player is blocked
            <div className="bg-purple-900/30 backdrop-blur-sm rounded-md p-8 text-center">
              <h3 className="text-2xl font-bold text-white mb-4">
                🛡️ Browser Protection Detected
              </h3>
              <p className="text-white/80 mb-6">
                Your browser (likely Brave) is blocking the Twitch player due to privacy/ad blocking settings.
              </p>
              
              <div className="space-y-4 text-left">
                <div className="bg-black/30 p-4 rounded-md">
                  <h4 className="text-white font-semibold mb-2">📺 How to Watch:</h4>
                  <ul className="text-white/90 space-y-2">
                    <li>• <strong>Direct Link:</strong> <a href={env.STREAM_URL} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">{env.STREAM_URL}</a></li>
                    <li>• <strong>Disable Shields:</strong> Click the Brave shield icon and disable for this site</li>
                    <li>• <strong>Alternative:</strong> Try a different browser (Chrome, Firefox, Safari)</li>
                  </ul>
                </div>
                
                <div className="bg-black/30 p-4 rounded-md">
                  <h4 className="text-white font-semibold mb-2">🔧 Brave Browser Fix:</h4>
                  <ol className="text-white/90 space-y-1 list-decimal list-inside">
                    <li>Click the Brave shield icon (🛡️) in the address bar</li>
                    <li>Turn off "Block trackers & ads" for this site</li>
                    <li>Refresh the page</li>
                  </ol>
                </div>
              </div>
              
              <div className="mt-6">
                <button 
                  onClick={() => window.open(env.STREAM_URL, '_blank', 'noopener,noreferrer')}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-md font-semibold transition-colors"
                >
                  🚀 Open in Twitch
                </button>
              </div>
            </div>
          ) : (
            // Normal Twitch player
            <div 
              className="relative w-full" 
              style={getDynamicPlayerSize('VIDEO_16_9')}
            >
              <iframe
                src={twitchUrl}
                className="absolute top-0 left-0 w-full h-full rounded-md"
                allowFullScreen
                title="RadioNudista Twitch Stream"
                allow="autoplay; fullscreen"
                sandbox="allow-scripts allow-same-origin allow-presentation"
                onError={handleIframeError}
              />
            </div>
          )}
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
