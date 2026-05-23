import React from 'react';
import { env } from '../config/env';
import contentIndexStatic from '../contentIndex.json';
import editorialStatic from '../../public/editor/home-about-contact.json';
import {
  type AboutCreditsData,
  type ContentIndexData,
  type EditorLanguage,
  type EditorialData,
  type ProgramEpisodesData,
  type ProgramEpisodesTrashData,
  defaultAboutCredits,
  editorialSchema,
} from '../editor/contracts';
import {
  devEditorAuth,
  devEditorService,
  type CreateProgramPayload,
  type DeleteProgramPayload,
  type SavePayload,
} from '../services/devEditorService';

const fallbackEditorial: EditorialData = {
  home: {
    manifestTitle: {
      es: 'Sacandole el envoltorio a la cultura',
      pt: 'Tirando o embrulho da cultura',
      en: 'Unwrapping culture',
    },
    manifestSubtitle: {
      es: 'Sube el volumen, baja el juicio.',
      pt: 'Aumenta o volume, diminui o julgamento.',
      en: 'Turn up the volume, lower the judgment.',
    },
    joinPanelCopy: {
      es: 'Si tienes una idea rara, sensible o explosiva, este es tu lugar.',
      pt: 'Se voce tem uma ideia estranha, sensivel ou explosiva, este e o seu lugar.',
      en: 'If you have a weird, sensitive or explosive idea, this is your place.',
    },
  },
  about: {
    heroTitle: { es: 'NOSOTRXS', pt: 'NOS', en: 'US' },
    lead: {
      es: 'radionudista es un club social experimental disenado para la transmision de frecuencias no convencionales.',
      pt: 'radionudista e um clube social experimental criado para transmitir frequencias nao convencionais.',
      en: 'radionudista is an experimental social club created to broadcast unconventional frequencies.',
    },
    paragraph1: { es: '', pt: '', en: '' },
    paragraph2: { es: '', pt: '', en: '' },
    credits: defaultAboutCredits,
  },
  contact: {
    pageTitle: { es: 'Ponte en Contacto', pt: 'Entre em Contato', en: 'Get in Touch' },
    pageSubtitle: {
      es: 'Nos encantaria saber de ti',
      pt: 'Adorariamos saber de voce',
      en: 'We would love to hear from you',
    },
  },
};

const initialEditorial: EditorialData = (() => {
  try {
    return editorialSchema.parse(editorialStatic);
  } catch {
    return fallbackEditorial;
  }
})();

type LocalizedTextValues = Record<EditorLanguage, string>;

