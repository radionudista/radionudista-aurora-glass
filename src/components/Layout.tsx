import React from 'react';
import { useTranslation } from 'react-i18next';
import Navigation from './Navigation';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />

      <main className="flex-1 flex flex-col min-h-0 pt-28 md:pt-20">
        {children}
      </main>

      <footer className="relative z-20 shrink-0 bg-black w-full py-12 px-6 flex flex-col md:flex-row justify-between items-center gap-8 border-t border-white/10">
        <div className="text-lg font-bold text-white font-['Space_Grotesk'] tracking-tighter uppercase">
          {t('layout.footer-copyright')}
        </div>
        <div className="flex items-center gap-12 font-['Space_Grotesk'] text-xs uppercase tracking-widest">
          <a
            className="text-white/60 hover:text-white transition-opacity"
            href="https://www.instagram.com/radionudista"
            target="_blank"
            rel="noopener noreferrer"
          >
            Instagram
          </a>
          <a
            className="text-white/60 hover:text-white transition-opacity"
            href="https://twitter.com/radionudista"
            target="_blank"
            rel="noopener noreferrer"
          >
            X
          </a>
          <a
            href="https://www.patreon.com/profile/creators?u=170209343"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white text-black px-6 py-2 font-bold hover:invert transition-all"
          >
            {t('navigation.apoyanos')}
          </a>
        </div>
        <div className="text-[10px] text-white/55 font-['Space_Grotesk'] tracking-tighter uppercase">
          {t('layout.footer-est')}
        </div>
      </footer>
    </div>
  );
};

export default Layout;
