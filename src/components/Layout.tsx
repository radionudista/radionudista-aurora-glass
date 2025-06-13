
import React from 'react';
import { Instagram, X, MessageCircle } from 'lucide-react';
import MiniPlayer from './MiniPlayer';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: string;
  setCurrentPage: (page: string) => void;
}

const Layout = ({ children, currentPage, setCurrentPage }: LayoutProps) => {
  const navItems = [
    { id: 'home', label: 'Home' },
    { id: 'about', label: 'About' },
    { id: 'contact', label: 'Contact' }
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar - Only show on non-home pages */}
      {currentPage !== 'home' && (
        <nav className="glass-navbar fixed top-0 left-0 right-0 z-50 px-4 py-4 md:px-8">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <img 
                src="/lovable-uploads/ba6f20be-002c-47a0-ab7b-2e545a599205.png" 
                alt="RadioNudista Logo" 
                className="h-6 w-auto opacity-80"
              />
              <h1 className="text-lg font-light text-white">
                radionudista
              </h1>
            </div>
            
            {/* Mini Player */}
            <div className="hidden md:block">
              <MiniPlayer />
            </div>
            
            {/* Navigation Items */}
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
            <div className="md:hidden flex items-center space-x-4">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setCurrentPage(item.id)}
                  className={`nav-link-mobile ${currentPage === item.id ? 'active' : ''}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </nav>
      )}
      
      {/* Content */}
      <main className={`flex-1 ${currentPage !== 'home' ? 'pt-20 pb-20' : ''}`}>
        {children}
      </main>
      
      {/* Footer - Only show on non-home pages */}
      {currentPage !== 'home' && (
        <footer className="glass-footer fixed bottom-0 left-0 right-0 z-50 px-4 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-center space-x-8">
            <a href="#" className="social-icon">
              <MessageCircle className="w-5 h-5" />
            </a>
            <a href="#" className="social-icon">
              <Instagram className="w-5 h-5" />
            </a>
            <a href="#" className="social-icon">
              <X className="w-5 h-5" />
            </a>
          </div>
        </footer>
      )}
    </div>
  );
};

export default Layout;
