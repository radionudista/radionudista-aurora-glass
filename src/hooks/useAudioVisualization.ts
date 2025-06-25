/**
 * Audio Visualization Hook
 * 
 * Follows SOLID Principles:
 * - SRP: Single responsibility for FFT visualization logic
 * - OCP: Extensible configuration
 * - DRY: Reusable across components
 */

import { useState, useEffect } from 'react';
import { MEDIA_CONSTANTS, generateFFTBars } from '../constants/mediaConstants';

interface UseAudioVisualizationOptions {
  isPlaying: boolean;
  isLoading: boolean;
  barCount?: number;
  updateInterval?: number;
}

export const useAudioVisualization = ({
  isPlaying,
  isLoading,
  barCount = MEDIA_CONSTANTS.VISUALIZATION.FFT_BARS,
  updateInterval = MEDIA_CONSTANTS.VISUALIZATION.BAR_UPDATE_RATE
}: UseAudioVisualizationOptions) => {
  const [barHeights, setBarHeights] = useState<number[]>([]);

  useEffect(() => {
    if (isPlaying && !isLoading) {
      const interval = setInterval(() => {
        setBarHeights(generateFFTBars(barCount));
      }, updateInterval);

      return () => clearInterval(interval);
    } else {
      setBarHeights([]);
    }
  }, [isPlaying, isLoading, barCount, updateInterval]);

  return { barHeights };
};
