import {
  programEpisodesTrashSchema,
  type ContentIndexData,
  type EditorialData,
  type ProgramEpisodesData,
  type ProgramEpisodesTrashData,
} from '../editor/contracts';
import { getSupabaseAccessToken } from '../lib/supabaseClient';
import {
  fetchContentIndexFromSupabase,
  fetchEditorContentIndexFromSupabase,
  fetchEditorialFromSupabase,
  fetchEpisodesByProgramFromSupabase,
  fetchProgramEpisodesBundleFromSupabase,
  fetchTrashEpisodesByProgramFromSupabase,
  isSupabaseConfigured,
} from './supabaseContentService';

export interface CreateProgramPayload {
  id: string;
  titleEs: string;
  titlePt: string;
  schedule?: string;
  contentKind?: 'program' | 'event';
}

export interface DeleteProgramPayload {
  id: string;
  confirmText: string;
}

export interface PrepareArchiveAudioUploadResponse {
  ok: boolean;
  message: string;
  identifier?: string;
  audioUrl?: string;
  itemUrl?: string;
  fileName?: string;
  putUrl?: string;
  uploadHeaders?: Record<string, string>;
}

export interface UploadEpisodeAudioToArchiveResponse {
  ok: boolean;
  message: string;
  identifier?: string;
  audioUrl?: string;
  itemUrl?: string;
  fileName?: string;
}

export interface AdminEditorUser {
  userId: string;
  email: string;
  role: 'admin' | 'editor';
  programId: string | null;
  disabledAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AdminListUsersResponse {
  ok: boolean;
  message: string;
  users: AdminEditorUser[];
}

export interface TranslateTextResponse {
  ok: boolean;
  message: string;
  month: string;
  usedChars: number;
  remainingChars: number;
  translated: {
    en: string;
    pt: string;
  };
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const utf8ToBase64 = (text: string): string => {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
};

const parseJson = async <T>(response: Response): Promise<T> => {
  const data = await response.json();
  return data as T;
};

const requestJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const token = await getSupabaseAccessToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(url, { ...init, headers });
  if (!response.ok) {
    const raw = await response.text();
    let message = raw;
    try {
      const parsed = JSON.parse(raw) as { message?: string };
      if (parsed?.message) message = parsed.message;
    } catch {
      // keep raw
    }
    throw new Error(message || `Request failed for ${url}`);
  }
  return parseJson<T>(response);
};

export class DevEditorService {
  public async prepareArchiveAudioUpload(payload: {
    programId: string;
    episodeId: string;
    episodeTitle: string;
    date?: string;
    description?: string;
    tags?: string[];
    mimeType: string;
    fileName: string;
    fileSizeBytes: number;
  }): Promise<PrepareArchiveAudioUploadResponse> {
    return requestJson('/__dev/editor/prepare-archive-audio-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  public async uploadEpisodeAudioProxy(
    payload: {
      programId: string;
      episodeId: string;
      date?: string;
      fileName: string;
    },
    file: File | Blob
  ): Promise<UploadEpisodeAudioToArchiveResponse> {
    const token = await getSupabaseAccessToken();
    const metaB64 = utf8ToBase64(
      JSON.stringify({
        programId: payload.programId,
        episodeId: payload.episodeId,
        date: payload.date || '',
        fileName: payload.fileName,
      })
    );
    const headers = new Headers({
      'Content-Type': 'audio/mpeg',
      'X-Upload-Meta': metaB64,
    });
    if (token) headers.set('Authorization', `Bearer ${token}`);

    const response = await fetch('/__dev/editor/upload-episode-audio-proxy', {
      method: 'POST',
      headers,
      body: file,
    });

    if (!response.ok) {
      const raw = await response.text();
      let message = raw;
      try {
        const parsed = JSON.parse(raw) as { message?: string };
        if (parsed?.message) message = parsed.message;
      } catch {
        // keep raw
      }
      throw new Error(message || 'Error al subir audio a Archive.org.');
    }

    return parseJson<UploadEpisodeAudioToArchiveResponse>(response);
  }

  public async listAdminUsers(): Promise<AdminListUsersResponse> {
    return requestJson('/__dev/editor/admin/list-users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
  }

  public async createAdminUser(payload: {
    email: string;
    password: string;
    role: 'admin' | 'editor';
    programId?: string | null;
  }): Promise<{ ok: boolean; message: string }> {
    return requestJson('/__dev/editor/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  public async updateAdminUser(payload: {
    userId: string;
    role?: 'admin' | 'editor';
    programId?: string | null;
    disabled?: boolean;
    password?: string;
  }): Promise<{ ok: boolean; message: string }> {
    return requestJson('/__dev/editor/admin/update-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  public async translateText(payload: {
    text: string;
    source: 'es';
    targets: Array<'en' | 'pt'>;
  }): Promise<TranslateTextResponse> {
    return requestJson('/__dev/editor/translate-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  public async fetchContentIndex(): Promise<ContentIndexData> {
    if (!isSupabaseConfigured()) throw new Error('Supabase no configurado.');
    const data = await fetchEditorContentIndexFromSupabase();
    if (!data) throw new Error('No hay contenido en Supabase.');
    return data;
  }

  public async fetchEditorial(): Promise<EditorialData> {
    if (!isSupabaseConfigured()) throw new Error('Supabase no configurado.');
    const data = await fetchEditorialFromSupabase();
    if (!data) throw new Error('No hay contenido editorial en Supabase.');
    return data;
  }

  public async fetchProgramEpisodesBundle(programId: string, lang: import('../editor/contracts').EditorLanguage = 'es') {
    if (!SLUG_RE.test(programId)) throw new Error('ID de programa inválido.');
    if (!isSupabaseConfigured()) throw new Error('Supabase no configurado.');
    return fetchProgramEpisodesBundleFromSupabase(programId, lang);
  }

  public async fetchProgramEpisodes(
    programId: string,
    lang: import('../editor/contracts').EditorLanguage = 'es'
  ): Promise<ProgramEpisodesData> {
    if (!SLUG_RE.test(programId)) throw new Error('ID de programa inválido.');
    if (!isSupabaseConfigured()) throw new Error('Supabase no configurado.');
    const data = await fetchEpisodesByProgramFromSupabase(programId, lang);
    return data ?? { programId, episodes: [] };
  }

  public async fetchProgramTrashEpisodes(
    programId: string,
    lang: import('../editor/contracts').EditorLanguage = 'es'
  ): Promise<ProgramEpisodesTrashData> {
    if (!SLUG_RE.test(programId)) throw new Error('ID de programa inválido.');
    if (!isSupabaseConfigured()) throw new Error('Supabase no configurado.');
    const data = await fetchTrashEpisodesByProgramFromSupabase(programId, lang);
    return programEpisodesTrashSchema.parse(data);
  }
}

export const devEditorService = new DevEditorService();

export const fetchPublicContentIndex = fetchContentIndexFromSupabase;
