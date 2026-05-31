import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Mail } from 'lucide-react';
import { CONTACT_EMAIL } from '../constants/contactInfo';

interface ContactInformationProps {
  className?: string;
}

const ContactInformation: React.FC<ContactInformationProps> = ({ className = '' }) => {
  const { t } = useTranslation();

  return (
    <Card className={`glass-card !bg-transparent backdrop-blur-[15px] !border-white/15 ${className}`}>
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-white">
          {t('contact.contact-info-title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-start space-x-4">
          <Mail className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="text-white font-semibold">{t('contact.contact-info-email')}</h4>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-gray-300 text-sm hover:text-white transition-colors"
            >
              {CONTACT_EMAIL}
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ContactInformation;
