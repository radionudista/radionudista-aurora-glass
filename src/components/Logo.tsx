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
          image: 'h-6 w-auto',
          text: 'text-lg md:text-xl'
        };
      case 'medium':
        return {
          image: 'h-8 w-auto',
          text: 'text-xl md:text-2xl'
        };
      case 'large':
        return {
          image: 'h-12 w-auto',
          text: 'text-4xl md:text-6xl'
        };
      default:
        return {
          image: 'h-8 w-auto',
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
      <h1 className={`${sizeClasses.text} text-white `} >
        <span style={{ all: 'unset' }} className="font-thin">radio</span><span className="font-bold">nudista</span>
      </h1>
    </div>
  );
};

export default Logo;
