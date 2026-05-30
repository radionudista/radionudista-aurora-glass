
import React from 'react';
import Logo from './Logo';
import CountdownUnit from './ui/CountdownUnit';
import { useCountdown } from '../hooks/useCountdown';
import { TIME_CONSTANTS } from '../constants/timeConstants';
import { logger } from '../utils/logger';

interface CountdownTeaserProps {
  targetDate: Date;
  onCountdownEnd: () => void;
}

/**
 * CountdownTeaser Component
 * 
 * Follows Single Responsibility Principle:
 * - Only responsible for rendering the countdown teaser page
 * 
 * Follows DRY Principle:
 * - Uses reusable CountdownUnit components
 * - Delegates countdown logic to custom hook
 * 
 * Follows Dependency Inversion Principle:
 * - Depends on abstractions (hooks) rather than concrete implementations
 */
const CountdownTeaser: React.FC<CountdownTeaserProps> = ({ 
  targetDate, 
  onCountdownEnd 
}) => {
  const { timeLeft } = useCountdown(targetDate, onCountdownEnd);

  logger.debug('CountdownTeaser rendered', {
    targetDate: targetDate.toISOString(),
    timeLeft
  });

  return (
    <div className="min-h-screen w-full overflow-hidden relative bg-black">
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6">
        <div className="flex flex-col items-center gap-8">
          {/* Logo */}
          <Logo size="large" />

          {/* Countdown Glass Container */}
          <div className="glass-card p-8 max-w-2xl w-full">
            <div className="grid grid-cols-4 gap-4 md:gap-8">
              <CountdownUnit 
                value={timeLeft.days} 
                label={TIME_CONSTANTS.LABELS_ES.DAYS}
              />
              <CountdownUnit 
                value={timeLeft.hours} 
                label={TIME_CONSTANTS.LABELS_ES.HOURS}
              />
              <CountdownUnit 
                value={timeLeft.minutes} 
                label={TIME_CONSTANTS.LABELS_ES.MINUTES}
              />
              <CountdownUnit 
                value={timeLeft.seconds} 
                label={TIME_CONSTANTS.LABELS_ES.SECONDS}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CountdownTeaser;
