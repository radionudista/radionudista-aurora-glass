import React from 'react';
import { useLocation } from 'react-router-dom';
import { env } from '../config/env';
import {
  type AboutCreditsData,
  type ContentIndexData,
  type EditorLanguage,
  type EditorialData,
  type ProgramEpisodesData,
  type ProgramEpisodesTrashData,
  defaultAboutCredits,
} from '../editor/contracts';
import type { SavePayload } from '../editor/contentMappers';
import {
  devEditorService,
  type CreateProgramPayload,
  type DeleteProgramPayload,
} from '../services/devEditorService';
import { editorSupabaseService } from '../services/editorSupabaseService';
import { isValidEpisodeDateIso, sortEpisodesChronologicallyDesc } from '../utils/episodeOrder';
import {
  fetchEditorContentIndexFromSupabase,
  fetchEditorialFromSupabase,
} from '../services/supabaseContentService';
import {
  getSupabaseClient,
  getSupabaseSession,
  isEditorAvailable,
  subscribeAuth,
} from '../lib/supabaseClient';
import {
  canEditEditorial as profileCanEditEditorial,
  canEditProgram as profileCanEditProgram,
  canManagePrograms as profileCanManagePrograms,
  fetchEditorProfile,
  type EditorProfile,
  type EditorRole,
} from '../services/editorProfileService';
import { useOptionalPublicContent } from './PublicContentContext';
import { mapRouteToContentIndexLanguage } from '../utils/contentLanguage';
import { queryClient } from '../lib/queryClient';

type LocalizedTextValues = Record<EditorLanguage, string>;

interface EditorContextValue {
  enabled: boolean;
  authenticated: boolean;
  role: EditorRole | null;
  isAdmin: boolean;
  assignedProgramId: string | null;
  canEditProgram: (programId: string) => boolean;
  canEditEditorial: () => boolean;
  canManagePrograms: () => boolean;
  loading: boolean;
  saving: boolean;
  isDirty: boolean;
  message: string | null;
  contentIndex: ContentIndexData;
  editorial: EditorialData;
  episodesByProgram: Record<string, ProgramEpisodesData>;
  episodesTrashByProgram: Record<string, ProgramEpisodesTrashData>;
  logout: () => Promise<void>;
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
  commitContentFieldAllLanguages: (programId: string, field: string, value: unknown) => Promise<void>;
  applyUploadedProgramLogo: (programId: string, url: string, uploadMessage: string) => Promise<void>;
  applyUploadedEpisodeCover: (
    programId: string,
    episodeId: string,
    url: string,
    uploadMessage: string
  ) => Promise<void>;
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
  commitHomeDefaultHeroImage: (url: string) => Promise<void>;
  applyUploadedHomeHero: (url: string, uploadMessage: string) => Promise<void>;
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
  removeEpisode: (programId: string, episodeId: string) => Promise<void>;
  restoreEpisode: (programId: string, episodeId: string) => Promise<void>;
  purgeEpisode: (programId: string, episodeId: string) => Promise<void>;
  save: () => Promise<void>;
  publish: () => Promise<void>;
  translateText: (
    text: string
  ) => Promise<{ translated: Pick<LocalizedTextValues, 'en' | 'pt'>; usedChars: number; remainingChars: number; month: string }>;
}

