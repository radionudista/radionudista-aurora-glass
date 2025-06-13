
import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import HomePage from '../components/HomePage';
import AboutPage from '../components/AboutPage';
import ContactPage from '../components/ContactPage';
import { AudioProvider } from '../contexts/AudioContext';

// You'll need to add video files to your project in the public/videos folder
const backgroundVideos = [
  '/videos/background1.mp4',
  '/videos/background2.mp4',
  '/videos/background3.mp4',
  '/videos/background4.mp4',
  '/videos/background5.mp4'
];

const Index = () => {
  const [currentPage, setCurrentPage] = useState('home');
  const [backgroundVideo, setBackgroundVideo] = useState('');
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    // Set random background video on page load
    const randomVideo = backgroundVideos[Math.floor(Math.random() * backgroundVideos.length)];
    setBackgroundVideo(randomVideo);
    console.log('Selected background video:', randomVideo);
    console.log('Full video URL:', window.location.origin + randomVideo);
    
    // Test if video file exists
    fetch(randomVideo, { method: 'HEAD' })
      .then(response => {
        console.log('Video file check:', response.status, response.ok);
        if (!response.ok) {
          console.error('Video file not found at:', randomVideo);
        }
      })
      .catch(error => {
        console.error('Error checking video file:', error);
      });
  }, []);

  const renderPage = () => {
    switch (currentPage) {
      case 'about':
        return <AboutPage />;
      case 'contact':
        return <ContactPage />;
      default:
        return <HomePage />;
    }
  };

  const handleVideoError = (event: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    console.log('Video error event:', event);
    console.log('Video failed to load:', backgroundVideo);
    setVideoError(true);
  };

  const handleVideoLoad = () => {
    console.log('Video loaded successfully:', backgroundVideo);
    setVideoError(false);
  };

  return (
    <AudioProvider>
      <div className="min-h-screen w-full overflow-hidden relative">
        {/* Background Video */}
        {!videoError && backgroundVideo ? (
          <video 
            className="fixed inset-0 w-full h-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            onError={handleVideoError}
            onLoadStart={() => console.log('Video loading started')}
            onCanPlay={() => console.log('Video can play')}
            onLoadedData={handleVideoLoad}
            onLoadedMetadata={() => console.log('Video metadata loaded')}
          >
            <source src={backgroundVideo} type="video/mp4" />
          </video>
        ) : null}
        
        {/* Fallback gradient background */}
        <div className={`fixed inset-0 w-full h-full bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 ${!videoError && backgroundVideo ? 'opacity-0' : 'opacity-100'} transition-opacity duration-1000`} />
        
        {/* Overlay for better contrast */}
        <div className="fixed inset-0 bg-black/40" />
        
        {/* Main Content */}
        <div className="relative z-10 min-h-screen flex flex-col">
          <Layout currentPage={currentPage} setCurrentPage={setCurrentPage}>
            {renderPage()}
          </Layout>
        </div>
      </div>
    </AudioProvider>
  );
};

export default Index;
