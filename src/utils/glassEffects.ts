/**
 * Glass Effect Utilities
 * 
 * Follows DRY Principle:
 * - Centralized glass effect configurations
 * - Reusable across all components
 */

import React from 'react';
import { cn } from '@/lib/utils';

export type GlassVariant = 'card' | 'navbar' | 'footer' | 'container' | 'input' | 'button';

export interface GlassConfig {
  className: string;
  style?: React.CSSProperties;
}

/**
 * Get glass effect configuration by variant
 */
export const getGlassConfig = (variant: GlassVariant): GlassConfig => {
  const configs: Record<GlassVariant, GlassConfig> = {
    card: {
      className: 'glass-card'
    },
    navbar: {
      className: 'glass-navbar'
    },
    footer: {
      className: 'glass-footer'
    },
    container: {
      className: 'glass-container'
    },
    input: {
      className: 'glass-input'
    },
    button: {
      className: 'glass-button'
    }
  };

  return configs[variant];
};

/**
 * Glass wrapper component for consistent glass effects
 */
interface GlassWrapperProps {
  variant: GlassVariant;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const GlassWrapper: React.FC<GlassWrapperProps> = ({
  variant,
  children,
  className,
  style
}) => {
  const config = getGlassConfig(variant);
  
  return React.createElement(
    'div',
    {
      className: cn(config.className, className),
      style: { ...config.style, ...style }
    },
    children
  );
};

/**
 * Custom hook for glass effects
 */
export const useGlass = (variant: GlassVariant, additionalClassName?: string) => {
  const config = getGlassConfig(variant);
  
  return {
    className: cn(config.className, additionalClassName),
    style: config.style
  };
};
