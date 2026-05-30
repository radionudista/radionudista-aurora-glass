import {
  contentIndexSchema,
  editorialSchema,
  programEpisodesSchema,
  programEpisodesTrashSchema,
  type ContentIndexData,
  type EditorialData,
  type ProgramEpisodesData,
  type ProgramEpisodesTrashData,
} from '../editor/contracts';

export interface SavePayload {
  contentIndex?: ContentIndexData;
  editorial?: EditorialData;
  episodesByProgram?: Record<string, ProgramEpisodesData>;
  episodesTrashByProgram?: Record<string, ProgramEpisodesTrashData>;
}

interface DevEditorResponse {
  ok: boolean;
  message: string;
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface UploadImageResponse extends DevEditorResponse {
  logoFileName?: string;
  coverPublicPath?: string;
}

export interface UploadEpisodeAudioToArchiveResponse extends DevEditorResponse {
  identifier?: string;
  audioUrl?: string;
  itemUrl?: string;
  fileName?: string;
}

export interface CreateProgramPayload {
  id: string;
  titleEs: string;
  titlePt: string;
  schedule?: string;
}

export interface CreateProgramResponse extends DevEditorResponse {
  programId?: string;
}

export interface DeleteProgramPayload {
  id: string;
  confirmText: string;
}

export interface DeleteProgramResponse extends DevEditorResponse {
  programId?: string;
}

export interface TranslateTextResponse extends DevEditorResponse {
  month: string;
  usedChars: number;
  remainingChars: number;
  translated: {
    en: string;
    pt: string;
  };
}

const parseJson = async <T>(response: Response): Promise<T> => {
  const data = await response.json();
  return data as T;
};

const EDITOR_TOKEN_STORAGE_KEY = 'rn_editor_dev_token';

let editorToken =
  typeof window !== 'undefined' ? window.localStorage.getItem(EDITOR_TOKEN_STORAGE_KEY) : null;

const isEditorEndpoint = (url: string) => url.startsWith('/__dev/editor');

export const devEditorAuth = {
  hasToken: () => Boolean(editorToken),
  setToken: (token: string) => {
    editorToken = token.trim();
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(EDITOR_TOKEN_STORAGE_KEY, editorToken);
    }
  },
  clearToken: () => {
    editorToken = null;
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(EDITOR_TOKEN_STORAGE_KEY);
    }
  },
};

const requestJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const headers = new Headers(init?.headers);
  if (isEditorEndpoint(url) && editorToken) {
    headers.set('X-Editor-Token', editorToken);
  }

  const response = await fetch(url, { ...init, headers });
  if (!response.ok) {
    const raw = await response.text();
    let message = raw;
    try {
      const parsed = JSON.parse(raw) as { message?: string };
      if (parsed?.message) message = parsed.message;
    } catch {
      // Keep raw text message
    }
    if (isEditorEndpoint(url) && (response.status === 401 || response.status === 403)) {
      devEditorAuth.clearToken();
    }
    throw new Error(message || `Request failed for ${url}`);
  }
  return parseJson<T>(response);
};

export class DevEditorService {
  public async getStatus(): Promise<{ enabled: boolean; branch: string; hasChanges: boolean }> {
    return requestJson('/__dev/editor/status');
  }

  public async save(payload: SavePayload): Promise<DevEditorResponse> {
    return requestJson('/__dev/editor/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  public async publish(payload: SavePayload): Promise<DevEditorResponse> {
    return requestJson('/__dev/editor/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  public async uploadImage(payload: {
    scope: 'program-logo' | 'episode-cover';
    programId: string;
    episodeId?: string;
    mimeType: string;
    dataBase64: string;
  }): Promise<UploadImageResponse> {
    return requestJson('/__dev/editor/upload-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  public async uploadEpisodeAudioToArchive(payload: {
    programId: string;
    episodeId: string;
    episodeTitle: string;
    date?: string;
    description?: string;
    tags?: string[];
    mimeType: string;
    fileName: string;
    dataBase64: string;
  }): Promise<UploadEpisodeAudioToArchiveResponse> {
    return requestJson('/__dev/editor/upload-episode-audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  public async createProgram(payload: CreateProgramPayload): Promise<CreateProgramResponse> {
    return requestJson('/__dev/editor/create-program', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  public async deleteProgram(payload: DeleteProgramPayload): Promise<DeleteProgramResponse> {
    return requestJson('/__dev/editor/delete-program', {
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
    const data = await requestJson<unknown>('/contentIndex.json');
    return contentIndexSchema.parse(data);
  }

  public async fetchEditorial(): Promise<EditorialData> {
    const data = await requestJson<unknown>('/editor/home-about-contact.json');
    return editorialSchema.parse(data);
  }

  public async fetchProgramEpisodes(programId: string): Promise<ProgramEpisodesData> {
    if (!SLUG_RE.test(programId)) {
      throw new Error('ID de programa inválido.');
    }
    const data = await requestJson<unknown>(`/episodes/${programId}.json`);
    return programEpisodesSchema.parse(data);
  }

  public async fetchProgramTrashEpisodes(programId: string): Promise<ProgramEpisodesTrashData> {
    if (!SLUG_RE.test(programId)) {
      throw new Error('ID de programa inválido.');
    }
    const response = await fetch(`/episodes/trash/${programId}.json`);
    if (response.status === 404) {
      return { programId, episodes: [] };
    }
    if (!response.ok) {
      const raw = await response.text();
      throw new Error(raw || `Request failed for /episodes/trash/${programId}.json`);
    }
    const data = (await response.json()) as unknown;
    return programEpisodesTrashSchema.parse(data);
  }
}

export const devEditorService = new DevEditorService();
