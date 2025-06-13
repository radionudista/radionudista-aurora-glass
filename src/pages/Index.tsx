
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
  '/videos/background5.mp4',
];

const Index = () => {
  const [currentPage, setCurrentPage] = useState('home');
  const [backgroundVideo, setBackgroundVideo] = useState('');
  const [videoError, setVideoError] = useState(false);
  const [videoLoading, setVideoLoading] = useState(true);

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
          setVideoError(true);
          setVideoLoading(false);
        }
      })
      .catch(error => {
        console.error('Error checking video file:', error);
        setVideoError(true);
        setVideoLoading(false);
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
    setVideoLoading(false);
  };

  const handleVideoLoad = () => {
    console.log('Video loaded successfully:', backgroundVideo);
    setVideoError(false);
    setVideoLoading(false);
  };

  return (
    <AudioProvider>
      <div className="min-h-screen w-full overflow-hidden relative">
        {/* Loading Background Image */}
        {videoLoading && (
          <div 
            className="fixed inset-0 w-full h-full bg-cover bg-center bg-no-repeat transition-opacity duration-1000"
            style={{
              backgroundImage: `url('https://images.unsplash.com/photo-1470813740244-df37b8c1edcb?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80')`
            }}
          />
        )}
        
        {/* Background Video */}
        {!videoError && backgroundVideo ? (
          <video 
            className={`fixed inset-0 w-full h-full object-cover transition-opacity duration-1000 ${videoLoading ? 'opacity-0' : 'opacity-100'}`}
            autoPlay
            muted
            loop
            playsInline
            onError={handleVideoError}
            onLoadStart={() => {
              console.log('Video loading started');
              setVideoLoading(true);
            }}
            onCanPlay={() => {
              console.log('Video can play');
              setVideoLoading(false);
            }}
            onLoadedData={handleVideoLoad}
            onLoadedMetadata={() => console.log('Video metadata loaded')}
          >
            <source src={backgroundVideo} type="video/mp4" />
          </video>
        ) : null}
        
        {/* Fallback gradient background */}
        <div className={`fixed inset-0 w-full h-full bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 ${!videoError && backgroundVideo && !videoLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-1000`} />
        
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
