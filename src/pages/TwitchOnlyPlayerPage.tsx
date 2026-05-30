import React, { useState, useEffect } from 'react';
import Logo from '../components/Logo';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { getTwitchPlayerUrl } from '../utils/twitchUtils';

// Extend Navigator interface for Brave browser detection
interface BraveNavigator extends Navigator {
  brave?: {
    isBrave(): Promise<boolean>;
  };
}

const TwitchOnlyPlayerPage = () => {
  const [isBraveOrBlocked, setIsBraveOrBlocked] = useState(false);
  const [playerError, setPlayerError] = useState(false);
  const [twitchUrl, setTwitchUrl] = useState('');

  useEffect(() => {
    const url = getTwitchPlayerUrl();
    setTwitchUrl(url);

    logger.info('TwitchOnlyPlayerPage component mounted', {
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

  // Calculate player dimensions based on config percentage
  const playerSizePercent = env.TWITCH_PLAYER_WINDOW_SIZE_PERCENT / 100;
  const playerWidth = `${playerSizePercent * 100}vw`;
  const playerHeight = `${(playerSizePercent * 100) * (9 / 16)}vw`; // 16:9 aspect ratio

  return (
    <div className=" w-full  ">
      

      {/* Centered content with logo overlay */}
      <div className="absolute inset-0 flex items-center justify-center z-10">


        {/* Twitch Player Container - Centered */}
        <div className="relative">
          {(isBraveOrBlocked || playerError) ? (
            // Fallback content for Brave browser or when player is blocked
            <div className="bg-purple-900/40 backdrop-blur-md rounded-lg p-8 text-center max-w-md mx-auto">
              <h3 className="text-2xl font-bold text-white mb-4">
                🛡️ Browser Protection Detected
              </h3>
              <p className="text-white/90 mb-6 text-sm">
                Your browser is blocking the Twitch player due to privacy/ad blocking settings.
              </p>

              <div className="space-y-3">
                <div className="bg-black/40 p-4 rounded-md">
                  <h4 className="text-white font-semibold mb-2 text-sm">📺 How to Watch:</h4>
                  <ul className="text-white/80 space-y-1 text-xs">
                    <li>• <a href={env.STREAM_URL} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">Open in Twitch</a></li>
                    <li>• Disable ad-blocker for this site</li>
                    <li>• Try a different browser</li>
                  </ul>
                </div>
              </div>

              <div className="mt-4">
                <button
                  onClick={() => window.open(env.STREAM_URL, '_blank', 'noopener,noreferrer')}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md font-semibold transition-colors text-sm"
                >
                  🚀 Open Stream
                </button>
              </div>
            </div>
          ) : (
            // Normal Twitch player - sized according to config
            <div
              className="relative rounded-lg overflow-hidden shadow-2xl"
              style={{
                width: playerWidth,
                height: playerHeight,
                maxWidth: '100vw',
                maxHeight: '56.25vw' // 16:9 aspect ratio max
              }}
            >
              <iframe
                src={twitchUrl}
                className="absolute top-0 left-0 w-full h-full"
                allowFullScreen
                title="RadioNudista Twitch Stream"
                allow="autoplay; fullscreen"
                sandbox="allow-scripts allow-same-origin allow-presentation"
                onError={handleIframeError}
              />
            </div>
          )}
        </div>

        {/* Live indicator - positioned below player */}
        {!isBraveOrBlocked && !playerError && (
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex items-center space-x-2 z-20">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-white font-medium text-sm">LIVE NOW</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default TwitchOnlyPlayerPage;