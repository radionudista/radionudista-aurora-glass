
import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import HomePage from '../components/HomePage';
import AboutPage from '../components/AboutPage';
import ContactPage from '../components/ContactPage';
import { AudioProvider } from '../contexts/AudioContext';

// You'll need to add video files to your project
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

  useEffect(() => {
    // Set random background video on page load
    const randomVideo = backgroundVideos[Math.floor(Math.random() * backgroundVideos.length)];
    setBackgroundVideo(randomVideo);
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

  return (
    <AudioProvider>
      <div className="min-h-screen w-full overflow-hidden relative">
        {/* Background Video */}
        <video 
          className="fixed inset-0 w-full h-full object-cover"
          autoPlay
          muted
          loop
          playsInline
        >
          <source src={backgroundVideo} type="video/mp4" />
          {/* Fallback for browsers that don't support video */}
          <div className="fixed inset-0 w-full h-full bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900" />
        </video>
        
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