const EditorContext = React.createContext<EditorContextValue | null>(null);

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const emptyEditorial = (): EditorialData => ({
  home: {
    manifestKicker: { es: '', pt: '', en: '' },
    manifestTitle: { es: '', pt: '', en: '' },
    manifestSubtitle: { es: '', pt: '', en: '' },
    joinPanelCopy: { es: '', pt: '', en: '' },
    defaultHeroImageUrl: '',
  },
  about: {
    heroTitle: { es: '', pt: '', en: '' },
    lead: { es: '', pt: '', en: '' },
    paragraph1: { es: '', pt: '', en: '' },
    paragraph2: { es: '', pt: '', en: '' },
    credits: defaultAboutCredits,
  },
  contact: {
    pageTitle: { es: '', pt: '', en: '' },
    pageSubtitle: { es: '', pt: '', en: '' },
  },
});

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
  const publicContent = useOptionalPublicContent();
  const location = useLocation();
  const routeLang = React.useMemo(() => {
    const segment = location.pathname.split('/').filter(Boolean)[0];
    return mapRouteToContentIndexLanguage(segment ?? env.DEFAULT_LANGUAGE);
  }, [location.pathname]);

  const refreshPublicContent = React.useCallback(
    async (programId?: string) => {
      await publicContent?.reload({ silent: true });
      const invalidations: Promise<void>[] = [
        queryClient.invalidateQueries({ queryKey: ['program-episodes'] }),
        queryClient.invalidateQueries({ queryKey: ['episodes'] }),
        queryClient.invalidateQueries({ queryKey: ['home-episodes-for-event'] }),
      ];
      if (programId) {
        invalidations.push(
          queryClient.invalidateQueries({ queryKey: ['program-episodes', programId] })
        );
      }
      await Promise.all(invalidations);
    },
    [publicContent]
  );
  const editorAvailable = isEditorAvailable();
  const [authenticated, setAuthenticated] = React.useState(false);
  const [profile, setProfile] = React.useState<EditorProfile | null>(null);
  const active = editorAvailable && authenticated && Boolean(profile) && !profile?.disabledAt;

  const canEditProgram = React.useCallback(
    (programId: string) => profileCanEditProgram(profile, programId),
    [profile]
  );
  const canEditEditorial = React.useCallback(() => profileCanEditEditorial(profile), [profile]);
  const canManagePrograms = React.useCallback(() => profileCanManagePrograms(profile), [profile]);

  const denyProgramEdit = React.useCallback((programId: string): boolean => {
    if (canEditProgram(programId)) return false;
    setMessage('No tenés permiso para editar este programa.');
    return true;
  }, [canEditProgram]);

  const denyEditorialEdit = React.useCallback((): boolean => {
    if (canEditEditorial()) return false;
    setMessage('Solo administradores pueden editar textos del sitio.');
    return true;
  }, [canEditEditorial]);

  const denyManagePrograms = React.useCallback((): boolean => {
    if (canManagePrograms()) return false;
    setMessage('Solo administradores pueden gestionar programas.');
    return true;
  }, [canManagePrograms]);
  const [loading, setLoading] = React.useState(editorAvailable);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [contentIndex, setContentIndex] = React.useState<ContentIndexData>(
    () => publicContent?.contentIndex ?? {}
  );
  const [editorial, setEditorial] = React.useState<EditorialData>(
    () => publicContent?.editorial ?? emptyEditorial()
  );
  const [episodesByProgram, setEpisodesByProgram] = React.useState<Record<string, ProgramEpisodesData>>({});
  const [episodesTrashByProgram, setEpisodesTrashByProgram] = React.useState<
    Record<string, ProgramEpisodesTrashData>
  >({});
  const [baseContentIndex, setBaseContentIndex] = React.useState<ContentIndexData>({});
  const [baseEditorial, setBaseEditorial] = React.useState<EditorialData>(emptyEditorial());
  const [baseEpisodesByProgram, setBaseEpisodesByProgram] = React.useState<
    Record<string, ProgramEpisodesData>
  >({});
  const [baseEpisodesTrashByProgram, setBaseEpisodesTrashByProgram] = React.useState<
    Record<string, ProgramEpisodesTrashData>
  >({});

  React.useEffect(() => {
    void getSupabaseSession().then((session) => setAuthenticated(Boolean(session)));
    return subscribeAuth((session) => setAuthenticated(Boolean(session)));
  }, []);

  React.useEffect(() => {
    if (!authenticated) {
      setProfile(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const nextProfile = await fetchEditorProfile();
        if (cancelled) return;
        if (!nextProfile) {
          const client = getSupabaseClient();
          if (client) await client.auth.signOut();
          setAuthenticated(false);
          setProfile(null);
          setMessage('No tenés perfil de editor. Contactá a un administrador.');
          return;
        }
        if (nextProfile.disabledAt) {
          const client = getSupabaseClient();
          if (client) await client.auth.signOut();
          setAuthenticated(false);
          setProfile(null);
          setMessage('Tu cuenta de editor está desactivada.');
          return;
        }
        if (nextProfile.role === 'editor' && !nextProfile.programId) {
          const client = getSupabaseClient();
          if (client) await client.auth.signOut();
          setAuthenticated(false);
          setProfile(null);
          setMessage('Tu cuenta no tiene un programa asignado.');
          return;
        }
        setProfile(nextProfile);
      } catch (error) {
        if (cancelled) return;
        setProfile(null);
        setMessage(error instanceof Error ? error.message : 'Error al cargar perfil de editor.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authenticated]);

  React.useEffect(() => {
    if (authenticated) return;
    if (publicContent?.contentIndex) {
      setContentIndex(publicContent.contentIndex);
      setBaseContentIndex(clone(publicContent.contentIndex));
    }
    if (publicContent?.editorial) {
      setEditorial(publicContent.editorial);
      setBaseEditorial(clone(publicContent.editorial));
    }
  }, [publicContent?.contentIndex, publicContent?.editorial, authenticated]);

  const sortEpisodesByDateDesc = React.useCallback(
    (episodes: ProgramEpisodesData['episodes']) => sortEpisodesChronologicallyDesc(episodes),
    []
  );

  const logout = React.useCallback(async () => {
    const client = getSupabaseClient();
    if (client) await client.auth.signOut();
    setAuthenticated(false);
    setProfile(null);
    setMessage('Modo editor desactivado.');
  }, []);

  React.useEffect(() => {
    if (!editorAvailable || !authenticated || !profile) {
      setLoading(false);
      return;
    }

    const loadInitialData = async () => {
      setLoading(true);
      try {
        const contentFilter =
          profile.role === 'editor' && profile.programId
            ? { programId: profile.programId }
            : undefined;
        const content = await fetchEditorContentIndexFromSupabase(contentFilter);
        if (content) {
          setContentIndex(content);
          setBaseContentIndex(clone(content));
        }
        if (profile.role === 'admin') {
          const editorialData = await fetchEditorialFromSupabase();
          if (editorialData) {
            setEditorial(editorialData);
            setBaseEditorial(clone(editorialData));
          }
        } else {
          setEditorial(emptyEditorial());
          setBaseEditorial(emptyEditorial());
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Error al cargar el editor.');
      } finally {
        setLoading(false);
      }
    };

    void loadInitialData();
  }, [authenticated, editorAvailable, profile]);

  React.useEffect(() => {
    if (!editorAvailable || !authenticated || !profile) return;

    const contentFilter =
      profile.role === 'editor' && profile.programId ? { programId: profile.programId } : undefined;

    const resyncFromDb = () => {
      if (document.hidden) return;
      void fetchEditorContentIndexFromSupabase(contentFilter)
        .then((content) => {
          if (!content) return;
          setContentIndex(content);
          setBaseContentIndex(clone(content));
        })
        .catch(() => undefined);
    };

    document.addEventListener('visibilitychange', resyncFromDb);
    return () => document.removeEventListener('visibilitychange', resyncFromDb);
  }, [authenticated, editorAvailable, profile]);

  const updateContentField = (programId: string, lang: EditorLanguage, field: string, value: unknown) => {
    setContentIndex((prev) => {
      const next = clone(prev);
      const entry = next?.[programId] as Record<string, unknown> | undefined;
      if (!entry) return prev;
      const target = ensureLanguageEntry(entry, lang);
      target[field] = value;
      return next;
    });
  };

  const commitContentField = async (
    programId: string,
    lang: EditorLanguage,
    field: string,
    value: unknown
  ) => {
    if (denyProgramEdit(programId)) return;
    const nextContent = clone(contentIndex);
    const entry = nextContent?.[programId] as Record<string, unknown> | undefined;
    if (!entry) return;
    const target = ensureLanguageEntry(entry, lang);
    target[field] = value;

    setContentIndex(nextContent);
    const response = await editorSupabaseService.savePayload({ contentIndex: nextContent });
    setBaseContentIndex(clone(nextContent));
    setMessage(response.message);
    await refreshPublicContent(programId);
  };

  const commitContentFieldLocalized = async (
    programId: string,
    field: string,
    values: LocalizedTextValues
  ) => {
    if (denyProgramEdit(programId)) return;
    const nextContent = clone(contentIndex);
    const entry = nextContent?.[programId];
    if (!entry) return;
    for (const lang of ['es', 'pt', 'en'] as const) {
      const target = ensureLanguageEntry(entry as unknown as Record<string, unknown>, lang);
      target[field] = values[lang];
    }
    setContentIndex(nextContent);
    const response = await editorSupabaseService.savePayload({ contentIndex: nextContent });
    setBaseContentIndex(clone(nextContent));
    setMessage(response.message);
    await refreshPublicContent(programId);
  };

  const commitContentFieldAllLanguages = async (programId: string, field: string, value: unknown) => {
    if (denyProgramEdit(programId)) return;
    const nextContent = clone(contentIndex);
    const entry = nextContent?.[programId];
    if (!entry) return;
    for (const lang of ['es', 'pt', 'en'] as const) {
      const target = ensureLanguageEntry(entry as unknown as Record<string, unknown>, lang);
      target[field] = value;
    }
    setContentIndex(nextContent);
    const response = await editorSupabaseService.savePayload({ contentIndex: nextContent });
    setBaseContentIndex(clone(nextContent));
    setMessage(response.message);
    await refreshPublicContent(programId);
  };

  /** Tras subir logo: Storage + logo_url ya están en DB; sincroniza estado local y contenido público. */
  const applyUploadedProgramLogo = async (programId: string, url: string, uploadMessage: string) => {
    if (denyProgramEdit(programId)) return;
    setContentIndex((prev) => {
      const next = clone(prev);
      const entry = next[programId];
      if (!entry) return prev;
      for (const lang of ['es', 'pt', 'en'] as const) {
        ensureLanguageEntry(entry as unknown as Record<string, unknown>, lang).logo = url;
      }
      return next;
    });
    setBaseContentIndex((prev) => {
      const next = clone(prev);
      const entry = next[programId];
      if (!entry) return prev;
      for (const lang of ['es', 'pt', 'en'] as const) {
        ensureLanguageEntry(entry as unknown as Record<string, unknown>, lang).logo = url;
      }
      return next;
    });

    const contentFilter =
      profile?.role === 'editor' && profile.programId ? { programId: profile.programId } : undefined;
    const content = await fetchEditorContentIndexFromSupabase(contentFilter);
    if (content) {
      setContentIndex(content);
      setBaseContentIndex(clone(content));
    }
    setMessage(uploadMessage);
    await refreshPublicContent(programId);
  };

  /** Tras subir portada: episodes.cover_image_url ya está en DB. */
  const applyUploadedEpisodeCover = async (
    programId: string,
    episodeId: string,
    url: string,
    uploadMessage: string
  ) => {
    if (denyProgramEdit(programId)) return;
    setEpisodesByProgram((prev) => {
      const next = clone(prev);
      const program = next[programId];
      if (!program) return prev;
      const episode = program.episodes.find((item) => item.id === episodeId);
      if (!episode) return prev;
      episode.coverImage = url;
      return next;
    });
    setBaseEpisodesByProgram((prev) => {
      const next = clone(prev);
      const program = next[programId];
      if (!program) return prev;
      const episode = program.episodes.find((item) => item.id === episodeId);
      if (!episode) return prev;
      episode.coverImage = url;
      return next;
    });

    episodesLoaded.current.delete(programId);
    await loadEpisodes(programId);
    setMessage(uploadMessage);
    await refreshPublicContent(programId);
  };

  const commitMultipleContentFieldsAllLanguages = async (
    programId: string,
    fields: Record<string, unknown>
  ) => {
    if (denyProgramEdit(programId)) return;
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
    const response = await editorSupabaseService.savePayload({ contentIndex: nextContent });
    setBaseContentIndex(clone(nextContent));
    setMessage(response.message);
    await refreshPublicContent(programId);
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
  };

  const episodesLoadInFlight = React.useRef(new Map<string, Promise<void>>());
  const episodesLoaded = React.useRef(new Set<string>());

  const loadEpisodes = React.useCallback(async (programId: string) => {
    if (!profileCanEditProgram(profile, programId)) return;
    if (episodesLoaded.current.has(programId)) return;

    const inFlight = episodesLoadInFlight.current.get(programId);
    if (inFlight) return inFlight;

    const promise = (async () => {
      const bundle = await devEditorService.fetchProgramEpisodesBundle(programId, routeLang);
      episodesLoaded.current.add(programId);
      setEpisodesByProgram((prev) => ({ ...prev, [programId]: bundle.active }));
      setBaseEpisodesByProgram((prev) => ({ ...prev, [programId]: clone(bundle.active) }));
      setEpisodesTrashByProgram((prev) => ({ ...prev, [programId]: bundle.trash }));
      setBaseEpisodesTrashByProgram((prev) => ({ ...prev, [programId]: clone(bundle.trash) }));
    })().finally(() => {
      episodesLoadInFlight.current.delete(programId);
    });

    episodesLoadInFlight.current.set(programId, promise);
    return promise;
  }, [routeLang, profile]);

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
  };

  const commitEpisodeField = async (
    programId: string,
    episodeId: string,
    field: string,
    value: unknown
  ) => {
    if (denyProgramEdit(programId)) return;
    const sourceProgram =
      episodesByProgram[programId] ??
      (await devEditorService.fetchProgramEpisodes(programId).catch(
        () => ({ programId, episodes: [] } as ProgramEpisodesData)
      ));

    const nextProgram = clone(sourceProgram);
    const episode = nextProgram.episodes.find((item) => item.id === episodeId) as Record<string, unknown> | undefined;
    if (!episode) return;
    if (field === 'date') {
      const normalized = String(value).trim();
      if (!isValidEpisodeDateIso(normalized)) {
        setMessage('Fecha inválida. Usa AAAA-MM-DD.');
        return;
      }
      value = normalized;
    }
    episode[field] = value;

    setEpisodesByProgram((prev) => ({ ...prev, [programId]: nextProgram }));
    const response = await editorSupabaseService.savePayload({
      episodesByProgram: { [programId]: nextProgram },
      episodeTranslationLang: routeLang,
    });
    setBaseEpisodesByProgram((prev) => ({ ...prev, [programId]: clone(nextProgram) }));
    setMessage(response.message);
    await refreshPublicContent(programId);
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
    if (denyProgramEdit(programId)) return null;
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
    const response = await editorSupabaseService.savePayload({
      episodesByProgram: { [programId]: nextProgram },
      episodeTranslationLang: routeLang,
    });
    setBaseEpisodesByProgram((prev) => ({ ...prev, [programId]: clone(nextProgram) }));
    setMessage(response.message);
    await refreshPublicContent(programId);
    return newEpisodeId;
  };

  const removeEpisode = async (programId: string, episodeId: string) => {
    if (!active) return;
    if (denyProgramEdit(programId)) return;

    const sourceProgram =
      episodesByProgram[programId] ??
      (await devEditorService.fetchProgramEpisodes(programId, routeLang).catch(
        () => ({ programId, episodes: [] } as ProgramEpisodesData)
      ));
    const episode = sourceProgram.episodes.find((item) => item.id === episodeId);
    if (!episode) return;

    const nextActive: ProgramEpisodesData = {
      programId,
      episodes: sourceProgram.episodes.filter((item) => item.id !== episodeId),
    };
    const trash = episodesTrashByProgram[programId] ?? { programId, episodes: [] };
    const nextTrash: ProgramEpisodesTrashData = {
      programId,
      episodes: sortEpisodesByDateDesc([
        ...trash.episodes.filter((item) => item.id !== episodeId),
        episode,
      ]),
    };

    setEpisodesByProgram((prev) => ({ ...prev, [programId]: nextActive }));
    setEpisodesTrashByProgram((prev) => ({ ...prev, [programId]: nextTrash }));

    try {
      await editorSupabaseService.setEpisodeDeletedAt(
        programId,
        episodeId,
        new Date().toISOString()
      );
      setBaseEpisodesByProgram((prev) => ({ ...prev, [programId]: clone(nextActive) }));
      setBaseEpisodesTrashByProgram((prev) => ({ ...prev, [programId]: clone(nextTrash) }));
      setMessage('Episodio movido a la papelera.');
      await refreshPublicContent(programId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo mover a la papelera.');
      episodesLoaded.current.delete(programId);
      await loadEpisodes(programId);
    }
  };

  const restoreEpisode = async (programId: string, episodeId: string) => {
    if (!active) return;
    if (denyProgramEdit(programId)) return;

    const trash = episodesTrashByProgram[programId];
    const episode = trash?.episodes.find((item) => item.id === episodeId);
    if (!episode) return;

    const nextTrash: ProgramEpisodesTrashData = {
      programId,
      episodes: trash.episodes.filter((item) => item.id !== episodeId),
    };
    const activeProgram = episodesByProgram[programId] ?? { programId, episodes: [] };
    const nextActive: ProgramEpisodesData = {
      programId,
      episodes: sortEpisodesByDateDesc([
        ...activeProgram.episodes.filter((item) => item.id !== episodeId),
        episode,
      ]),
    };

    setEpisodesTrashByProgram((prev) => ({ ...prev, [programId]: nextTrash }));
    setEpisodesByProgram((prev) => ({ ...prev, [programId]: nextActive }));

    try {
      await editorSupabaseService.setEpisodeDeletedAt(programId, episodeId, null);
      setBaseEpisodesTrashByProgram((prev) => ({ ...prev, [programId]: clone(nextTrash) }));
      setBaseEpisodesByProgram((prev) => ({ ...prev, [programId]: clone(nextActive) }));
      setMessage('Episodio restaurado.');
      await refreshPublicContent(programId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo restaurar el episodio.');
      episodesLoaded.current.delete(programId);
      await loadEpisodes(programId);
    }
  };

  const purgeEpisode = async (programId: string, episodeId: string) => {
    if (denyProgramEdit(programId)) return;
    setEpisodesTrashByProgram((prev) => {
      const next = clone(prev);
      const trash = next[programId];
      if (!trash) return prev;
      trash.episodes = trash.episodes.filter((item) => item.id !== episodeId);
      return next;
    });
    if (active) {
      await editorSupabaseService.purgeEpisode(programId, episodeId);
      setBaseEpisodesTrashByProgram((prev) => {
        const next = clone(prev);
        const trash = next[programId];
        if (trash) trash.episodes = trash.episodes.filter((item) => item.id !== episodeId);
        return next;
      });
      setMessage('Episodio eliminado permanentemente.');
      await refreshPublicContent(programId);
    }
  };

  const buildPayload = (): SavePayload => {
    const payload: SavePayload = {};

    if (JSON.stringify(baseContentIndex) !== JSON.stringify(contentIndex)) {
      payload.contentIndex = contentIndex;
    }

    if (JSON.stringify(baseEditorial) !== JSON.stringify(editorial)) {
      payload.editorial = editorial;
    }

    const episodesPayload: Record<string, ProgramEpisodesData> = {};
    const allProgramIds = new Set([
      ...Object.keys(episodesByProgram),
      ...Object.keys(baseEpisodesByProgram),
    ]);
    allProgramIds.forEach((programId) => {
      const current = episodesByProgram[programId];
      const base = baseEpisodesByProgram[programId];
      if (JSON.stringify(current) !== JSON.stringify(base) && current) {
        episodesPayload[programId] = current;
      }
    });
    if (Object.keys(episodesPayload).length > 0) {
      payload.episodesByProgram = episodesPayload;
    }

    const episodesTrashPayload: Record<string, ProgramEpisodesTrashData> = {};
    const allTrashIds = new Set([
      ...Object.keys(episodesTrashByProgram),
      ...Object.keys(baseEpisodesTrashByProgram),
    ]);
    allTrashIds.forEach((programId) => {
      const current = episodesTrashByProgram[programId];
      const base = baseEpisodesTrashByProgram[programId];
      if (JSON.stringify(current) !== JSON.stringify(base) && current) {
        episodesTrashPayload[programId] = current;
      }
    });
    if (Object.keys(episodesTrashPayload).length > 0) {
      payload.episodesTrashByProgram = episodesTrashPayload;
    }

    if (payload.episodesByProgram || payload.episodesTrashByProgram) {
      payload.episodeTranslationLang = routeLang;
    }

    return payload;
  };

  const save = async () => {
    if (!active) return;
    setSaving(true);
    try {
      const response = await editorSupabaseService.savePayload(buildPayload());
      setBaseContentIndex(clone(contentIndex));
      setBaseEditorial(clone(editorial));
      setBaseEpisodesByProgram(clone(episodesByProgram));
      setBaseEpisodesTrashByProgram(clone(episodesTrashByProgram));
      setMessage(response.message);
      await refreshPublicContent();
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    if (!active) return;
    setSaving(true);
    try {
      const response = await editorSupabaseService.publish(buildPayload());
      setBaseContentIndex(clone(contentIndex));
      setBaseEditorial(clone(editorial));
      setBaseEpisodesByProgram(clone(episodesByProgram));
      setBaseEpisodesTrashByProgram(clone(episodesTrashByProgram));
      setMessage(response.message);
      await refreshPublicContent();
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
    if (denyEditorialEdit()) return;
    const nextEditorial = clone(editorial);
    const target = (nextEditorial[section] as Record<string, unknown>)[field] as Record<string, string> | undefined;
    if (!target) return;
    target[lang] = value;

    setEditorial(nextEditorial);
    const response = await editorSupabaseService.savePayload({ editorial: nextEditorial });
    setBaseEditorial(clone(nextEditorial));
    setMessage(response.message);
    await refreshPublicContent();
  };

  const commitEditorialFieldLocalized = async (
    section: keyof EditorialData,
    field: string,
    values: LocalizedTextValues
  ) => {
    if (denyEditorialEdit()) return;
    const nextEditorial = clone(editorial);
    const target = (nextEditorial[section] as Record<string, unknown>)[field] as
      | Record<string, string>
      | undefined;
    if (!target) return;
    target.es = values.es;
    target.pt = values.pt;
    target.en = values.en;

    setEditorial(nextEditorial);
    const response = await editorSupabaseService.savePayload({ editorial: nextEditorial });
    setBaseEditorial(clone(nextEditorial));
    setMessage(response.message);
    await refreshPublicContent();
  };

  const translateText: EditorContextValue['translateText'] = async (text) => {
    if (!active) throw new Error('La traducción solo está disponible con el editor activo.');
    return devEditorService.translateText({ text, source: 'es', targets: ['en', 'pt'] });
  };

  const commitAboutCredits = async (nextCredits: AboutCreditsData) => {
    if (denyEditorialEdit()) return;
    const nextEditorial = clone(editorial);
    nextEditorial.about = { ...nextEditorial.about, credits: nextCredits };
    setEditorial(nextEditorial);
    const response = await editorSupabaseService.savePayload({ editorial: nextEditorial });
    setBaseEditorial(clone(nextEditorial));
    setMessage(response.message);
    await refreshPublicContent();
  };

  const commitHomeDefaultHeroImage = async (url: string) => {
    if (denyEditorialEdit()) return;
    const nextEditorial = clone(editorial);
    nextEditorial.home = { ...nextEditorial.home, defaultHeroImageUrl: url };
    setEditorial(nextEditorial);
    const response = await editorSupabaseService.savePayload({ editorial: nextEditorial });
    setBaseEditorial(clone(nextEditorial));
    setMessage(response.message);
    await refreshPublicContent();
  };

  const applyUploadedHomeHero = async (url: string, uploadMessage: string) => {
    if (denyEditorialEdit()) return;
    const nextEditorial = clone(editorial);
    nextEditorial.home = { ...nextEditorial.home, defaultHeroImageUrl: url };
    setEditorial(nextEditorial);
    const response = await editorSupabaseService.savePayload({ editorial: nextEditorial });
    setBaseEditorial(clone(nextEditorial));
    setMessage(response.message || uploadMessage);
    await refreshPublicContent();
  };

  const createProgram = async (payload: CreateProgramPayload): Promise<string | null> => {
    if (!active) return null;
    if (denyManagePrograms()) return null;
    setSaving(true);
    try {
      const res = await editorSupabaseService.createProgram(payload);
      const programId = res.programId ?? payload.id;
      setContentIndex((prev) => ({ ...prev, ...res.contentIndexPatch }));
      setBaseContentIndex((prev) => ({ ...prev, ...clone(res.contentIndexPatch) }));
      const emptyEpisodes = { programId, episodes: [] as ProgramEpisodesData['episodes'] };
      setEpisodesByProgram((prev) => ({ ...prev, [programId]: emptyEpisodes }));
      setBaseEpisodesByProgram((prev) => ({ ...prev, [programId]: clone(emptyEpisodes) }));
      setEpisodesTrashByProgram((prev) => ({ ...prev, [programId]: emptyEpisodes }));
      setBaseEpisodesTrashByProgram((prev) => ({ ...prev, [programId]: clone(emptyEpisodes) }));
      episodesLoaded.current.add(programId);
      setMessage(res.message);
      await refreshPublicContent(programId);
      return programId;
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'No se pudo crear el programa.');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const deleteProgram = async (payload: DeleteProgramPayload): Promise<boolean> => {
    if (!active) return false;
    if (denyManagePrograms()) return false;
    if (denyProgramEdit(payload.id)) return false;
    setSaving(true);
    try {
      const res = await editorSupabaseService.deleteProgram(payload);
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
      setBaseEpisodesByProgram((prev) => {
        const next = { ...prev };
        delete next[payload.id];
        return next;
      });
      setBaseEpisodesTrashByProgram((prev) => {
        const next = { ...prev };
        delete next[payload.id];
        return next;
      });
      episodesLoaded.current.delete(payload.id);
      setMessage(res.message);
      await refreshPublicContent(payload.id);
      return true;
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'No se pudo eliminar el programa.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const isDirty =
    JSON.stringify(baseContentIndex) !== JSON.stringify(contentIndex) ||
    JSON.stringify(baseEditorial) !== JSON.stringify(editorial) ||
    JSON.stringify(baseEpisodesByProgram) !== JSON.stringify(episodesByProgram) ||
    JSON.stringify(baseEpisodesTrashByProgram) !== JSON.stringify(episodesTrashByProgram);

  const value: EditorContextValue = {
    enabled: active,
    authenticated,
    role: profile?.role ?? null,
    isAdmin: profile?.role === 'admin',
    assignedProgramId: profile?.programId ?? null,
    canEditProgram,
    canEditEditorial,
    canManagePrograms,
    loading,
    saving,
    isDirty,
    message,
    contentIndex,
    editorial,
    episodesByProgram,
    episodesTrashByProgram,
    logout,
    updateContentField,
    commitContentField,
    commitContentFieldLocalized,
    commitContentFieldAllLanguages,
    applyUploadedProgramLogo,
    applyUploadedEpisodeCover,
    commitMultipleContentFieldsAllLanguages,
    updateEditorialField,
    commitEditorialField,
    commitEditorialFieldLocalized,
    commitAboutCredits,
    commitHomeDefaultHeroImage,
    applyUploadedHomeHero,
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