interface EditorContextValue {
  enabled: boolean;
  authenticated: boolean;
  loading: boolean;
  saving: boolean;
  isDirty: boolean;
  message: string | null;
  contentIndex: ContentIndexData;
  editorial: EditorialData;
  episodesByProgram: Record<string, ProgramEpisodesData>;
  episodesTrashByProgram: Record<string, ProgramEpisodesTrashData>;
  auth: (password: string) => Promise<void>;
  logout: () => void;
  updateContentField: (programId: string, lang: 'es' | 'pt', field: string, value: unknown) => void;
  commitContentField: (
    programId: string,
    lang: EditorLanguage,
    field: string,
    value: unknown
  ) => Promise<void>;
  commitContentFieldLocalized: (
    programId: string,
    field: string,
    values: LocalizedTextValues
  ) => Promise<void>;
  /** Actualiza el mismo campo en es y pt (p. ej. logo del programa). */
  commitContentFieldAllLanguages: (programId: string, field: string, value: unknown) => Promise<void>;
  /** Actualiza VARIOS campos en es y pt en una sola operación de guardado (evita race conditions). */
  commitMultipleContentFieldsAllLanguages: (programId: string, fields: Record<string, unknown>) => Promise<void>;
  updateEditorialField: (
    section: keyof EditorialData,
    field: string,
    lang: EditorLanguage,
    value: string
  ) => void;
  commitEditorialField: (
    section: keyof EditorialData,
    field: string,
    lang: EditorLanguage,
    value: string
  ) => Promise<void>;
  commitEditorialFieldLocalized: (
    section: keyof EditorialData,
    field: string,
    values: LocalizedTextValues
  ) => Promise<void>;
  commitAboutCredits: (next: AboutCreditsData) => Promise<void>;
  createProgram: (payload: CreateProgramPayload) => Promise<string | null>;
  deleteProgram: (payload: DeleteProgramPayload) => Promise<boolean>;
  loadEpisodes: (programId: string) => Promise<void>;
  updateEpisodeField: (programId: string, episodeId: string, field: string, value: unknown) => void;
  commitEpisodeField: (
    programId: string,
    episodeId: string,
    field: string,
    value: unknown
  ) => Promise<void>;
  addEpisode: (
    programId: string,
    payload: {
      id?: string;
      title?: string;
      date?: string;
      duration?: string;
      audioUrl: string;
      description?: string;
      tags?: string[];
      archiveIdentifier?: string;
    }
  ) => Promise<string | null>;
  removeEpisode: (programId: string, episodeId: string) => void;
  restoreEpisode: (programId: string, episodeId: string) => void;
  purgeEpisode: (programId: string, episodeId: string) => void;
  save: () => Promise<void>;
  publish: () => Promise<void>;
  translateText: (
    text: string
  ) => Promise<{ translated: Pick<LocalizedTextValues, 'en' | 'pt'>; usedChars: number; remainingChars: number; month: string }>;
}

const EditorContext = React.createContext<EditorContextValue | null>(null);

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const ensureLanguageEntry = (
  entry: Record<string, unknown>,
  lang: EditorLanguage
): Record<string, unknown> => {
  const existing = entry[lang] as Record<string, unknown> | undefined;
  if (existing) return existing;
  const esEntry = (entry.es as Record<string, unknown> | undefined) ?? {};
  const created = { ...esEntry, language: lang };
  entry[lang] = created;
  return created;
};

