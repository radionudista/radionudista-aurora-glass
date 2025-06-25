
import React, { useState } from 'react';
import BackgroundVideo from './BackgroundVideo';
import Logo from './Logo';
import { FormContainer, FormField, FormInput, FormButton } from './ui/FormComponents';

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
      <BackgroundVideo overlayOpacity={0.5} />
      
      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6">
        {/* Logo */}
        <Logo size="large" className="mb-12" />

        {/* Password Form */}
        <div className="glass-card p-8 max-w-md w-full">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">
            Demo Site Access
          </h2>
          
          <FormContainer onSubmit={handleSubmit}>
            <FormField 
              label="Enter Password" 
              error={error}
              required
            >
              <FormInput
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                error={!!error}
              />
            </FormField>
            
            <FormButton type="submit" fullWidth>
              Access Demo
            </FormButton>
          </FormContainer>
        </div>
      </div>
    </div>
  );
};

export default PasswordProtection;
