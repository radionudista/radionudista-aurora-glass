import React from 'react';

interface LogoProps {
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

const Logo = ({ size = 'medium', className = '' }: LogoProps) => {
  const getSizeClasses = () => {
    switch (size) {
      case 'small':
        return {
          image: 'h-7 w-auto',
          text: 'text-lg md:text-xl'
        };
      case 'medium':
        return {
          image: 'h-9 w-auto',
          text: 'text-xl md:text-2xl'
        };
      case 'large':
        return {
          image: 'h-14 w-auto',
          text: 'text-4xl md:text-6xl'
        };
      default:
        return {
          image: 'h-9 w-auto',
          text: 'text-xl md:text-2xl'
        };
    }
  };

  const sizeClasses = getSizeClasses();

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      <img 
        src="/lovable-uploads/ba6f20be-002c-47a0-ab7b-2e545a599205.png" 
        alt="RadioNudista Logo" 
        className={sizeClasses.image}
      />
      <h1 
        className={`${sizeClasses.text} text-white`} 
        style={{ 
          fontFamily: 'AkzidenzGrotesk, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          display: 'flex',
          alignItems: 'baseline',
          lineHeight: '1',
          margin: 0,
          padding: 0
        }}
      >
        <span style={{ 
          fontWeight: 300, 
          lineHeight: 'inherit',
          verticalAlign: 'baseline',
          fontSize: 'inherit'
        }}>radio</span><span style={{ 
          fontWeight: 900, 
          lineHeight: 'inherit',
          verticalAlign: 'baseline',
          fontSize: 'inherit'
        }}>nudista</span>
      </h1>
    </div>
  );
};

export default Logo;
