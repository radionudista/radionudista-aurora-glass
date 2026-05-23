import React, { useEffect, useLayoutEffect } from 'react';
import { Outlet, useLocation, useNavigationType } from 'react-router-dom';
import Layout from './Layout';
import BackgroundVideo from './BackgroundVideo';
import { AudioProvider } from '../contexts/AudioContext';
import { env } from '../config/env';
import { EditorProvider } from '../contexts/EditorContext';
import { ArchivePlayerProvider } from '../contexts/ArchivePlayerContext';

function scrollDocumentToTop() {
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

const PagesLayout = () => {
  const location = useLocation();
  const navigationType = useNavigationType();
  const path = location.pathname.replace(/\/+$/, '');
  const isHomeRoute = env.SUPPORTED_LANGUAGES.some((lang) => path === `/${lang}`);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  useLayoutEffect(() => {
    if (navigationType === 'POP') return;
    scrollDocumentToTop();
  }, [location.pathname, navigationType]);

  return (
    <EditorProvider>
      <AudioProvider>
        <ArchivePlayerProvider>
          <div className="min-h-screen w-full overflow-hidden relative">
            {!isHomeRoute && <BackgroundVideo />}

            {/* Main Content */}
            <div className="relative z-10 min-h-screen flex flex-col">
              <Layout>
                <Outlet />
              </Layout>
            </div>
          </div>
        </ArchivePlayerProvider>
      </AudioProvider>
    </EditorProvider>
  );
};

export default PagesLayout;
