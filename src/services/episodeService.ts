import { IEpisodeService, Episode, ProgramEpisodes } from '../types';

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string');

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const isEpisode = (value: unknown): value is Episode => {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Partial<Episode>;
  return (
    isNonEmptyString(candidate.id) &&
    isNonEmptyString(candidate.title) &&
    isNonEmptyString(candidate.date) &&
    /^\d{4}-\d{2}-\d{2}$/.test(candidate.date) &&
    isNonEmptyString(candidate.duration) &&
    isNonEmptyString(candidate.audioUrl) &&
       (candidate.description === undefined || typeof candidate.description === 'string') &&
    (candidate.archiveIdentifier === undefined || typeof candidate.archiveIdentifier === 'string') &&
    (candidate.collaborators === undefined || isStringArray(candidate.collaborators)) &&
    (candidate.tags === undefined || isStringArray(candidate.tags)) &&
    (candidate.tracklist === undefined || isStringArray(candidate.tracklist)) &&
    (candidate.coverImage === undefined || typeof candidate.coverImage === 'string')
  );
};

const isProgramEpisodes = (value: unknown): value is ProgramEpisodes => {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Partial<ProgramEpisodes>;
  return (
    isNonEmptyString(candidate.programId) &&
    Array.isArray(candidate.episodes) &&
    candidate.episodes.every(isEpisode)
  );
};

export class EpisodeService implements IEpisodeService {
  public async getEpisodesByProgram(programId: string): Promise<ProgramEpisodes> {
    const safeProgramId = programId.trim();
    if (!SLUG_RE.test(safeProgramId)) {
      console.warn(`[episodeService] Invalid program id "${programId}".`);
      return { programId: '', episodes: [] };
    }

    try {
      const response = await fetch(`/episodes/${safeProgramId}.json`);

      // Program has no published archive yet: return safe fallback
      if (response.status === 404) {
        return { programId: safeProgramId, episodes: [] };
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch episodes (${response.status} ${response.statusText})`);
      }

      const payload: unknown = await response.json();

      if (!isProgramEpisodes(payload)) {
        console.warn(`[episodeService] Invalid episodes payload for "${safeProgramId}".`);
        return { programId: safeProgramId, episodes: [] };
      }

      return payload;
    } catch (error) {
      console.error(`[episodeService] Error loading "${safeProgramId}" episodes:`, error);
      return { programId: safeProgramId, episodes: [] };
    }
  }
}

export const episodeService = new EpisodeService();
