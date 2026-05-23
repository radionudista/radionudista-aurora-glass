import React from 'react';
import MediaButton from './MediaButton';

interface PlayPauseButtonProps {
  isPlaying: boolean;
  isLoading: boolean;
  onTogglePlay: () => void;
  size: 'small' | 'medium' | 'large';
  isMobile: boolean;
}

/**
 * Specialized Play/Pause Button Component
 * Follows Single Responsibility Principle - only manages play/pause UI
 */
export const PlayPauseButton: React.FC<PlayPauseButtonProps> = ({
  isPlaying,
  isLoading,
  onTogglePlay,
  size,
  isMobile
}) => {
  const getButtonSize = () => {
    switch (size) {
      case 'small': return isMobile ? 36 : 48;
      case 'medium': return isMobile ? 48 : 64;
      case 'large': return isMobile ? 56 : 80;
      default: return isMobile ? 56 : 80;
    }
  };

  const buttonSize = getButtonSize();

  const containerStyle = {
    width: isMobile ? buttonSize * 0.8 : buttonSize * 0.6,
    height: isMobile ? buttonSize * 0.8 : buttonSize * 0.6
  };

  if (isLoading || !isPlaying) {
    return (
      <div
        className="flex items-center justify-center md:justify-start"
        style={containerStyle}
      >
        <MediaButton
          isPlaying={isPlaying}
          isLoading={isLoading}
          onClick={onTogglePlay}
          size={isMobile ? (size === 'large' ? 'medium' : 'small') : size}
        />
      </div>
    );
  }

  return (
    <div
      className="flex items-center justify-center md:justify-start"
      style={containerStyle}
    >
      <button
        onClick={onTogglePlay}
        className="flex items-center justify-center transition-all duration-200 hover:scale-105 touch-manipulation"
        style={{
          minHeight: isMobile ? '36px' : '44px',
          minWidth: isMobile ? '36px' : '44px'
        }}
        aria-label="Pause"
      >
        <div className={`flex ${isMobile ? 'space-x-0.5' : 'space-x-1'}`}>
          <div
            className="bg-white rounded-sm"
            style={{
              width: isMobile ? '2.4px' : '2px', // Increased from 2px to 2.4px (20% increase)
              height: isMobile ? buttonSize * 0.3 : buttonSize * 0.3 // Increased from 0.25 to 0.3 (20% increase)
            }}
          />
          <div
            className="bg-white rounded-sm"
            style={{
              width: isMobile ? '2.4px' : '2px', // Increased from 2px to 2.4px (20% increase)
              height: isMobile ? buttonSize * 0.3 : buttonSize * 0.3 // Increased from 0.25 to 0.3 (20% increase)
            }}
          />
        </div>
      </button>
    </div>
  );
};
