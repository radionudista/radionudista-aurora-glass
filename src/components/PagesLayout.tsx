import React, { useEffect, useLayoutEffect } from 'react';
import { Outlet, useLocation, useNavigationType } from 'react-router-dom';
import Layout from './Layout';
import { AudioProvider } from '../contexts/AudioContext';
import { ArchivePlayerProvider } from '../contexts/ArchivePlayerContext';

function scrollDocumentToTop() {
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

const PagesLayout = () => {
  const location = useLocation();
  const navigationType = useNavigationType();

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
    <AudioProvider>
      <ArchivePlayerProvider>
        <div className="min-h-screen w-full relative bg-black">
          <div className="relative z-10 min-h-screen flex flex-col">
            <Layout>
              <Outlet />
            </Layout>
          </div>
        </div>
      </ArchivePlayerProvider>
    </AudioProvider>
  );
};

export default PagesLayout;
