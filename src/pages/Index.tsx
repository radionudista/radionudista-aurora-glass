
import React, { useState } from 'react';
import CountdownTeaser from '../components/CountdownTeaser';
import TwitchPlayer from '../components/TwitchPlayer';

const Index = () => {
  const [showTwitch, setShowTwitch] = useState(false);
  
  const launchDate = new Date('2025-06-21T08:10:00-05:00');

  const handleCountdownEnd = () => {
    setShowTwitch(true);
  };

  if (showTwitch) {
    return <TwitchPlayer />;
  }

  return (
    <CountdownTeaser 
      targetDate={launchDate} 
      onCountdownEnd={handleCountdownEnd} 
    />
  );
};

export default Index;
