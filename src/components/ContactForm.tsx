import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { useTranslation } from '../hooks/useTranslation';
import { CONTACT_INFORMATION } from '../constants/contactInfo';

interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

interface ContactFormProps {
  onSubmit?: (data: ContactFormData) => void;
  className?: string;
}

type MailProvider = 'system' | 'gmail' | 'outlook';

/**
 * ContactForm Component
 *
 * Follows Single Responsibility Principle:
 * - Only responsible for handling contact form interactions
 *
 * Follows Open/Closed Principle:
 * - Open for extension through props and callbacks
 * - Closed for modification of core form functionality
 */
const ContactForm: React.FC<ContactFormProps> = ({
  onSubmit,
  className = ''
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<ContactFormData>({
    name: '',
    email: '',
    subject: '',
    message: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const recipientEmail = CONTACT_INFORMATION.find((item) => item.type === 'email')?.value ?? 'contact@radionudista.com';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const openComposer = (provider: MailProvider, data: ContactFormData) => {
    const subject = encodeURIComponent(data.subject.trim());
    const body = encodeURIComponent(
      `Nombre: ${data.name.trim()}\nEmail: ${data.email.trim()}\n\nMensaje:\n${data.message.trim()}`
    );
    const to = encodeURIComponent(recipientEmail);

    const urls: Record<MailProvider, string> = {
      system: `mailto:${recipientEmail}?subject=${subject}&body=${body}`,
      gmail: `https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${subject}&body=${body}`,
      outlook: `https://outlook.office.com/mail/deeplink/compose?to=${to}&subject=${subject}&body=${body}`,
    };

    const targetUrl = urls[provider];
    if (provider === 'system') {
      window.location.href = targetUrl;
      return;
    }

    const popup = window.open(targetUrl, '_blank', 'noopener,noreferrer');
    if (!popup) {
      window.location.href = targetUrl;
    }
  };

  const handleSubmit = async (provider: MailProvider, e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (onSubmit) {
        await onSubmit(formData);
      }
      openComposer(provider, formData);
      // Reset form on successful submission
      setFormData({
        name: '',
        email: '',
        subject: '',
        message: ''
      });
    } catch (error) {
      console.error('Form submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className={`glass-card !bg-transparent backdrop-blur-[15px] !border-white/15 ${className}`}>
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-white">
          {t('contact.form-title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {t('contact.form-name-label')} *
            </label>
            <Input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder={t('contact.form-name-placeholder')}
              required
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {t('contact.form-email-label')} *
            </label>
            <Input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder={t('contact.form-email-placeholder')}
              required
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {t('contact.form-subject-label')} *
            </label>
            <Input
              type="text"
              name="subject"
              value={formData.subject}
              onChange={handleChange}
              placeholder={t('contact.form-subject-placeholder')}
              required
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {t('contact.form-message-label')} *
            </label>
            <Textarea
              name="message"
              value={formData.message}
              onChange={handleChange}
              placeholder={t('contact.form-message-placeholder')}
              required
              rows={6}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {t('contact.form-provider-label')}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Button
                type="submit"
                onClick={(event) => void handleSubmit('gmail', event)}
                disabled={isSubmitting}
                className="border border-white/25 bg-transparent text-white/90 hover:border-white hover:bg-white hover:text-black text-xs uppercase tracking-widest"
              >
                {isSubmitting ? t('contact.form-submitting') : t('contact.form-provider-gmail')}
              </Button>
              <Button
                type="submit"
                onClick={(event) => void handleSubmit('outlook', event)}
                disabled={isSubmitting}
                className="border border-white/25 bg-transparent text-white/90 hover:border-white hover:bg-white hover:text-black text-xs uppercase tracking-widest"
              >
                {isSubmitting ? t('contact.form-submitting') : t('contact.form-provider-outlook')}
              </Button>
              <Button
                type="submit"
                onClick={(event) => void handleSubmit('system', event)}
                disabled={isSubmitting}
                className="border border-white/25 bg-transparent text-white/90 hover:border-white hover:bg-white hover:text-black text-xs uppercase tracking-widest"
              >
                {isSubmitting ? t('contact.form-submitting') : t('contact.form-provider-system')}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default ContactForm;
