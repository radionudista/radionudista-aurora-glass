import { useState, useEffect } from 'react';
import { TIME_CONSTANTS } from '../constants/timeConstants';

/**
 * Time remaining interface
 */
export interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/**
 * Custom hook for countdown functionality
 * 
 * Follows Single Responsibility Principle:
 * - Only responsible for countdown logic
 * 
 * Follows DRY Principle:
 * - Reusable countdown logic across components
 */
export const useCountdown = (targetDate: Date, onComplete?: () => void) => {
  const [timeLeft, setTimeLeft] = useState<TimeRemaining>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = (): TimeRemaining => {
      const now = new Date().getTime();
      const difference = targetDate.getTime() - now;
      
      if (difference > 0) {
        return {
          days: Math.floor(difference / TIME_CONSTANTS.MILLISECONDS.DAY),
          hours: Math.floor((difference / TIME_CONSTANTS.MILLISECONDS.HOUR) % 24),
          minutes: Math.floor((difference / TIME_CONSTANTS.MILLISECONDS.MINUTE) % 60),
          seconds: Math.floor((difference / TIME_CONSTANTS.MILLISECONDS.SECOND) % 60)
        };
      } else {
        // Countdown has ended
        if (!isComplete) {
          setIsComplete(true);
          onComplete?.();
        }
        return { days: 0, hours: 0, minutes: 0, seconds: 0 };
      }
    };

    // Initial calculation
    setTimeLeft(calculateTimeLeft());

    // Set up interval for updates
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, TIME_CONSTANTS.INTERVALS.COUNTDOWN_UPDATE);

    // Cleanup interval on unmount
    return () => clearInterval(timer);
  }, [targetDate, onComplete, isComplete]);

  return {
    timeLeft,
    isComplete
  };
};
