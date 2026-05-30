import type { ContentIndexData } from '../../../src/editor/contracts';
import type { SavePayloadInput } from './savePayload';

export type RepoFileEncoding = 'utf-8' | 'base64';

export interface RepoFileWrite {
  path: string;
  content: string;
  encoding: RepoFileEncoding;
}

export interface EditorStore {
  getStatus(): Promise<{ branch: string; hasChanges: boolean }>;
  persistSavePayload(body: SavePayloadInput): Promise<void>;
  publishSavePayload(body: SavePayloadInput): Promise<void>;
  uploadImage(input: {
    scope: 'program-logo' | 'episode-cover';
    programId: string;
    episodeId?: string;
    mimeType: string;
    dataBase64: string;
  }): Promise<{ logoFileName?: string; coverPublicPath?: string }>;
  createProgram(input: {
    id: string;
    titleEs: string;
    titlePt: string;
    schedule?: string;
  }): Promise<{ programId: string }>;
  deleteProgram(input: { id: string; confirmText: string }): Promise<{ programId: string }>;
  readTranslateUsage(month: string): Promise<number>;
  writeTranslateUsage(month: string, usedChars: number, monthlyLimit: number): Promise<void>;
}

export interface EditorRuntimeConfig {
  archive?: {
    accessKey?: string;
    secretKey?: string;
    collection?: string;
  };
  translation?: {
    apiKey?: string;
    endpointUrl?: string;
    monthlyCharLimit?: number;
  };
  supportedLanguages?: string[];
}

export type { ContentIndexData, SavePayloadInput };
