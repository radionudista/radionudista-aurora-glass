import type { EditorLanguage } from '../editor/contracts';

export type LocalizedContentRecord = Partial<
  Record<EditorLanguage, Record<string, unknown>>
>;

/** Markdown folders exist only for es/pt (no src/content/en). */
export const mapUiLanguageToContentLanguage = (lang: string): 'es' | 'pt' => {
  if (lang === 'pt') return 'pt';
  return 'es';
};

/** Route language for contentIndex lookups (includes editor-only en entries). */
export const mapRouteToContentIndexLanguage = (lang: string): EditorLanguage => {
  if (lang === 'pt') return 'pt';
  if (lang === 'en') return 'en';
  return 'es';
};

export const resolveContentIndexEntry = <T extends Record<string, unknown>>(
  localized: LocalizedContentRecord | undefined,
  lang: EditorLanguage
): T | undefined => {
  if (!localized) return undefined;
  const preferred = localized[lang] as T | undefined;
  if (preferred) return preferred;
  return localized.es as T | undefined;
};

/** String field with Spanish fallback when en/pt are empty. */
export const resolveContentIndexString = (
  localized: LocalizedContentRecord | undefined,
  lang: EditorLanguage,
  field: string
): string => {
  const preferred = localized?.[lang]?.[field];
  if (typeof preferred === 'string' && preferred.trim()) return preferred;
  const fallback = localized?.es?.[field];
  return typeof fallback === 'string' ? fallback : '';
};
