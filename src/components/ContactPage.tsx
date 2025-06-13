
import React from 'react';

const ContactPage = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="glass-container max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Get In <span className="text-blue-300">Touch</span>
          </h2>
          <p className="text-xl text-gray-200">
            We'd love to hear from you
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 gap-8">
          {/* Contact Form */}
          <div className="glass-card">
            <h3 className="text-2xl font-bold text-white mb-6">Send us a Message</h3>
            <form className="space-y-4">
              <div>
                <label className="block text-gray-200 mb-2">Name</label>
                <input 
                  type="text" 
                  className="glass-input w-full"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="block text-gray-200 mb-2">Email</label>
                <input 
                  type="email" 
                  className="glass-input w-full"
                  placeholder="your.email@example.com"
                />
              </div>
              <div>
                <label className="block text-gray-200 mb-2">Subject</label>
                <input 
                  type="text" 
                  className="glass-input w-full"
                  placeholder="Message subject"
                />
              </div>
              <div>
                <label className="block text-gray-200 mb-2">Message</label>
                <textarea 
                  className="glass-input w-full h-32 resize-none"
                  placeholder="Your message..."
                ></textarea>
              </div>
              <button type="submit" className="glass-button w-full">
                Send Message
              </button>
            </form>
          </div>
          
          {/* Contact Info */}
          <div className="space-y-6">
            <div className="glass-card">
              <h3 className="text-2xl font-bold text-white mb-4">Contact Information</h3>
              <div className="space-y-4">
                <div>
                  <h4 className="text-lg font-semibold text-blue-300">Email</h4>
                  <p className="text-gray-200">contact@radionudista.com</p>
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-blue-300">Phone</h4>
                  <p className="text-gray-200">+1 (555) 123-4567</p>
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-blue-300">Address</h4>
                  <p className="text-gray-200">
                    123 Music Street<br />
                    Radio City, RC 12345
                  </p>
                </div>
              </div>
            </div>
            
            <div className="glass-card">
              <h3 className="text-xl font-bold text-white mb-4">Follow Us</h3>
              <div className="flex space-x-4">
                <a href="#" className="social-icon-large">
                  <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-bold">D</span>
                  </div>
                </a>
                <a href="#" className="social-icon-large">
                  <Instagram className="w-8 h-8" />
                </a>
                <a href="#" className="social-icon-large">
                  <X className="w-8 h-8" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;
