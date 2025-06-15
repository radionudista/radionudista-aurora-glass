
import React, { useState } from 'react';
import { Instagram, X, MessageCircle, Menu } from 'lucide-react';
import MiniPlayer from './MiniPlayer';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: string;
  setCurrentPage: (page: string) => void;
}

const Layout = ({ children, currentPage, setCurrentPage }: LayoutProps) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'home', label: 'Home' },
    { id: 'about', label: 'About' },
    { id: 'contact', label: 'Contact' }
  ];

  const handleMobileNavClick = (page: string) => {
    setCurrentPage(page);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar */}
      <nav className="glass-navbar fixed top-0 left-0 right-0 z-50 px-6 py-4 md:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <img 
              src="/lovable-uploads/ba6f20be-002c-47a0-ab7b-2e545a599205.png" 
              alt="RadioNudista Logo" 
              className="h-8 w-auto"
            />
            <h1 className="text-xl md:text-2xl font-bold text-white">
              radio<span className="text-purple-400">nudista</span>
            </h1>
          </div>
          
          {/* Mini Player - Only show when not on home page */}
          {currentPage !== 'home' && (
            <div className="hidden md:block">
              <MiniPlayer />
            </div>
          )}
          
          {/* Desktop Navigation Items */}
          <div className="hidden md:flex items-center space-x-6">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                className={`nav-link ${currentPage === item.id ? 'active' : ''}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          
          {/* Mobile Navigation */}
          <div className="md:hidden flex items-center space-x-3">
            {/* Mini Player Mobile - Only show when not on home page */}
            {currentPage !== 'home' && (
              <div className="scale-75 origin-center">
                <MiniPlayer />
              </div>
            )}
            
            {/* Mobile Hamburger Menu */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="nav-link p-2"
              aria-label="Open menu"
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          
          {/* Sliding Panel */}
          <div className={`absolute top-0 right-0 h-full w-80 max-w-[80vw] bg-black/40 backdrop-blur-xl border-l border-white/10 transform transition-transform duration-300 ease-out ${
            isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
          }`}>
            {/* Close Button */}
            <div className="flex justify-end p-6">
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="nav-link p-2"
                aria-label="Close menu"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            {/* Navigation Items */}
            <div className="px-8 py-4 space-y-8">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleMobileNavClick(item.id)}
                  className={`block w-full text-left py-4 px-6 rounded-lg text-lg font-medium transition-all duration-200 ${
                    currentPage === item.id 
                      ? 'text-blue-400 bg-blue-400/10' 
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            
            {/* Mini Player in Mobile Menu - Only show when not on home page */}
            {currentPage !== 'home' && (
              <div className="px-8 py-4 mt-12">
                <MiniPlayer />
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Content */}
      <main className="flex-1 pt-20 pb-20">
        {children}
      </main>
      
      {/* Footer */}
      <footer className="glass-footer fixed bottom-0 left-0 right-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-center space-x-8">
          <a href="#" className="social-icon">
            <MessageCircle className="w-6 h-6" />
          </a>
          <a href="#" className="social-icon">
            <Instagram className="w-6 h-6" />
          </a>
          <a href="#" className="social-icon">
            <X className="w-6 h-6" />
          </a>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