export const EditorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const enabled = import.meta.env.DEV && env.APP_ENVIRONMENT === 'local' && env.EDITOR_ENABLED;
  const [authenticated, setAuthenticated] = React.useState(() => enabled && devEditorAuth.hasToken());
  const active = enabled && authenticated;
  const [loading, setLoading] = React.useState(active);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [dirtyFiles, setDirtyFiles] = React.useState<Set<string>>(new Set());
  const [contentIndex, setContentIndex] = React.useState<ContentIndexData>(contentIndexStatic as ContentIndexData);
  const [editorial, setEditorial] = React.useState<EditorialData>(initialEditorial);
  const [episodesByProgram, setEpisodesByProgram] = React.useState<Record<string, ProgramEpisodesData>>({});
  const [episodesTrashByProgram, setEpisodesTrashByProgram] = React.useState<
    Record<string, ProgramEpisodesTrashData>
  >({});
  const [baseContentIndex, setBaseContentIndex] = React.useState<ContentIndexData>(contentIndexStatic as ContentIndexData);
  const [baseEditorial, setBaseEditorial] = React.useState<EditorialData>(initialEditorial);

  const sortEpisodesByDateDesc = React.useCallback((episodes: ProgramEpisodesData['episodes']) => {
    return [...episodes].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, []);

  React.useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7560/ingest/5ccebaa5-f0e4-4ced-b6b7-3a14221eeaa6', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '153f83' },
      body: JSON.stringify({
        sessionId: '153f83',
        runId: 'pre-fix',
        hypothesisId: 'H1',
        location: 'src/contexts/EditorContext.tsx:168',
        message: 'Editor gating flags evaluated',
        data: {
          importMetaDev: import.meta.env.DEV,
          appEnvironment: env.APP_ENVIRONMENT,
          editorEnabledEnv: env.EDITOR_ENABLED,
          enabled,
          authenticated,
          active,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
  }, [enabled, authenticated, active]);

  const auth = React.useCallback(async (password: string) => {
    const token = password.trim();
    if (!token) {
      throw new Error('Falta el token del editor dev.');
    }

    devEditorAuth.setToken(token);
    await devEditorService.getStatus();
    setAuthenticated(true);
    setMessage('Editor dev autenticado.');
  }, []);

  const logout = React.useCallback(() => {
    devEditorAuth.clearToken();
    setAuthenticated(false);
    setMessage('Editor dev bloqueado.');
  }, []);

  React.useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    if (!authenticated) {
      setLoading(false);
      return;
    }

    const loadInitialData = async () => {
      setLoading(true);
      try {
        await devEditorService.getStatus();
        const [content, editorialData] = await Promise.all([
          devEditorService.fetchContentIndex(),
          devEditorService.fetchEditorial(),
        ]);
        setContentIndex(content);
        setBaseContentIndex(clone(content));
        setEditorial(editorialData);
        setBaseEditorial(clone(editorialData));
      } catch (error) {
        if (error instanceof Error && /token|401|403/i.test(error.message)) {
          devEditorAuth.clearToken();
          setAuthenticated(false);
        }
        // Keep fallback data
      } finally {
        setLoading(false);
      }
    };

    void loadInitialData();
  }, [authenticated, enabled]);

  React.useEffect(() => {
    if (!enabled || authenticated) return;
    const token = window.prompt('Token del editor dev');
    if (!token) {
      setMessage('Editor dev bloqueado: falta token.');
      return;
    }
    void auth(token).catch((error) => {
      devEditorAuth.clearToken();
      setAuthenticated(false);
      setMessage(error instanceof Error ? error.message : 'Token del editor dev inválido.');
    });
  }, [auth, authenticated, enabled]);

  const touchFile = (filePath: string) => {
    setDirtyFiles((prev) => {
      const next = new Set(prev);
      next.add(filePath);
      return next;
    });
  };

  const updateContentField = (programId: string, lang: EditorLanguage, field: string, value: unknown) => {
    setContentIndex((prev) => {
      const next = clone(prev);
      const entry = next?.[programId] as Record<string, unknown> | undefined;
      if (!entry) return prev;
      const target = ensureLanguageEntry(entry, lang);
      target[field] = value;
      return next;
    });
    touchFile('/public/contentIndex.json');
  };

  const commitContentField = async (
    programId: string,
    lang: EditorLanguage,
    field: string,
    value: unknown
  ) => {
    const nextContent = clone(contentIndex);
    const entry = nextContent?.[programId] as Record<string, unknown> | undefined;
    if (!entry) return;
    const target = ensureLanguageEntry(entry, lang);
    target[field] = value;

    setContentIndex(nextContent);
    const response = await devEditorService.save({ contentIndex: nextContent });
    setBaseContentIndex(clone(nextContent));
    setDirtyFiles((prev) => {
      const next = new Set(prev);
      next.delete('/public/contentIndex.json');
      return next;
    });
    setMessage(response.message);
  };

  const commitContentFieldLocalized = async (
    programId: string,
    field: string,
    values: LocalizedTextValues
  ) => {
    const nextContent = clone(contentIndex);
    const entry = nextContent?.[programId];
    if (!entry) return;
    for (const lang of ['es', 'pt', 'en'] as const) {
      const target = ensureLanguageEntry(entry as unknown as Record<string, unknown>, lang);
      target[field] = values[lang];
    }
    setContentIndex(nextContent);
    const response = await devEditorService.save({ contentIndex: nextContent });
    setBaseContentIndex(clone(nextContent));
    setDirtyFiles((prev) => {
      const next = new Set(prev);
      next.delete('/public/contentIndex.json');
      return next;
    });
    setMessage(response.message);
  };

  const commitContentFieldAllLanguages = async (programId: string, field: string, value: unknown) => {
    const nextContent = clone(contentIndex);
    const entry = nextContent?.[programId];
    if (!entry) return;
    for (const lang of ['es', 'pt', 'en'] as const) {
      const target = ensureLanguageEntry(entry as unknown as Record<string, unknown>, lang);
      target[field] = value;
    }
    setContentIndex(nextContent);
    const response = await devEditorService.save({ contentIndex: nextContent });
    setBaseContentIndex(clone(nextContent));
    setDirtyFiles((prev) => {
      const next = new Set(prev);
      next.delete('/public/contentIndex.json');
      return next;
    });
    setMessage(response.message);
  };

  const commitMultipleContentFieldsAllLanguages = async (
    programId: string,
    fields: Record<string, unknown>
  ) => {
    const nextContent = clone(contentIndex);
    const entry = nextContent?.[programId];
    if (!entry) return;
    for (const lang of ['es', 'pt', 'en'] as const) {
      const target = ensureLanguageEntry(entry as unknown as Record<string, unknown>, lang);
      for (const [field, value] of Object.entries(fields)) {
        target[field] = value;
      }
    }
    setContentIndex(nextContent);
    const response = await devEditorService.save({ contentIndex: nextContent });
    setBaseContentIndex(clone(nextContent));
    setDirtyFiles((prev) => {
      const next = new Set(prev);
      next.delete('/public/contentIndex.json');
      return next;
    });
    setMessage(response.message);
  };

  const updateEditorialField = (
    section: keyof EditorialData,
    field: string,
    lang: EditorLanguage,
    value: string
  ) => {
    setEditorial((prev) => {
      const next = clone(prev);
      const target = (next[section] as Record<string, unknown>)[field] as Record<string, string> | undefined;
      if (!target) return prev;
      target[lang] = value;
      return next;
    });
    touchFile('/public/editor/home-about-contact.json');
  };

  const loadEpisodes = async (programId: string) => {
    if (episodesByProgram[programId] && episodesTrashByProgram[programId]) return;
    const [episodesResult, trashResult] = await Promise.allSettled([
      devEditorService.fetchProgramEpisodes(programId),
      devEditorService.fetchProgramTrashEpisodes(programId),
    ]);

    if (episodesResult.status === 'fulfilled') {
      setEpisodesByProgram((prev) => ({ ...prev, [programId]: episodesResult.value }));
    }

    if (trashResult.status === 'fulfilled') {
      setEpisodesTrashByProgram((prev) => ({ ...prev, [programId]: trashResult.value }));
      return;
    }

    if (!episodesTrashByProgram[programId]) {
      setEpisodesTrashByProgram((prev) => ({ ...prev, [programId]: { programId, episodes: [] } }));
    }

    // Do not force an empty active archive on transient failures.
    // ProgramDetail can keep using episodeService data as fallback.
  };

  const updateEpisodeField = (programId: string, episodeId: string, field: string, value: unknown) => {
    setEpisodesByProgram((prev) => {
      const next = clone(prev);
      const program = next[programId];
      if (!program) return prev;
      const episode = program.episodes.find((item) => item.id === episodeId) as Record<string, unknown> | undefined;
      if (!episode) return prev;
      episode[field] = value;
      return next;
    });
    touchFile(`/public/episodes/${programId}.json`);
  };

  const commitEpisodeField = async (
    programId: string,
    episodeId: string,
    field: string,
    value: unknown
  ) => {
    const sourceProgram =
      episodesByProgram[programId] ??
      (await devEditorService.fetchProgramEpisodes(programId).catch(
        () => ({ programId, episodes: [] } as ProgramEpisodesData)
      ));

    const nextProgram = clone(sourceProgram);
    const episode = nextProgram.episodes.find((item) => item.id === episodeId) as Record<string, unknown> | undefined;
    if (!episode) return;
    episode[field] = value;

    setEpisodesByProgram((prev) => ({ ...prev, [programId]: nextProgram }));
    const response = await devEditorService.save({
      episodesByProgram: {
        [programId]: nextProgram,
      },
    });
    setDirtyFiles((prev) => {
      const next = new Set(prev);
      next.delete(`/public/episodes/${programId}.json`);
      return next;
    });
    setMessage(response.message);
  };

  const addEpisode = async (
    programId: string,
    payload: {
      id?: string;
      title?: string;
      date?: string;
      duration?: string;
      audioUrl: string;
      description?: string;
      tags?: string[];
      archiveIdentifier?: string;
    }
  ): Promise<string | null> => {
    const sourceProgram =
      episodesByProgram[programId] ??
      (await devEditorService.fetchProgramEpisodes(programId).catch(
        () => ({ programId, episodes: [] } as ProgramEpisodesData)
      ));
    const nextProgram = clone(sourceProgram);
    const newEpisodeId = (payload.id || `${programId}-${Date.now()}`).trim();
    if (!payload.audioUrl?.trim()) return null;
    nextProgram.episodes.unshift({
      id: newEpisodeId,
      title: payload.title?.trim() || 'Nuevo episodio',
      date: payload.date?.trim() || new Date().toISOString().slice(0, 10),
      duration: payload.duration?.trim() || '00:00',
      audioUrl: payload.audioUrl.trim(),
      description: payload.description || '',
      tags: payload.tags ?? [],
      archiveIdentifier: payload.archiveIdentifier,
    });

    setEpisodesByProgram((prev) => ({ ...prev, [programId]: nextProgram }));
    const response = await devEditorService.save({
      episodesByProgram: {
        [programId]: nextProgram,
      },
    });
    setDirtyFiles((prev) => {
      const next = new Set(prev);
      next.delete(`/public/episodes/${programId}.json`);
      return next;
    });
    setMessage(response.message);
    return newEpisodeId;
  };

  const removeEpisode = (programId: string, episodeId: string) => {
    let removedEpisode: ProgramEpisodesData['episodes'][number] | null = null;
    setEpisodesByProgram((prev) => {
      const next = clone(prev);
      const program = next[programId];
      if (!program) return prev;
      removedEpisode = program.episodes.find((item) => item.id === episodeId) ?? null;
      program.episodes = program.episodes.filter((item) => item.id !== episodeId);
      return next;
    });
    if (removedEpisode) {
      setEpisodesTrashByProgram((prev) => {
        const next = clone(prev);
        const trash = next[programId] ?? { programId, episodes: [] };
        trash.episodes = sortEpisodesByDateDesc([
          ...trash.episodes.filter((item) => item.id !== removedEpisode!.id),
          removedEpisode!,
        ]);
        next[programId] = trash;
        return next;
      });
    }
    touchFile(`/public/episodes/${programId}.json`);
    touchFile(`/public/episodes/trash/${programId}.json`);
  };

  const restoreEpisode = (programId: string, episodeId: string) => {
    let restoredEpisode: ProgramEpisodesData['episodes'][number] | null = null;
    setEpisodesTrashByProgram((prev) => {
      const next = clone(prev);
      const trash = next[programId];
      if (!trash) return prev;
      restoredEpisode = trash.episodes.find((item) => item.id === episodeId) ?? null;
      trash.episodes = trash.episodes.filter((item) => item.id !== episodeId);
      return next;
    });
    if (restoredEpisode) {
      setEpisodesByProgram((prev) => {
        const next = clone(prev);
        const program = next[programId] ?? { programId, episodes: [] };
        program.episodes = sortEpisodesByDateDesc([
          ...program.episodes.filter((item) => item.id !== restoredEpisode!.id),
          restoredEpisode!,
        ]);
        next[programId] = program;
        return next;
      });
    }
    touchFile(`/public/episodes/${programId}.json`);
    touchFile(`/public/episodes/trash/${programId}.json`);
  };

  const purgeEpisode = (programId: string, episodeId: string) => {
    setEpisodesTrashByProgram((prev) => {
      const next = clone(prev);
      const trash = next[programId];
      if (!trash) return prev;
      trash.episodes = trash.episodes.filter((item) => item.id !== episodeId);
      return next;
    });
    touchFile(`/public/episodes/trash/${programId}.json`);
  };

  const buildPayload = (): SavePayload => {
    const payload: SavePayload = {};

    if (dirtyFiles.has('/public/contentIndex.json')) {
      payload.contentIndex = contentIndex;
    }

    if (dirtyFiles.has('/public/editor/home-about-contact.json')) {
      payload.editorial = editorial;
    }

    const episodesPayload: Record<string, ProgramEpisodesData> = {};
    Object.keys(episodesByProgram).forEach((programId) => {
      if (dirtyFiles.has(`/public/episodes/${programId}.json`)) {
        episodesPayload[programId] = episodesByProgram[programId];
      }
    });
    if (Object.keys(episodesPayload).length > 0) {
      payload.episodesByProgram = episodesPayload;
    }

    const episodesTrashPayload: Record<string, ProgramEpisodesTrashData> = {};
    Object.keys(episodesTrashByProgram).forEach((programId) => {
      if (dirtyFiles.has(`/public/episodes/trash/${programId}.json`)) {
        episodesTrashPayload[programId] = episodesTrashByProgram[programId];
      }
    });
    if (Object.keys(episodesTrashPayload).length > 0) {
      payload.episodesTrashByProgram = episodesTrashPayload;
    }

    return payload;
  };

  const save = async () => {
    if (!active) return;
    setSaving(true);
    try {
      const response = await devEditorService.save(buildPayload());
      setBaseContentIndex(clone(contentIndex));
      setBaseEditorial(clone(editorial));
      setDirtyFiles(new Set());
      setMessage(response.message);
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    if (!active) return;
    setSaving(true);
    try {
      const response = await devEditorService.publish(buildPayload());
      setBaseContentIndex(clone(contentIndex));
      setBaseEditorial(clone(editorial));
      setDirtyFiles(new Set());
      setMessage(response.message);
    } finally {
      setSaving(false);
    }
  };

  const commitEditorialField = async (
    section: keyof EditorialData,
    field: string,
    lang: EditorLanguage,
    value: string
  ) => {
    const nextEditorial = clone(editorial);
    const target = (nextEditorial[section] as Record<string, unknown>)[field] as Record<string, string> | undefined;
    if (!target) return;
    target[lang] = value;

    setEditorial(nextEditorial);
    const response = await devEditorService.save({ editorial: nextEditorial });
    setBaseEditorial(clone(nextEditorial));
    setDirtyFiles((prev) => {
      const next = new Set(prev);
      next.delete('/public/editor/home-about-contact.json');
      return next;
    });
    setMessage(response.message);
  };

  const commitEditorialFieldLocalized = async (
    section: keyof EditorialData,
    field: string,
    values: LocalizedTextValues
  ) => {
    const nextEditorial = clone(editorial);
    const target = (nextEditorial[section] as Record<string, unknown>)[field] as
      | Record<string, string>
      | undefined;
    if (!target) return;
    target.es = values.es;
    target.pt = values.pt;
    target.en = values.en;

    setEditorial(nextEditorial);
    const response = await devEditorService.save({ editorial: nextEditorial });
    setBaseEditorial(clone(nextEditorial));
    setDirtyFiles((prev) => {
      const next = new Set(prev);
      next.delete('/public/editor/home-about-contact.json');
      return next;
    });
    setMessage(response.message);
  };

  const translateText: EditorContextValue['translateText'] = async (text) => {
    if (!active) {
      throw new Error('La traducción solo está disponible con editor dev activo.');
    }
    return devEditorService.translateText({ text, source: 'es', targets: ['en', 'pt'] });
  };

  const commitAboutCredits = async (nextCredits: AboutCreditsData) => {
    const nextEditorial = clone(editorial);
    nextEditorial.about = { ...nextEditorial.about, credits: nextCredits };
    // #region agent log
    fetch('http://127.0.0.1:7560/ingest/5ccebaa5-f0e4-4ced-b6b7-3a14221eeaa6', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '153f83' },
      body: JSON.stringify({
        sessionId: '153f83',
        runId: 'pre-fix',
        hypothesisId: 'H5',
        location: 'src/contexts/EditorContext.tsx:604',
        message: 'commitAboutCredits invoked',
        data: {
          active,
          groupsCount: nextCredits.groups.length,
          webDesignCount: nextCredits.groups.find((group) => group.id === 'web_design')?.people.length ?? 0,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    setEditorial(nextEditorial);
    const response = await devEditorService.save({ editorial: nextEditorial });
    setBaseEditorial(clone(nextEditorial));
    setDirtyFiles((prev) => {
      const next = new Set(prev);
      next.delete('/public/editor/home-about-contact.json');
      return next;
    });
    setMessage(response.message);
  };

  const createProgram = async (payload: CreateProgramPayload): Promise<string | null> => {
    if (!active) return null;
    setSaving(true);
    try {
      const res = await devEditorService.createProgram(payload);
      const content = await devEditorService.fetchContentIndex();
      setContentIndex(content);
      setBaseContentIndex(clone(content));
      setDirtyFiles((prev) => {
        const next = new Set(prev);
        next.delete('/public/contentIndex.json');
        return next;
      });
      setMessage(res.message);
      return res.programId ?? payload.id;
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'No se pudo crear el programa.');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const deleteProgram = async (payload: DeleteProgramPayload): Promise<boolean> => {
    if (!active) return false;
    setSaving(true);
    try {
      const res = await devEditorService.deleteProgram(payload);
      const content = await devEditorService.fetchContentIndex();
      setContentIndex(content);
      setBaseContentIndex(clone(content));
      setEpisodesByProgram((prev) => {
        const next = { ...prev };
        delete next[payload.id];
        return next;
      });
      setEpisodesTrashByProgram((prev) => {
        const next = { ...prev };
        delete next[payload.id];
        return next;
      });
      setDirtyFiles((prev) => {
        const next = new Set(prev);
        next.delete('/public/contentIndex.json');
        next.delete(`/public/episodes/${payload.id}.json`);
        next.delete(`/public/episodes/trash/${payload.id}.json`);
        return next;
      });
      setMessage(res.message);
      return true;
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'No se pudo eliminar el programa.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const isDirty =
    dirtyFiles.size > 0 ||
    JSON.stringify(baseContentIndex) !== JSON.stringify(contentIndex) ||
    JSON.stringify(baseEditorial) !== JSON.stringify(editorial);

  const value: EditorContextValue = {
    enabled: active,
    authenticated,
    loading,
    saving,
    isDirty,
    message,
    contentIndex,
    editorial,
    episodesByProgram,
    episodesTrashByProgram,
    auth,
    logout,
    updateContentField,
    commitContentField,
    commitContentFieldLocalized,
    commitContentFieldAllLanguages,
    commitMultipleContentFieldsAllLanguages,
    updateEditorialField,
    commitEditorialField,
    commitEditorialFieldLocalized,
    commitAboutCredits,
    createProgram,
    deleteProgram,
    loadEpisodes,
    updateEpisodeField,
    commitEpisodeField,
    addEpisode,
    removeEpisode,
    restoreEpisode,
    purgeEpisode,
    save,
    publish,
    translateText,
  };

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
};

export const useEditor = (): EditorContextValue => {
  const context = React.useContext(EditorContext);
  if (!context) {
    throw new Error('useEditor must be used within EditorProvider');
  }
  return context;
};

export const useOptionalEditor = (): EditorContextValue | null => React.useContext(EditorContext);
