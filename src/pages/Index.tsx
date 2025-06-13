
import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import HomePage from '../components/HomePage';
import AboutPage from '../components/AboutPage';
import ContactPage from '../components/ContactPage';

const backgroundImages = [
  'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1920&h=1280&fit=crop',
  'https://images.unsplash.com/photo-1500673922987-e212871fec22?w=1920&h=1280&fit=crop',
  'https://images.unsplash.com/photo-1470813740244-df37b8c1edcb?w=1920&h=1280&fit=crop',
  'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1920&h=1280&fit=crop',
  'https://images.unsplash.com/photo-1482938289607-e9573fc25ebb?w=1920&h=1280&fit=crop'
];

const Index = () => {
  const [currentPage, setCurrentPage] = useState('home');
  const [backgroundImage, setBackgroundImage] = useState('');

  useEffect(() => {
    // Set random background image on page load
    const randomImage = backgroundImages[Math.floor(Math.random() * backgroundImages.length)];
    setBackgroundImage(randomImage);
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
    <div className="min-h-screen w-full overflow-hidden relative">
      {/* Background Image */}
      <div 
        className="fixed inset-0 w-full h-full bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${backgroundImage})` }}
      />
      
      {/* Overlay for better contrast */}
      <div className="fixed inset-0 bg-black/30" />
      
      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        <Layout currentPage={currentPage} setCurrentPage={setCurrentPage}>
          {renderPage()}
        </Layout>
      </div>
    </div>
  );
};

export default Index;
