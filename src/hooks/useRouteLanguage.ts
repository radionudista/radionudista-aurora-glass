import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { env } from '../config/env';
import { LanguageUtils } from './useTranslation';
import type { EditorLanguage } from '../editor/contracts';

/**
 * Route language from URL path (/{lang}/...), with i18n as fallback.
 */
export const useRouteLanguage = (): EditorLanguage => {
  const { pathname } = useLocation();
  const { i18n } = useTranslation();

  const segment = pathname.split('/').filter(Boolean)[0];
  if (segment && env.SUPPORTED_LANGUAGES.includes(segment)) {
    return LanguageUtils.mapToSupportedLanguage(
      segment,
      env.SUPPORTED_LANGUAGES,
      env.DEFAULT_LANGUAGE
    ) as EditorLanguage;
  }

  return LanguageUtils.mapToSupportedLanguage(
    i18n.language,
    env.SUPPORTED_LANGUAGES,
    env.DEFAULT_LANGUAGE
  ) as EditorLanguage;
};
