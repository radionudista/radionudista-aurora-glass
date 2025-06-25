
import React from 'react';
import { 
  FormContainer, 
  FormField, 
  FormInput, 
  FormTextarea, 
  FormButton 
} from './ui/FormComponents';
import PageLayout from './ui/PageLayout';
import SocialMediaLinks from './ui/SocialMediaLinks';
import { CONTACT_INFORMATION } from '../constants/contactInfo';

const ContactPage = () => {
  return (
    <PageLayout 
      title="Get In Touch" 
      subtitle="We'd love to hear from you"
    >
      <div className="grid md:grid-cols-2 gap-8">
        {/* Contact Form */}
        <div className="glass-card">
          <h3 className="text-2xl font-bold text-white mb-8">Send us a Message</h3>
          <FormContainer>
            <FormField label="Name" required>
              <FormInput 
                type="text" 
                placeholder="Your name"
              />
            </FormField>
            
            <FormField label="Email" required>
              <FormInput 
                type="email" 
                placeholder="your.email@example.com"
              />
            </FormField>
            
            <FormField label="Subject" required>
              <FormInput 
                type="text" 
                placeholder="Message subject"
              />
            </FormField>
            
            <FormField label="Message" required>
              <FormTextarea 
                className="h-32"
                placeholder="Your message..."
              />
            </FormField>
            
            <FormButton type="submit" fullWidth>
              Send Message
            </FormButton>
          </FormContainer>
        </div>
        
        {/* Contact Info */}
        <div className="space-y-8">
          <div className="glass-card">
            <h3 className="text-2xl font-bold text-white mb-6">Contact Information</h3>
            <div className="space-y-6">
              {CONTACT_INFORMATION.map(({ type, label, value, href }) => (
                <div key={type}>
                  <h4 className="text-lg font-semibold text-blue-300">{label}</h4>
                  {href ? (
                    <a 
                      href={href} 
                      className="text-gray-200 hover:text-white transition-colors"
                    >
                      {value.split('\n').map((line, index) => (
                        <React.Fragment key={index}>
                          {index > 0 && <br />}
                          {line}
                        </React.Fragment>
                      ))}
                    </a>
                  ) : (
                    <p className="text-gray-200">
                      {value.split('\n').map((line, index) => (
                        <React.Fragment key={index}>
                          {index > 0 && <br />}
                          {line}
                        </React.Fragment>
                      ))}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          <div className="glass-card">
            <h3 className="text-xl font-bold text-white mb-6">Follow Us</h3>
            <SocialMediaLinks />
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default ContactPage;
