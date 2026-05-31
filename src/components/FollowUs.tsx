import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import SocialMediaLinks from './ui/SocialMediaLinks';

interface FollowUsProps {
  className?: string;
}

const FollowUs: React.FC<FollowUsProps> = ({ className = '' }) => {
  const { t } = useTranslation();

  return (
    <Card className={`glass-card !bg-transparent backdrop-blur-[15px] !border-white/15 ${className}`}>
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-white">
          {t('contact.follow-us-title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-gray-300 text-sm mb-6">{t('contact.follow-us-description')}</p>
        <SocialMediaLinks />
      </CardContent>
    </Card>
  );
};

export default FollowUs;
