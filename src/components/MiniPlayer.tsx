import { useAudio } from '../contexts/AudioContext';
import { useNewsTicker } from '../hooks/useTextScrolling';
import MediaButton from './ui/MediaButton';

/**
 * MiniPlayer Component
 *
 * Compact version of the radio player with news ticker text scrolling.
 * Features:
 * - Consistent play/pause button styling with RadioPlayer
 * - Same play/pause logic as RadioPlayer
 * - Fixed height that doesn't change on play/pause
 * - Simple news ticker effect when playing
 * - Text never escapes the glass container limits
 * - Seamless right-to-left scrolling animation
 * - Fully transparent text canvas
 */
const MiniPlayer = () => {
  const audioContext = useAudio();

  // Get display text based on current source
  const displayText = audioContext.currentSource === 'program' && audioContext.currentProgramTitle
    ? `Program: ${audioContext.currentProgramTitle}`
    : audioContext.currentTrack;

  // Use simple news ticker effect - only when playing
  const { containerRef, textRef } = useNewsTicker({
    text: displayText,
    isActive: audioContext.isPlaying,
    speed: 60 // 60 pixels per second for MiniPlayer
  });

  return (
    <div 
      className={`flex items-center space-x-2 glass-card px-2 py-1.5 max-w-xs ${
        !audioContext.isLoading ? 'cursor-pointer' : 'cursor-wait'
      }`}
      style={{ minHeight: '40px', maxHeight: '40px' }} // Fixed height constraints
    >
      {/* Play/Pause Button Container - Fixed dimensions for both states */}
      <div
        className="flex items-center justify-center flex-shrink-0"
        style={{ width: '24px', height: '24px' }} // Fixed container size
      >
        {audioContext.isLoading || !audioContext.isPlaying ? (
          <MediaButton
            isPlaying={audioContext.isPlaying}
            isLoading={audioContext.isLoading}
            onClick={audioContext.togglePlay}
            size="small"
          />
        ) : (
          // Custom pause button that matches the fixed container
          <button
            onClick={audioContext.togglePlay}
            className="flex items-center justify-center transition-all duration-200 hover:scale-105 touch-manipulation"
            style={{
              width: '24px',
              height: '24px',
              minHeight: '24px',
              minWidth: '24px'
            }}
            aria-label="Pause"
          >
            <div className="flex space-x-0.5">
              <div
                className="bg-white"
                style={{
                  width: '2.4px', // Increased from 2px to 2.4px (20% increase)
                  height: '12px' // Increased from 10px to 12px (20% increase)
                }}
              />
              <div
                className="bg-white"
                style={{
                  width: '2.4px', // Increased from 2px to 2.4px (20% increase)
                  height: '12px' // Increased from 10px to 12px (20% increase)
                }}
              />
            </div>
          </button>
        )}
      </div>

      {/* Text container with news ticker scrolling - fully transparent canvas */}
      <div
        ref={containerRef}
        className="flex-1 min-w-0 relative"
        style={{
          height: '1.2rem',
          overflow: 'hidden',
          minWidth: '80px',
          backgroundColor: 'transparent'
        }}
      >
        <div
          ref={textRef}
          className="absolute top-0 left-0 h-full flex items-center text-white text-xs font-medium whitespace-nowrap"
          style={{
            paddingLeft: '0.2rem',
            paddingRight: '0.2rem',
            lineHeight: '1.2rem'
          }}
        >
          {displayText || 'RadioNudista - Live Stream'}
        </div>
      </div>

      {/* Error indicator */}
      {audioContext.error && (
        <div 
          className="w-2 h-2 bg-red-400 rounded-full animate-pulse flex-shrink-0" 
          title={`Error: ${audioContext.error}`}
          aria-label={`Audio error: ${audioContext.error}`}
        />
      )}
    </div>
  );
};

export default MiniPlayer;
