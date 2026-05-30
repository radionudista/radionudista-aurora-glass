import type { ContentIndexData, EditorialData } from '../../../src/editor/contracts';
import type { RepoFileWrite } from './types';

export interface SavePayloadInput {
  contentIndex?: ContentIndexData;
  editorial?: EditorialData;
  episodesByProgram?: Record<string, unknown>;
  episodesTrashByProgram?: Record<string, unknown>;
}

export const buildSavePayloadFiles = (body: SavePayloadInput): RepoFileWrite[] => {
  const files: RepoFileWrite[] = [];

  if (body.contentIndex) {
    const serialized = `${JSON.stringify(body.contentIndex, null, 2)}\n`;
    files.push({ path: 'public/contentIndex.json', content: serialized, encoding: 'utf-8' });
    files.push({ path: 'src/contentIndex.json', content: serialized, encoding: 'utf-8' });
  }

  if (body.editorial) {
    files.push({
      path: 'public/editor/home-about-contact.json',
      content: `${JSON.stringify(body.editorial, null, 2)}\n`,
      encoding: 'utf-8',
    });
  }

  if (body.episodesByProgram) {
    for (const [programId, payload] of Object.entries(body.episodesByProgram)) {
      files.push({
        path: `public/episodes/${programId}.json`,
        content: `${JSON.stringify(payload, null, 2)}\n`,
        encoding: 'utf-8',
      });
    }
  }

  if (body.episodesTrashByProgram) {
    for (const [programId, payload] of Object.entries(body.episodesTrashByProgram)) {
      files.push({
        path: `public/episodes/trash/${programId}.json`,
        content: `${JSON.stringify(payload, null, 2)}\n`,
        encoding: 'utf-8',
      });
    }
  }

  return files;
};
