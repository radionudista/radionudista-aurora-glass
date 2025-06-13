
import React from 'react';
import { Instagram, X, Discord } from 'lucide-react';

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
      {/* Navbar */}
      <nav className="glass-navbar fixed top-0 left-0 right-0 z-50 px-4 py-4 md:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <img 
              src="/lovable-uploads/c3dab126-4651-4859-aaf5-c52de0155959.png" 
              alt="RadioNudista Logo" 
              className="h-8 w-auto"
            />
            <h1 className="text-xl md:text-2xl font-bold text-white">
              radio<span className="text-purple-400">nudista</span>
            </h1>
          </div>
          
          {/* Navigation Items */}
          <div className="hidden md:flex items-center space-x-8">
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
      
      {/* Content */}
      <main className="flex-1 pt-20 pb-20">
        {children}
      </main>
      
      {/* Footer */}
      <footer className="glass-footer fixed bottom-0 left-0 right-0 z-50 px-4 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-center space-x-8">
          <a href="#" className="social-icon">
            <Discord className="w-6 h-6" />
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
