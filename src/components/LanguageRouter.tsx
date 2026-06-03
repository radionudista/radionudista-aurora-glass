import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation, useParams } from 'react-router-dom';
import { useTranslation, LanguageUtils } from '../hooks/useTranslation';
import { env } from '../config/env';
import i18n from '../config/i18n';

// Import pages
import PagesLayout from '../components/PagesLayout';
import HomePage from '../pages/HomePage';
import AboutPage from '../pages/AboutPage';
import NotFound from '../pages/NotFound';
import SimplePage from '../pages/SimplePage';
import { getContent, setContentIndexCache } from '../lib/contentLoader';
import { usePublicContent } from '../contexts/PublicContentContext';
import ProgramPage from '@/pages/ProgramPage';
import TwitchOnlyPlayerPage from '@/pages/TwitchOnlyPlayerPage';
import SchedulePage from '../pages/SchedulePage';
import ProgramDetailPage from '../pages/ProgramDetailPage';
import EpisodeDetailPage from '../pages/EpisodeDetailPage';
import EditorLoginPage from '../pages/EditorLoginPage';
import AdminUsersPage from '../pages/AdminUsersPage';
import EditorProgramActivityPage from '../pages/EditorProgramActivityPage';
import ContactPage from '../pages/ContactPage';
import { EditorProvider } from '../contexts/EditorContext';

/**
 * Language Router Component
 *
 * Follows Single Responsibility Principle:
 * - Only responsible for language-based routing
 *
 * Follows Open/Closed Principle:
 * - Open for extension through new routes
 * - Closed for modification of core routing logic
 *
 * Features:
 * - Automatic browser language detection
 * - Subdirectory-based language routing (/{lang} — es, en, pt)
 * - Fallback to default language
 * - SEO-friendly URL structure
 */

const LanguageDetector: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isI18nReady, setIsI18nReady] = useState(false);

  // Wait for i18n to be ready
  useEffect(() => {
    const checkI18nReady = () => {
      if (i18n.isInitialized && typeof i18n.changeLanguage === 'function') {
        setIsI18nReady(true);
      } else {
        // Retry after a short delay
        setTimeout(checkI18nReady, 100);
      }
    };

    checkI18nReady();
  }, []);

  useEffect(() => {
    if (!isI18nReady) return;

    const currentPath = location.pathname;
    if (
      currentPath === '/editor-login' ||
      currentPath === '/editor_login' ||
      currentPath.startsWith('/admin/')
    ) {
      return;
    }

    const pathSegments = currentPath.split('/').filter(Boolean);
    const firstSegment = pathSegments[0];
    const remainder = pathSegments.slice(1).join('/');

    // Check if the first segment is a language code
    const isLanguageInPath = firstSegment && env.SUPPORTED_LANGUAGES.includes(firstSegment);
    const looksLikeLanguageCode = Boolean(firstSegment && /^[a-z]{2}$/i.test(firstSegment));

    if (isLanguageInPath) {
      // Language is already in the path, set it in i18n
      if (i18n.language !== firstSegment) {
        i18n.changeLanguage(firstSegment);
      }
    } else if (looksLikeLanguageCode) {
      // e.g. /en/schedule while VITE_SUPPORTED_LANGUAGES=es,pt — remap to a supported lang
      const targetLang = LanguageUtils.mapToSupportedLanguage(
        firstSegment,
        env.SUPPORTED_LANGUAGES,
        env.DEFAULT_LANGUAGE
      );
      navigate(`/${targetLang}${remainder ? `/${remainder}` : ''}`, { replace: true });
    } else {
      // No language in path, detect and redirect
      const browserLang = LanguageUtils.getBrowserPreferredLanguage();
      const targetLang = browserLang !== env.DEFAULT_LANGUAGE ? browserLang : env.DEFAULT_LANGUAGE;

      if (targetLang !== env.DEFAULT_LANGUAGE) {
        // Redirect to language-specific path
        navigate(`/${targetLang}${currentPath}`, { replace: true });
      } else {
        // Set default language without redirect
        i18n.changeLanguage(env.DEFAULT_LANGUAGE);
      }
    }
  }, [location.pathname, navigate, isI18nReady]);

  // Show loading state while i18n initializes
  if (!isI18nReady) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-black">
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  return <>{children}</>;
};


const AppRoutes: React.FC = () => {
  const { contentIndex } = usePublicContent();

  React.useEffect(() => {
    setContentIndexCache(contentIndex);
  }, [contentIndex]);

  return (
    <Routes>
      {/* Redirect root / to detected language path */}
      <Route path="/" element={<RedirectToLang />} />


      {/* Routes for all supported languages at /{lang} */}
      {env.SUPPORTED_LANGUAGES.map(lang => (
        <Route key={lang} path={`/${lang}`} element={<PagesLayout />}>
          <Route index element={<HomePage />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="contacto" element={<ContactPage />} />
          <Route path="contact" element={<Navigate to="contacto" replace />} />
          <Route path="programacion" element={<ProgramPage />} />
          <Route path="programacion/:programId/:episodeId" element={<EpisodeDetailPage />} />
          <Route path="programacion/:programId/actividad" element={<EditorProgramActivityPage />} />
          <Route path="programacion/:programId" element={<ProgramDetailPage />} />
          <Route path="schedule" element={<SchedulePage />} />
          {/* Dynamic content pages: /{lang}/{slug} */}
          <Route path=":slug" element={<DynamicSimplePageWrapper lang={lang} />} />
        </Route>
      ))}
      {/* Editor login (misma ruta en local y prod) */}
      <Route path="/editor-login" element={<EditorLoginPage />} />
      <Route path="/editor_login" element={<Navigate to="/editor-login" replace />} />
      <Route path="/admin/usuarios" element={<PagesLayout />}>
        <Route index element={<AdminUsersPage />} />
      </Route>

      {/* Catch-all route for 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

// Wrapper to load content and render SimplePage for dynamic routes
function DynamicSimplePageWrapper({ lang }: { lang: string }) {
  const { slug } = useParams();
  if (!slug) return <NotFound />;
  if (slug === 'acerca-de-nosotros') {
    return <Navigate to={`/${lang}/about`} replace />;
  }
  const content = getContent(lang, slug);
  if (!content) return <NotFound />;
  return (
    <SimplePage
      title={content.title}
      markdown={content.markdown}
      meta={content}
    />
  );
}



// Redirects / to /{lang} based on browser or default
const RedirectToLang: React.FC = () => {
  const navigate = useNavigate();
  useEffect(() => {
    const browserLang = LanguageUtils.getBrowserPreferredLanguage();
    const targetLang = env.SUPPORTED_LANGUAGES.includes(browserLang)
      ? browserLang
      : env.DEFAULT_LANGUAGE;
    navigate(`/${targetLang}`, { replace: true });
  }, [navigate]);
  return null;
};

const LanguageRouter: React.FC = () => {
  return (
    <BrowserRouter>
      <EditorProvider>
        <LanguageDetector>
          <AppRoutes />
        </LanguageDetector>
      </EditorProvider>
    </BrowserRouter>
  );
};

export default LanguageRouter;
