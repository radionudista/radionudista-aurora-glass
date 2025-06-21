
import React, { useState } from 'react';

interface PasswordProtectionProps {
  onCorrectPassword: () => void;
}

const PasswordProtection = ({ onCorrectPassword }: PasswordProtectionProps) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const correctPassword = 'demo2024'; // You can change this password

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === correctPassword) {
      onCorrectPassword();
    } else {
      setError('Incorrect password');
      setPassword('');
    }
  };

  return (
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
      
      {/* Overlay for better contrast */}
      <div className="fixed inset-0 bg-black/50" />
      
      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6">
        {/* Logo */}
        <div className="flex items-center space-x-3 mb-12">
          <img 
            src="/lovable-uploads/ba6f20be-002c-47a0-ab7b-2e545a599205.png" 
            alt="RadioNudista Logo" 
            className="h-12 w-auto"
          />
          <h1 className="text-4xl md:text-5xl font-bold text-white">
            radio<span className="text-purple-400">nudista</span>
          </h1>
        </div>

        {/* Password Form */}
        <div className="glass-card p-8 max-w-md w-full">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">
            Demo Site Access
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                Enter Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="glass-input w-full"
                placeholder="Password"
                required
              />
            </div>
            
            {error && (
              <div className="text-red-400 text-sm text-center">
                {error}
              </div>
            )}
            
            <button
              type="submit"
              className="glass-button w-full"
            >
              Access Demo
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PasswordProtection;
