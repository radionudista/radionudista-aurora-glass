import type { EditorLanguage } from '../editor/contracts';

export type LocalizedTextField = Partial<Record<EditorLanguage, string>> | null | undefined;

/**
 * Resolves editorial copy for the active route language.
 * Spanish is the default when en/pt have no saved translation.
 */
export const resolveEditorialText = (
  field: LocalizedTextField,
  lang: EditorLanguage
): string => {
  if (!field) return '';
  const es = (field.es ?? '').trim();
  if (lang === 'es') return es;
  const localized = (field[lang] ?? '').trim();
  return localized || es;
};

/**
 * Builds draft values for the editor without copying es into empty en/pt slots.
 */
export const buildLocalizedDraft = (
  field: LocalizedTextField,
  fallback = ''
): Record<EditorLanguage, string> => ({
  es: field?.es ?? fallback,
  en: field?.en ?? '',
  pt: field?.pt ?? '',
});
