import React, { useState, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import Logo from './Logo';
import { PatreonButton } from './ui/patreon-button';
import { env } from '../config/env';
import { useTranslation } from 'react-i18next';
import { useAudio } from '../contexts/AudioContext';
import { useNewsTicker } from '../hooks/useTextScrolling';
import { useContentIndexData } from '../hooks/useEditorContent';
import { mapRouteToContentIndexLanguage, resolveContentIndexEntry } from '../utils/contentLanguage';
import { useRouteLanguage } from '../hooks/useRouteLanguage';
import MediaButton from './ui/MediaButton';
import { useOptionalEditor } from '../contexts/EditorContext';
import { isEditorAvailable } from '../lib/supabaseClient';

interface NavigationItem {
  id: string;
  label: string;
  path: string;
}

// Helper to get current language from path (e.g. /es/slug)
function getCurrentLang(pathname: string, supportedLangs: string[]): string {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length > 0 && supportedLangs.includes(parts[0])) return parts[0];
  return supportedLangs[0]; // fallback
}

interface NavigationProps {
  navItems?: NavigationItem[];
  className?: string;
  postNavItems?: NavigationItem[];
}

/**
 * Navigation Component - Following SOLID principles
 * Single Responsibility: Handles navigation UI and mobile menu state
 * Open/Closed: Extensible through navItems prop without modification
 * Liskov Substitution: Can be replaced by any component implementing NavigationProps
 * Interface Segregation: Clean interface with only necessary props
 * Dependency Inversion: Depends on abstractions (useLocation, Link)
 */
