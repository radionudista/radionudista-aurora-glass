/**
 * Audio Visualization Component
 * 
 * Follows SOLID Principles:
 * - SRP: Single responsibility for rendering FFT visualization
 * - OCP: Extensible through props
 * - DRY: Reusable visualization component
 */

import React from 'react';
import { cn } from '@/lib/utils';

interface AudioVisualizationProps {
  barHeights: number[];
  className?: string;
  barClassName?: string;
  spacing?: 'tight' | 'normal' | 'loose';
}

const AudioVisualization: React.FC<AudioVisualizationProps> = ({
  barHeights,
  className,
  barClassName,
  spacing = 'normal'
}) => {
  const spacingClasses = {
    tight: 'space-x-0.5',
    normal: 'space-x-1',
    loose: 'space-x-2'
  };

  if (barHeights.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex items-end h-12',
        spacingClasses[spacing],
        className
      )}
    >
      {barHeights.map((height, index) => (
        <div
          key={index}
          className={cn(
            'w-1 bg-white rounded-t-sm transition-all duration-150 ease-out',
            barClassName
          )}
          style={{ height: `${height}px` }}
        />
      ))}
    </div>
  );
};

export default AudioVisualization;
