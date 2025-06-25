import React from 'react';
import { TYPOGRAPHY, getFontStyle, getTextClasses } from '../../utils/typography';

/**
 * Props for CountdownUnit component
 */
interface CountdownUnitProps {
  /**
   * The numeric value to display
   */
  value: number;
  
  /**
   * The label for this time unit (e.g., "Days", "Hours")
   */
  label: string;
  
  /**
   * Additional CSS classes
   */
  className?: string;
  
  /**
   * Size variant for the component
   */
  size?: 'small' | 'medium' | 'large';
}

/**
 * CountdownUnit Component
 * 
 * Follows Single Responsibility Principle:
 * - Only responsible for rendering a single countdown time unit
 * 
 * Follows DRY Principle:
 * - Reusable component for all time units in countdown
 * - Uses centralized typography utilities
 * 
 * Follows Open/Closed Principle:
 * - Open for extension through props
 * - Closed for modification of core functionality
 */
const CountdownUnit: React.FC<CountdownUnitProps> = ({
  value,
  label,
  className = '',
  size = 'large'
}) => {
  const formattedValue = value.toString().padStart(2, '0');
  
  // Get typography configurations based on size
  const numberSize = TYPOGRAPHY.SIZES.COUNTDOWN[size.toUpperCase() as keyof typeof TYPOGRAPHY.SIZES.COUNTDOWN];
  const labelSize = TYPOGRAPHY.SIZES.LABEL[size.toUpperCase() as keyof typeof TYPOGRAPHY.SIZES.LABEL];
  
  const numberClasses = getTextClasses(
    numberSize,
    'text-white',
    'font-light mb-2'
  );
  
  const labelClasses = getTextClasses(
    labelSize,
    'text-gray-300',
    'uppercase tracking-wider'
  );

  return (
    <div className={`text-center ${className}`}>
      <div 
        className={numberClasses}
        style={getFontStyle(TYPOGRAPHY.WEIGHTS.LIGHT)}
      >
        {formattedValue}
      </div>
      <div className={labelClasses}>
        {label}
      </div>
    </div>
  );
};

export default CountdownUnit;