const Navigation: React.FC<NavigationProps> = ({
  navItems = [{ id: 'home', label: 'radio', path: '/' }],
  className = '',
  postNavItems = [
    { id: 'program', label: 'archivo', path: 'programacion' },
    { id: 'schedule', label: 'programacion', path: 'schedule' },
    { id: 'about', label: 'about', path: 'about' },
    { id: 'contact', label: 'contact', path: 'contacto' },
  ],
}) => {
    const { t } = useTranslation();
  const audio = useAudio();
  const contentIndex = useContentIndexData();
  const editor = useOptionalEditor();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  // --- Dynamic nav items from Supabase content index ---
  const supportedLangs = env.SUPPORTED_LANGUAGES;
  const currentLang = getCurrentLang(location.pathname, supportedLangs);
  const routeLang = useRouteLanguage();
  const contentLang = mapRouteToContentIndexLanguage(routeLang);

  // Helper to prefix nav paths with current language
  const getNavPath = (item: NavigationItem) => {
    if (item.id === 'home') {
      return currentLang ? `/${currentLang}` : '/';
    }
    if (currentLang) {
      return `/${currentLang}/${item.path}`;
    }
    return `/${item.path}`;
  };

  // Loaded via PublicContentProvider / useContentIndexData

  const dynamicNavItems: NavigationItem[] = useMemo(() => {
    const items: NavigationItem[] = [];
    Object.entries(contentIndex).forEach(([id, langs]) => {
      const entry = resolveContentIndexEntry<Record<string, unknown>>(langs, contentLang);
      if (
        entry &&
        entry.menu &&
        (entry.public === true || entry.public === 'true')
      ) {
        items.push({
          id: `${id}-${currentLang}`,
          label: String(entry.menu),
          path: String(entry.slug)
        });
      }
    });
    // Sort by menu_position if present
    return items.sort((a, b) => {
      const idA = a.id?.split('-')[0];
      const idB = b.id?.split('-')[0];
      const posA = (resolveContentIndexEntry<Record<string, unknown>>(contentIndex?.[idA], contentLang)?.menu_position as number | undefined) ?? 9999;
      const posB = (resolveContentIndexEntry<Record<string, unknown>>(contentIndex?.[idB], contentLang)?.menu_position as number | undefined) ?? 9999;
      return posA - posB;
    });
  }, [contentIndex, contentLang, currentLang]);

  // Translate static navItems labels using full key path (e.g., navigation.radio)
  const translatedNavItems = navItems.map(item => ({
    ...item,
    label: t(`navigation.${item.label}`)
  }));
  const translatedPostNavItems = postNavItems.map(item => ({
    ...item,
    label: t(`navigation.${item.label}`)
  }));
  // Orden: Radio → Archivos → Schedule → Nosotrxs, luego entradas extra del índice
  const mergedNavItems = [...translatedNavItems, ...translatedPostNavItems, ...dynamicNavItems];
  const primaryNavItems = mergedNavItems.filter(
    (item) =>
      item.id === 'home' ||
      item.id === 'about' ||
      item.id === 'contact' ||
      item.id === 'program' ||
      item.id === 'schedule'
  );
  const liveText = audio.currentTrack || t('navigation.transmitting');
  const { containerRef, textRef } = useNewsTicker({
    text: liveText,
    isActive: true,
    speed: 35,
  });
  const { containerRef: mobileContainerRef, textRef: mobileTextRef } = useNewsTicker({
    text: liveText,
    isActive: true,
    speed: 35,
  });

  const handleMobileNavClick = () => {
    setIsMobileMenuOpen(false);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const showEditorLogin =
    isEditorAvailable() && !editor?.enabled && location.pathname !== '/editor-login';

  const openMobileMenu = () => {
    setIsMobileMenuOpen(true);
  };

  const playButton = (
    <MediaButton
      isPlaying={audio.isPlaying}
      isLoading={audio.isLoading}
      onClick={audio.togglePlay}
      size="small"
      className="w-8 h-8 shrink-0 border border-white/20 text-white hover:border-white/50"
    />
  );

  return (
    <>
      {/* Main Navigation Bar: [ logo · reproductor ] | [ nav links ] */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-xl border-b border-white/10 flex items-center justify-between px-4 sm:px-6 h-20 w-full gap-3 sm:gap-4 ${className}`}
      >
        {/* Izquierda: solo logo */}
        <div className="flex shrink-0 items-center min-w-0">
          <Logo size="medium" className="scale-110 origin-left" />
        </div>

        {/* Centro: reproductor (desktop) — queda entre logo y enlaces */}
        <div className="hidden md:flex flex-1 items-center justify-center gap-3 min-w-0 max-w-[min(100%,480px)] px-2 mx-2">
          {playButton}
          <span className="font-['Space_Grotesk'] text-sm tracking-[0.16em] text-white/70 uppercase whitespace-nowrap shrink-0">
            LIVE:
          </span>
          <div
            ref={containerRef}
            className="relative min-w-0 flex-1 overflow-hidden h-5 max-w-[320px] lg:max-w-[380px]"
            aria-live="polite"
          >
            <span
              ref={textRef}
              className="absolute left-0 top-0 font-['Space_Grotesk'] text-sm tracking-[0.12em] text-white/70 uppercase whitespace-nowrap"
            >
              {liveText}
            </span>
          </div>
        </div>

        {/* Derecha: enlaces (desktop) */}
        <div className="hidden md:flex shrink-0 items-center justify-end gap-6 lg:gap-8 font-['Space_Grotesk'] tracking-tighter uppercase text-[17px] min-w-0">
          {primaryNavItems.map((item) => {
            const navPath = getNavPath(item);
            const isActive = location.pathname === navPath;
            return (
              <Link
                key={item.id}
                to={navPath}
                className={
                  isActive
                    ? 'text-white font-bold border-b-2 border-white pb-1 shrink-0'
                    : 'text-white/60 hover:text-white transition-colors shrink-0'
                }
                aria-current={isActive ? 'page' : undefined}
              >
                {item.label}
              </Link>
            );
          })}
          {showEditorLogin && (
            <Link
              to="/editor-login"
              className="shrink-0 border border-white/30 px-2.5 py-1 text-[10px] uppercase tracking-widest text-white/70 transition hover:border-white hover:text-white"
            >
              {t('navigation.login')}
            </Link>
          )}
          {editor?.enabled && (
            <div className="flex shrink-0 items-center gap-3">
              {editor.message ? (
                <p
                  className="hidden max-w-[14rem] truncate text-[10px] leading-snug text-lime-300/80 xl:block"
                  title={editor.message}
                >
                  {editor.message}
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => { void editor.logout(); }}
                className="shrink-0 border border-red-400/40 bg-transparent px-2.5 py-1 text-[10px] uppercase tracking-widest text-red-400/70 transition hover:border-red-400/70 hover:text-red-400"
                title={t('navigation.logout-editor')}
              >
                {t('navigation.logout-editor')}
              </button>
            </div>
          )}
        </div>

        {/* Móvil: play compacto + menú */}
        <div className="flex md:hidden items-center gap-2 shrink-0">
          {playButton}
          <button
            type="button"
            className="text-white p-1"
            onClick={openMobileMenu}
            aria-label="Open navigation menu"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </nav>
      <div className="fixed top-20 left-0 right-0 z-40 flex h-8 items-center gap-2 border-b border-white/10 bg-black/95 px-4 md:hidden">
        <span className="font-['Space_Grotesk'] text-[10px] tracking-[0.18em] text-white/55 uppercase shrink-0">
          Live:
        </span>
        <div
          ref={mobileContainerRef}
          className="relative min-w-0 flex-1 overflow-hidden h-4"
          aria-live="polite"
        >
          <span
            ref={mobileTextRef}
            className="absolute left-0 top-0 font-['Space_Grotesk'] text-xs tracking-[0.12em] text-white/70 uppercase whitespace-nowrap"
          >
            {liveText}
          </span>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[9999] md:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-hidden />
          {/* Mobile Menu Panel - Updated visual style */}
          <div
            className={`absolute top-0 left-0 right-0 bottom-16 border-b border-white/10 bg-[#0a0a0b]/95 backdrop-blur-xl transform transition-transform duration-300 ease-out ${
              isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
            }`}
            role="navigation"
            aria-label="Mobile navigation menu"
          >
            {/* Close Button - Positioned at top right */}
            <header className="flex items-center justify-between border-b border-white/10 px-6 py-5">
              <span className="font-['Space_Grotesk'] text-[10px] uppercase tracking-[0.18em] text-white/45">
                Menu
              </span>
              <button
                onClick={closeMobileMenu}
                className="inline-flex h-9 w-9 items-center justify-center border border-white/20 text-white/80 transition hover:border-white/45 hover:text-white"
                aria-label="Close navigation menu"
              >
                <X className="w-6 h-6" />
              </button>
            </header>

            {/* Mobile Navigation Links - Positioned at top */}
            <div className="px-6 py-6 space-y-3">
              {mergedNavItems.map((item) => {
                const navPath = getNavPath(item);
                const isActive = location.pathname === navPath;
                return (
                  <Link
                    key={item.id}
                    to={navPath}
                    onClick={handleMobileNavClick}
                    className={`block w-full border px-4 py-4 text-center font-['Space_Grotesk'] text-[15px] uppercase tracking-[0.14em] transition-all duration-200 ${
                      isActive
                        ? 'border-white bg-white text-black'
                        : 'border-white/15 bg-white/[0.02] text-white/75 hover:border-white/40 hover:text-white'
                    }`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {item.label}
                  </Link>
                );
              })}

              {(showEditorLogin || editor?.enabled) && (
                <div className="space-y-3 border-t border-white/10 pt-4">
                  {showEditorLogin && (
                    <Link
                      to="/editor-login"
                      onClick={handleMobileNavClick}
                      className="block w-full border border-white/30 bg-white/[0.02] px-4 py-4 text-center font-['Space_Grotesk'] text-[15px] uppercase tracking-[0.14em] text-white/75 transition hover:border-white hover:text-white"
                    >
                      {t('navigation.login')}
                    </Link>
                  )}
                  {editor?.enabled && (
                    <button
                      type="button"
                      onClick={() => { handleMobileNavClick(); void editor.logout(); }}
                      className="block w-full border border-red-400/40 bg-white/[0.02] px-4 py-4 text-center font-['Space_Grotesk'] text-[15px] uppercase tracking-[0.14em] text-red-400/70 transition hover:border-red-400/70 hover:text-red-400"
                    >
                      {t('navigation.logout-editor')}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* PatreonButton positioned at bottom of mobile menu panel */}
            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 border-t border-white/10 pt-5">
              <PatreonButton absolute={false} className="relative" />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Navigation;
