import type { Episode } from '../types';

const parseEpisodeDate = (date: string): number =>
  new Date(`${date.trim()}T12:00:00`).getTime();

export const isValidEpisodeDateIso = (value: string): boolean => {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return false;
  return !Number.isNaN(parseEpisodeDate(trimmed));
};

/** Más antiguo primero (episodio 1 = el de fecha más vieja). */
export const sortEpisodesChronologicallyAsc = (episodes: Episode[]): Episode[] =>
  [...episodes].sort((a, b) => {
    const diff = parseEpisodeDate(a.date) - parseEpisodeDate(b.date);
    if (diff !== 0) return diff;
    return a.id.localeCompare(b.id);
  });

/** Más reciente primero (listados de archivo). */
export const sortEpisodesChronologicallyDesc = (episodes: Episode[]): Episode[] =>
  [...sortEpisodesChronologicallyAsc(episodes)].reverse();

export const getEpisodeChronologicalSlot = (
  episode: Episode,
  episodes: Episode[]
): { n: number; total: number } | null => {
  const sorted = sortEpisodesChronologicallyAsc(episodes);
  const idx = sorted.findIndex((item) => item.id === episode.id);
  if (idx < 0) return null;
  return { n: idx + 1, total: sorted.length };
};

export const episodeSortOrderFromDate = (episodes: Episode[]): Map<string, number> => {
  const sorted = sortEpisodesChronologicallyAsc(episodes);
  return new Map(sorted.map((ep, index) => [ep.id, index]));
};
