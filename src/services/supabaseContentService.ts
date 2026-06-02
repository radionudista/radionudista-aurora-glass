import {
  contentIndexSchema,
  contentEntrySchema,
  editorialSchema,
  type ContentIndexData,
  type EditorLanguage,
  type EditorialData,
  type ProgramEpisodesData,
} from '../editor/contracts';
import type { z } from 'zod';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabaseClient';
import type { Episode } from '../types';

export { isSupabaseConfigured };

type ContentEntry = z.infer<typeof contentEntrySchema>;

type ContentItemRow = {
  id: string;
  component: string;
  content_kind?: 'program' | 'event' | null;
  is_public: boolean;
  program_order: number | null;
  schedule: string | null;
  schedule_meta: ContentEntry['schedule_meta'] | Record<string, unknown> | null;
  talent: string[];
  social: string[];
  logo_url: string | null;
  audio_source: string | null;
  published_at: string | null;
};

type TranslationRow = {
  content_item_id: string;
  lang: EditorLanguage;
  title: string;
  slug: string;
  body: string;
  menu_label: string | null;
  menu_position: number | null;
};

type EpisodeRow = {
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

type EpisodeTranslationRow = {
  episode_id: string;
  lang: EditorLanguage;
  title: string;
  description: string;
};

type EpisodeWithTranslationsRow = EpisodeRow & {
  episode_translations: EpisodeTranslationRow[] | null;
};

export type EpisodeDateRow = {
  program_id: string;
  episode_date: string;
};

/** Fechas de episodios activos (sin papelera), para conteos en archivos. */
export const fetchActiveEpisodeDatesFromSupabase = async (): Promise<EpisodeDateRow[]> => {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('episodes')
    .select('program_id, episode_date')
    .is('deleted_at', null);

  if (error) throw new Error(error.message);
  return (data ?? []) as EpisodeDateRow[];
};

const resolveEpisodeTranslation = (
  translations: EpisodeTranslationRow[] | null | undefined,
  lang: EditorLanguage
): EpisodeTranslationRow | undefined => {
  const localized = translations ?? [];
  return (
    localized.find((entry) => entry.lang === lang) ??
    localized.find((entry) => entry.lang === 'es') ??
    localized[0]
  );
};

export const mapEpisodeRow = (
  row: EpisodeWithTranslationsRow,
  lang: EditorLanguage = 'es'
): Episode => {
  const primary = resolveEpisodeTranslation(row.episode_translations, lang);

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
};

/** Una sola query por programa (episodes + translations embebidas). */
export const fetchProgramEpisodesBundleFromSupabase = async (
  programId: string,
  lang: EditorLanguage = 'es'
): Promise<{ active: ProgramEpisodesData; trash: ProgramEpisodesData }> => {
  const supabase = getSupabaseClient();
  const empty = { programId, episodes: [] as Episode[] };
  if (!supabase) return { active: empty, trash: empty };

  const { data, error } = await supabase
    .from('episodes')
    .select('*, episode_translations(*)')
    .eq('program_id', programId)
    .order('episode_date', { ascending: true })
    .order('sort_order', { ascending: true });

  if (error) throw new Error(error.message);

  const active: Episode[] = [];
  const trash: Episode[] = [];
  for (const row of (data ?? []) as EpisodeWithTranslationsRow[]) {
    const mapped = mapEpisodeRow(row, lang);
    if (row.deleted_at) trash.push(mapped);
    else active.push(mapped);
  }

  return {
    active: { programId, episodes: active },
    trash: { programId, episodes: trash },
  };
};

const buildContentIndex = (
  items: ContentItemRow[],
  translations: TranslationRow[]
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
      content_kind: item.content_kind === 'event' ? 'event' : 'program',
      public: item.is_public,
      program_order: item.program_order ?? undefined,
      date: item.published_at ?? undefined,
      schedule: item.schedule ?? undefined,
      schedule_meta: (item.schedule_meta as ContentEntry['schedule_meta']) ?? undefined,
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

export const fetchContentIndexFromSupabase = async (): Promise<ContentIndexData | null> => {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const [{ data: items, error: itemsError }, { data: translations, error: translationsError }] =
    await Promise.all([
      supabase.from('content_items').select('*').eq('is_public', true),
      supabase.from('content_item_translations').select('*'),
    ]);

  if (itemsError) throw new Error(itemsError.message);
  if (translationsError) throw new Error(translationsError.message);
  if (!items?.length) return null;

  const visibleIds = new Set(items.map((item) => item.id));
  const visibleTranslations = (translations ?? []).filter((row) =>
    visibleIds.has(row.content_item_id)
  );

  return buildContentIndex(items as ContentItemRow[], visibleTranslations as TranslationRow[]);
};

export const fetchEditorialFromSupabase = async (): Promise<EditorialData | null> => {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase.from('site_editorial').select('payload').eq('id', 1).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.payload) return null;

  return editorialSchema.parse(data.payload);
};

export const fetchEpisodesByProgramFromSupabase = async (
  programId: string,
  lang: EditorLanguage = 'es'
): Promise<ProgramEpisodesData | null> => {
  const { active } = await fetchProgramEpisodesBundleFromSupabase(programId, lang);
  return active;
};

export const fetchEditorContentIndexFromSupabase = async (
  options?: { programId?: string }
): Promise<ContentIndexData | null> => {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  let itemsQuery = supabase.from('content_items').select('*');
  if (options?.programId) {
    itemsQuery = itemsQuery.eq('id', options.programId);
  }

  const [{ data: items, error: itemsError }, { data: translations, error: translationsError }] =
    await Promise.all([
      itemsQuery,
      supabase.from('content_item_translations').select('*'),
    ]);

  if (itemsError) throw new Error(itemsError.message);
  if (translationsError) throw new Error(translationsError.message);
  if (!items?.length) return null;

  const itemIds = new Set(items.map((item) => item.id));
  const scopedTranslations = (translations ?? []).filter((row) =>
    itemIds.has(row.content_item_id)
  );

  return buildContentIndex(items as ContentItemRow[], scopedTranslations as TranslationRow[]);
};

export const fetchTrashEpisodesByProgramFromSupabase = async (
  programId: string,
  lang: EditorLanguage = 'es'
): Promise<ProgramEpisodesData> => {
  const { trash } = await fetchProgramEpisodesBundleFromSupabase(programId, lang);
  return trash;
};
