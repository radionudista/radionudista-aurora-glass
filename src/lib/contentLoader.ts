import type { ContentIndexData } from '../editor/contracts';

type ContentMeta = Record<string, unknown> & {
  slug: string;
  title?: string;
  content?: string;
};

type ContentMap = Record<string, Record<string, ContentMeta & { markdown: string }>>;

let contentMap: ContentMap = {};

const buildContentMap = (index: ContentIndexData): ContentMap => {
  const map: ContentMap = {};

  for (const langs of Object.values(index)) {
    for (const [lang, meta] of Object.entries(langs)) {
      if (!meta?.slug) continue;
      if (!map[lang]) map[lang] = {};
      const body = typeof meta.content === 'string' ? meta.content : '';
      map[lang][meta.slug] = { ...meta, markdown: body };
    }
  }

  return map;
};

export const setContentIndexCache = (index: ContentIndexData): void => {
  contentMap = buildContentMap(index);
};

export function getContent(lang: string, slug: string) {
  if (contentMap[lang]?.[slug]) return contentMap[lang][slug];
  if (lang === 'en') return contentMap.es?.[slug] || null;
  return null;
}

export function getAllSlugs(lang: string): string[] {
  return Object.keys(contentMap[lang] || {});
}
