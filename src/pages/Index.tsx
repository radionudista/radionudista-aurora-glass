
import React, { useState } from 'react';
import CountdownTeaser from '../components/CountdownTeaser';
import TwitchPlayer from '../components/TwitchPlayer';

const Index = () => {
  const [showTwitch, setShowTwitch] = useState(false);
  
  // Set your launch date here (example: January 1, 2025)
  const launchDate = new Date('2024-12-31T23:59:59');

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
