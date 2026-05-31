import { prepareEpisodeAudioForUpload } from '../utils/prepareEpisodeAudio';
import { devEditorService } from './devEditorService';

const isArchiveOrgAudioUrl = (url: string): boolean => /archive\.org/i.test(url);

/**
 * Convierte a MP3 y sube el audio a Archive.org vía el servidor del editor.
 * Título, descripción y tags solo se guardan en Supabase (addEpisode), no en IA.
 */
export const uploadEpisodeAudioDirectToArchive = async (input: {
  programId: string;
  episodeId: string;
  date?: string;
  file: File;
  onStatus?: (message: string) => void;
}): Promise<{
  audioUrl: string;
  identifier: string;
  itemUrl?: string;
  message: string;
}> => {
  input.onStatus?.('Preparando MP3...');
  const mp3File = await prepareEpisodeAudioForUpload(input.file, input.onStatus);
  const fileName = mp3File.name.endsWith('.mp3') ? mp3File.name : `${input.episodeId}.mp3`;

  input.onStatus?.('Subiendo a Archive.org...');
  const result = await devEditorService.uploadEpisodeAudioProxy(
    {
      programId: input.programId,
      episodeId: input.episodeId,
      date: input.date,
      fileName,
    },
    mp3File
  );

  if (!result.ok || !result.audioUrl || !result.identifier) {
    throw new Error(result.message || 'No se pudo subir el audio a Archive.org.');
  }

  if (!isArchiveOrgAudioUrl(result.audioUrl)) {
    throw new Error(
      `La URL de audio no es de Archive.org (no se usa Supabase Storage): ${result.audioUrl}`
    );
  }

  return {
    audioUrl: result.audioUrl,
    identifier: result.identifier,
    itemUrl: result.itemUrl,
    message: result.message || 'Audio subido a Archive.org.',
  };
};
