import { Link, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PAGE_SCREEN_TITLE_CLASS } from '../constants/layoutConstants';

const NotFound = () => {
  const location = useLocation();
  const { t } = useTranslation();

  useEffect(() => {
    console.error(
      '404 Error: User attempted to access non-existent route:',
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className={`${PAGE_SCREEN_TITLE_CLASS} text-gray-900 mb-4`}>
          {t('errors.not-found-title')}
        </h1>
        <p className="text-xl text-gray-600 mb-4">{t('errors.not-found-message')}</p>
        <Link to="/" className="text-blue-500 hover:text-blue-700 underline">
          {t('errors.return-home')}
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
