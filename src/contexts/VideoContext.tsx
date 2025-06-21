
import React, { createContext, useContext, useState, useEffect } from 'react';

interface VideoContextType {
  currentVideo: string;
}

const VideoContext = createContext<VideoContextType | undefined>(undefined);

export const useVideo = () => {
  const context = useContext(VideoContext);
  if (context === undefined) {
    throw new Error('useVideo must be used within a VideoProvider');
  }
  return context;
};

export const VideoProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentVideo, setCurrentVideo] = useState('/videos/background5.mp4');

  useEffect(() => {
    const videos = [
      '/videos/background1.mp4',
      '/videos/background2.mp4',
      '/videos/background3.mp4',
      '/videos/background5.mp4'
    ];
    
    const randomVideo = videos[Math.floor(Math.random() * videos.length)];
    setCurrentVideo(randomVideo);
  }, []);

  return (
    <VideoContext.Provider value={{ currentVideo }}>
      {children}
    </VideoContext.Provider>
  );
};
