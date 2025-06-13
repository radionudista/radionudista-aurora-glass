
import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import HomePage from '../components/HomePage';
import AboutPage from '../components/AboutPage';
import ContactPage from '../components/ContactPage';
import { AudioProvider } from '../contexts/AudioContext';

const backgroundImages = [
  '/lovable-uploads/1dcc5c3d-fb2a-4809-969e-295721e3be1e.png',
  '/lovable-uploads/bdd6c6c8-ea8c-4919-a194-bd7505735eb8.png',
  '/lovable-uploads/5e6c8844-321d-4ee4-bbe1-de1e0d2c6385.png',
  '/lovable-uploads/b3a41135-c36d-42cc-9252-254a6ba3f398.png',
  '/lovable-uploads/593c14bc-ad36-4608-b97d-0527d8376f3e.png',
  '/lovable-uploads/f404ced0-df35-4c36-a07c-f1825211fde2.png',
  '/lovable-uploads/1bbb4850-621c-4101-bc60-5b4a2f322633.png',
  '/lovable-uploads/3c98a641-b62a-4246-bc5f-0e8aa8c0204d.png',
  '/lovable-uploads/f60b5d6a-eae5-4e7f-a0b8-de3be2d1c7a7.png',
  '/lovable-uploads/f9372b8d-dab4-4380-9ac2-059853b42009.png'
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
    <AudioProvider>
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
    </AudioProvider>
  );
};

export default Index;
