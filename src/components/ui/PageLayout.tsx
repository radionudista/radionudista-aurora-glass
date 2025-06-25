/**
 * Page Layout Component
 * 
 * Follows SOLID Principles:
 * - SRP: Single responsibility for page layout structure
 * - OCP: Extensible through props
 * - DRY: Eliminates duplicate page layout patterns
 */

import React from 'react';
import { cn } from '@/lib/utils';

interface PageLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  titleColor?: string;
  className?: string;
  containerClassName?: string;
  headerClassName?: string;
}

const PageLayout: React.FC<PageLayoutProps> = ({
  children,
  title,
  subtitle,
  titleColor = 'text-blue-300',
  className,
  containerClassName,
  headerClassName
}) => {
  return (
    <div className={cn('container mx-auto px-6 py-12', className)}>
      <div className={cn('glass-container max-w-4xl mx-auto', containerClassName)}>
        <div className={cn('text-center mb-16', headerClassName)}>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-8">
            {title.split(' ').map((word, index) => {
              // Check if this word should be colored (assuming the last word or words in brackets)
              const shouldColor = word.includes('RadioNudista') || 
                                 word.includes('Touch') || 
                                 word.includes('Nudista');
              
              return shouldColor ? (
                <React.Fragment key={index}>
                  {index > 0 && ' '}
                  <span className={titleColor}>{word}</span>
                </React.Fragment>
              ) : (
                <React.Fragment key={index}>
                  {index > 0 && ' '}
                  {word}
                </React.Fragment>
              );
            })}
          </h2>
          {subtitle && (
            <p className="text-xl text-gray-200">
              {subtitle}
            </p>
          )}
        </div>
        
        {children}
      </div>
    </div>
  );
};

export default PageLayout;
