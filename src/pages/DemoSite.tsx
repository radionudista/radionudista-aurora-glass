
import React, { useState } from 'react';
import PasswordProtection from '../components/PasswordProtection';
import Layout from '../components/Layout';
import HomePage from '../components/HomePage';
import AboutPage from '../components/AboutPage';
import ContactPage from '../components/ContactPage';
import { AudioProvider } from '../contexts/AudioContext';

const DemoSite = () => {
  const [currentPage, setCurrentPage] = useState('home');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

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

  if (!isAuthenticated) {
    return <PasswordProtection onCorrectPassword={() => setIsAuthenticated(true)} />;
  }

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
          <source src="/videos/background5.mp4" type="video/mp4" />
        </video>
        
        {/* Fallback gradient background */}
        <div className="fixed inset-0 w-full h-full bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900" />
        
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

export default DemoSite;
