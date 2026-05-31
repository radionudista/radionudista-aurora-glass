import type { EditorLanguage } from '../editor/contracts';
import type { IEpisodeService, Episode, ProgramEpisodes } from '../types';

import {
  fetchActiveEpisodeDatesFromSupabase,
  fetchEpisodesByProgramFromSupabase,
  isSupabaseConfigured,
} from './supabaseContentService';



const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;



export class EpisodeService implements IEpisodeService {

  public async getEpisodesByProgram(
    programId: string,
    lang: EditorLanguage = 'es'
  ): Promise<ProgramEpisodes> {

    const safeProgramId = programId.trim();

    if (!SLUG_RE.test(safeProgramId)) {

      console.warn(`[episodeService] Invalid program id "${programId}".`);

      return { programId: '', episodes: [] };

    }



    if (!isSupabaseConfigured()) {

      console.warn('[episodeService] Supabase no configurado.');

      return { programId: safeProgramId, episodes: [] };

    }



    try {

      const fromSupabase = await fetchEpisodesByProgramFromSupabase(safeProgramId, lang);

      return fromSupabase ?? { programId: safeProgramId, episodes: [] };

    } catch (error) {

      console.error(`[episodeService] Error loading "${safeProgramId}" episodes:`, error);

      return { programId: safeProgramId, episodes: [] };

    }

  }



  public async getActiveEpisodeDatesByProgram(): Promise<

    Awaited<ReturnType<typeof fetchActiveEpisodeDatesFromSupabase>>

  > {

    if (!isSupabaseConfigured()) {

      console.warn('[episodeService] Supabase no configurado.');

      return [];

    }



    try {

      return await fetchActiveEpisodeDatesFromSupabase();

    } catch (error) {

      console.error('[episodeService] Error loading episode dates:', error);

      return [];

    }

  }

}



export const episodeService = new EpisodeService();

