import {
  contentIndexSchema,
  type ContentKind,
  type ContentIndexData,
  type EditorLanguage,
  type EditorialData,
  type ProgramEpisodesData,
  type ProgramEpisodesTrashData,
} from './contracts';
import { getContentKind, isArchivosProgramEntry } from './programUtils';
import { episodeSortOrderFromDate } from '../utils/episodeOrder';
import type { Episode } from '../types';

const LANGS: EditorLanguage[] = ['es', 'pt', 'en'];

export const emptyToNull = (value: unknown): string | null => {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  return String(value);
};

const pickCanonicalEntry = (locales: ContentIndexData[string]) =>
  locales.es ?? locales.pt ?? locales.en ?? null;

export type ContentItemRow = {
  id: string;
  component: string;
  content_kind: ContentKind;
  is_public: boolean;
  program_order: number | null;
  schedule: string | null;
  schedule_meta: Record<string, unknown> | null;
  talent: string[];
  social: string[];
  logo_url: string | null;
  audio_source: string | null;
  published_at: string | null;
};

export type ContentItemTranslationRow = {
  content_item_id: string;
  lang: EditorLanguage;
  title: string;
  slug: string;
  body: string;
  menu_label: string | null;
  menu_position: number | null;
};

export type EpisodeRow = {
  id: string;
  program_id: string;
  episode_date: string;
  duration: string;
  audio_url: string;
  archive_identifier: string | null;
  cover_image_url: string | null;
  collaborators: string[];
  tags: string[];
  tracklist: string[];
  sort_order: number;
  deleted_at: string | null;
};

export type EpisodeTranslationRow = {
  episode_id: string;
  lang: EditorLanguage;
  title: string;
  description: string;
};

export const contentIndexToRows = (contentIndex: ContentIndexData) => {
  const items: ContentItemRow[] = [];
  const translations: ContentItemTranslationRow[] = [];

  for (const [id, locales] of Object.entries(contentIndex)) {
    const canonical = pickCanonicalEntry(locales);
    if (!canonical) continue;

    const isProgram = canonical.component === 'ProgramPage';
    const content_kind = getContentKind(canonical);
    items.push({
      id,
      component: canonical.component,
      content_kind,
      is_public: canonical.public ?? true,
      program_order:
        isProgram && isArchivosProgramEntry(canonical) ? (canonical.program_order ?? 0) : null,
      schedule: emptyToNull(canonical.schedule),
      schedule_meta: (canonical.schedule_meta as Record<string, unknown>) ?? null,
      talent: Array.isArray(canonical.talent) ? canonical.talent : [],
      social: Array.isArray(canonical.social) ? canonical.social : [],
      logo_url: emptyToNull(canonical.logo),
      audio_source: emptyToNull(canonical.audio_source),
      published_at: emptyToNull(canonical.date),
    });

    for (const lang of LANGS) {
      const entry = locales[lang];
      if (!entry?.title) continue;
      translations.push({
        content_item_id: id,
        lang,
        title: entry.title,
        slug: entry.slug,
        body: entry.content ?? '',
        menu_label: emptyToNull(entry.menu),
        menu_position: entry.menu_position ?? null,
      });
    }
  }

  return { items, translations };
};

export const rowsToContentIndex = (
  items: ContentItemRow[],
  translations: ContentItemTranslationRow[]
): ContentIndexData => {
  const index: ContentIndexData = {};

  for (const item of items) {
    index[item.id] = {};
  }

  for (const row of translations) {
    const item = items.find((entry) => entry.id === row.content_item_id);
    if (!item) continue;

    index[item.id][row.lang] = {
      language: row.lang,
      title: row.title,
      slug: row.slug,
      id: item.id,
      component: item.component,
      content_kind: item.content_kind ?? 'program',
      public: item.is_public,
      program_order: item.program_order ?? undefined,
      date: item.published_at ?? undefined,
      schedule: item.schedule ?? undefined,
      schedule_meta: (item.schedule_meta as ContentIndexData[string]['es'] extends infer T
        ? T extends { schedule_meta?: infer S }
          ? S
          : never
        : never) ?? undefined,
      talent: item.talent,
      social: item.social,
      logo: item.logo_url ?? undefined,
      audio_source: item.audio_source ?? undefined,
      menu: row.menu_label ?? undefined,
      menu_position: row.menu_position ?? undefined,
      content: row.body,
    };
  }

  return contentIndexSchema.parse(index);
};

export const episodeToRows = (
  programId: string,
  episodes: Episode[],
  options: { deleted: boolean; sortBase?: number; translationLang?: EditorLanguage }
) => {
  const deletedAt = options.deleted ? new Date().toISOString() : null;
  const translationLang = options.translationLang ?? 'es';
  const episodeRows: EpisodeRow[] = [];
  const translationRows: EpisodeTranslationRow[] = [];

  const sortOrderById = episodeSortOrderFromDate(episodes);

  episodes.forEach((ep) => {
    if (!ep.id || !ep.title || !ep.date || !ep.audioUrl) return;
    episodeRows.push({
      id: ep.id,
      program_id: programId,
      episode_date: ep.date,
      duration: ep.duration ?? '00:00',
      audio_url: ep.audioUrl,
      archive_identifier: emptyToNull(ep.archiveIdentifier),
      cover_image_url: emptyToNull(ep.coverImage),
      collaborators: Array.isArray(ep.collaborators) ? ep.collaborators : [],
      tags: Array.isArray(ep.tags) ? ep.tags : [],
      tracklist: Array.isArray(ep.tracklist) ? ep.tracklist : [],
      sort_order: sortOrderById.get(ep.id) ?? 0,
      deleted_at: deletedAt,
    });
    translationRows.push({
      episode_id: ep.id,
      lang: translationLang,
      title: ep.title,
      description: ep.description ?? '',
    });
  });

  return { episodeRows, translationRows };
};

export const rowsToProgramEpisodes = (
  programId: string,
  episodes: EpisodeRow[],
  translations: EpisodeTranslationRow[]
): ProgramEpisodesData => {
  const translationMap = new Map<string, EpisodeTranslationRow[]>();
  for (const row of translations) {
    const list = translationMap.get(row.episode_id) ?? [];
    list.push(row);
    translationMap.set(row.episode_id, list);
  }

  const mapped: Episode[] = episodes.map((row) => {
    const localized = translationMap.get(row.id) ?? [];
    const primary = localized.find((entry) => entry.lang === 'es') ?? localized[0];
    return {
      id: row.id,
      title: primary?.title ?? row.id,
      date: row.episode_date,
      duration: row.duration,
      description: primary?.description || undefined,
      audioUrl: row.audio_url,
      archiveIdentifier: row.archive_identifier ?? undefined,
      collaborators: row.collaborators.length ? row.collaborators : undefined,
      tags: row.tags.length ? row.tags : undefined,
      tracklist: row.tracklist.length ? row.tracklist : undefined,
      coverImage: row.cover_image_url ?? undefined,
    };
  });

  return { programId, episodes: mapped };
};

export const rowsToProgramTrash = (
  programId: string,
  episodes: EpisodeRow[],
  translations: EpisodeTranslationRow[]
): ProgramEpisodesTrashData => rowsToProgramEpisodes(programId, episodes, translations);

export type SavePayload = {
  contentIndex?: ContentIndexData;
  editorial?: EditorialData;
  episodesByProgram?: Record<string, ProgramEpisodesData>;
  episodesTrashByProgram?: Record<string, ProgramEpisodesTrashData>;
  episodeTranslationLang?: EditorLanguage;
};
