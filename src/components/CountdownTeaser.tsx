
import React, { useState, useEffect } from 'react';

interface CountdownTeaserProps {
  targetDate: Date;
  onCountdownEnd: () => void;
}

const CountdownTeaser = ({ targetDate, onCountdownEnd }: CountdownTeaserProps) => {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = targetDate.getTime() - new Date().getTime();
      
      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60)
        });
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        onCountdownEnd();
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [targetDate, onCountdownEnd]);

  return (
    <div className="min-h-screen w-full overflow-hidden relative">
      {/* Background Video */}
      <video 
        className="fixed inset-0 w-full h-full object-cover"
        autoPlay
        muted
        loop
        playsInline
      >
        <source src="/videos/background5.mp4" type="video/mp4" />
      </video>
      
      {/* Overlay for better contrast */}
      <div className="fixed inset-0 bg-black/50" />
      
      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6">
        {/* Logo */}
        <div className="flex items-center space-x-3 mb-12">
          <img 
            src="/lovable-uploads/ba6f20be-002c-47a0-ab7b-2e545a599205.png" 
            alt="RadioNudista Logo" 
            className="h-12 w-auto"
          />
          <h1 className="text-4xl md:text-6xl font-bold text-white">
            radio<span className="text-purple-400">nudista</span>
          </h1>
        </div>

        {/* Coming Soon Text */}
        <h2 className="text-2xl md:text-3xl font-semibold text-white mb-8 text-center">
          Coming Soon
        </h2>

        {/* Countdown Glass Container */}
        <div className="glass-card p-8 max-w-2xl w-full">
          <div className="grid grid-cols-4 gap-4 md:gap-8">
            <div className="text-center">
              <div className="text-3xl md:text-5xl font-bold text-white mb-2">
                {timeLeft.days.toString().padStart(2, '0')}
              </div>
              <div className="text-sm md:text-base text-gray-300 uppercase tracking-wider">
                Days
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-3xl md:text-5xl font-bold text-white mb-2">
                {timeLeft.hours.toString().padStart(2, '0')}
              </div>
              <div className="text-sm md:text-base text-gray-300 uppercase tracking-wider">
                Hours
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-3xl md:text-5xl font-bold text-white mb-2">
                {timeLeft.minutes.toString().padStart(2, '0')}
              </div>
              <div className="text-sm md:text-base text-gray-300 uppercase tracking-wider">
                Minutes
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-3xl md:text-5xl font-bold text-white mb-2">
                {timeLeft.seconds.toString().padStart(2, '0')}
              </div>
              <div className="text-sm md:text-base text-gray-300 uppercase tracking-wider">
                Seconds
              </div>
            </div>
          </div>
        </div>

        {/* Launch Message */}
        <p className="text-lg md:text-xl text-gray-300 mt-8 text-center max-w-md">
          Get ready for an amazing music experience
        </p>
      </div>
    </div>
  );
};

export default CountdownTeaser;
