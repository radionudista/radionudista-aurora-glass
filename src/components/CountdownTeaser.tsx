
import React, { useState, useEffect } from 'react';
import Logo from './Logo';
import BackgroundVideo from './BackgroundVideo';

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
      <BackgroundVideo overlayOpacity={0.5} />
      
      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6">
        {/* Logo */}
        <Logo size="large" className="mb-12" />

        {/* Countdown Glass Container */}
        <div className="glass-card p-8 max-w-2xl w-full">
          <div className="grid grid-cols-4 gap-4 md:gap-8">
            <div className="text-center">
              <div className="text-3xl md:text-5xl font-bold text-white mb-2">
                {timeLeft.days.toString().padStart(2, '0')}
              </div>
              <div className="text-sm md:text-base text-gray-300 uppercase tracking-wider">
                Días
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-3xl md:text-5xl font-bold text-white mb-2">
                {timeLeft.hours.toString().padStart(2, '0')}
              </div>
              <div className="text-sm md:text-base text-gray-300 uppercase tracking-wider">
                Horas
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-3xl md:text-5xl font-bold text-white mb-2">
                {timeLeft.minutes.toString().padStart(2, '0')}
              </div>
              <div className="text-sm md:text-base text-gray-300 uppercase tracking-wider">
                Minutos
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-3xl md:text-5xl font-bold text-white mb-2">
                {timeLeft.seconds.toString().padStart(2, '0')}
              </div>
              <div className="text-sm md:text-base text-gray-300 uppercase tracking-wider">
                Segundos
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CountdownTeaser;
