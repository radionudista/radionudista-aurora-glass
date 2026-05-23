import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { env } from '../config/env';
import { episodeService } from '../services/episodeService';
import type { Episode } from '../types';
import NotFound from './NotFound';
import { accentCssFromHue, extractProgramAccentHue } from '../utils/imageAccent';
import { resolveCoverSrc } from '../utils/episodeCover';
import { PAGE_SCREEN_TITLE_CLASS } from '../constants/layoutConstants';
import { useContentIndexData } from '../hooks/useEditorContent';
import { useOptionalEditor } from '../contexts/EditorContext';
import { useArchivePlayer } from '../contexts/ArchivePlayerContext';
import EditableImageField from '../components/EditableImageField';
import EditableStringListItem from '../components/EditableStringListItem';
import InlineEditableText from '../components/InlineEditableText';
import { mapUiLanguageToContentLanguage } from '../utils/contentLanguage';
import { devEditorService } from '../services/devEditorService';
import {
  formatProgramScheduleForViewer,
  isEpisodeReleased,
  isProgramScheduleMeta,
  type ProgramScheduleMeta,
} from '../utils/programSchedule';

interface ProgramMetadata {
  id: string;
  title: string;
  slug: string;
  content?: string;
  schedule?: string;
  talent?: string[];
  social?: string[];
  logo?: string;
  component?: string;
  public?: boolean | string;
  schedule_meta?: ProgramScheduleMeta;
}

const normalize = (value?: string): string => (value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim();

const EpisodeDetailPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const contentIndex = useContentIndexData();
  const editor = useOptionalEditor();
  const archivePlayer = useArchivePlayer();
  const { programId: routeProgramId, episodeId: routeEpisodeId } = useParams();
  const location = useLocation();
  const [accentHue, setAccentHue] = useState(38);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [location.pathname]);

  const getCurrentLang = (pathname: string, supportedLangs: string[]): string => {
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length > 0 && supportedLangs.includes(parts[0])) return parts[0];
    return supportedLangs[0];
  };

  const currentLang = getCurrentLang(location.pathname, env.SUPPORTED_LANGUAGES);
  const contentLang = mapUiLanguageToContentLanguage(currentLang);

  const program = useMemo(() => {
    if (!routeProgramId) return null;
    const allPrograms = Object.values(contentIndex)
      .map((entry) => entry[contentLang] as ProgramMetadata | undefined)
      .filter((entry): entry is ProgramMetadata => Boolean(entry))
      .filter((entry) => entry.component === 'ProgramPage' && (entry.public === true || entry.public === 'true'));

    return allPrograms.find(
      (entry) =>
        normalize(entry.id) === normalize(routeProgramId)
        || normalize(entry.slug) === normalize(routeProgramId)
    ) || null;
  }, [contentIndex, contentLang, routeProgramId]);

  const archiveProgramId = program?.id ?? '';

  const { data: archiveData, isLoading, isError } = useQuery({
    queryKey: ['program-episodes', archiveProgramId],
    queryFn: () => episodeService.getEpisodesByProgram(archiveProgramId),
    enabled: Boolean(program?.id),
  });

  React.useEffect(() => {
    if (editor?.enabled && archiveProgramId) {
      void editor.loadEpisodes(archiveProgramId);
    }
  }, [archiveProgramId, editor]);

  const activeArchiveData = React.useMemo(() => {
    if (!archiveProgramId) return archiveData;
    if (editor?.enabled && editor.episodesByProgram[archiveProgramId]) {
      return editor.episodesByProgram[archiveProgramId];
    }
    return archiveData;
  }, [archiveData, archiveProgramId, editor]);

  const episode = useMemo(() => {
    if (!activeArchiveData?.episodes || !routeEpisodeId) return null;
    return activeArchiveData.episodes.find(
      (e) => normalize(e.id) === normalize(routeEpisodeId)
    ) ?? null;
  }, [activeArchiveData, routeEpisodeId]);

  const sortedEpisodes = useMemo(() => {
    const list = activeArchiveData?.episodes ?? [];
    return [...list].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [activeArchiveData]);

  const episodeSlot = useMemo(() => {
    if (!episode) return null;
    const idx = sortedEpisodes.findIndex((e) => e.id === episode.id);
    if (idx < 0) return null;
    return { n: idx + 1, total: sortedEpisodes.length };
  }, [episode, sortedEpisodes]);

  const logoSrc = program?.logo ? `/images/logos/${program.logo}` : null;

  useEffect(() => {
    if (!logoSrc) {
      setAccentHue(38);
      return;
    }
    let cancelled = false;
    extractProgramAccentHue(logoSrc).then((hue) => {
      if (!cancelled) setAccentHue(hue);
    });
    return () => {
      cancelled = true;
    };
  }, [logoSrc]);

  const accentVars = useMemo(() => {
    const c = accentCssFromHue(accentHue);
    return {
      '--program-accent': c.accent,
      '--program-accent-mid': c.accentMid,
      '--program-accent-soft': c.accentSoft,
      '--program-accent-fg': c.accentFg,
    } as React.CSSProperties;
  }, [accentHue]);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
    [i18n.language]
  );

  const programDetailPath = program ? `/${currentLang}/programacion/${encodeURIComponent(program.id)}` : null;
  const programacionPath = `/${currentLang}/programacion`;

  const playThisEpisode = (ep: Episode) => {
    archivePlayer.openEpisode({
      episodeId: ep.id,
      audioUrl: ep.audioUrl,
      title: `${program.title} / ${ep.title}`,
    });
  };

  if (!program || !routeEpisodeId) return <NotFound />;

  if (isLoading) {
    return (
      <div className="min-h-[calc(100dvh-5rem)] bg-black text-white" style={accentVars}>
        <div className="mx-auto max-w-6xl px-5 py-16">
          <div className="h-8 w-48 animate-pulse bg-white/10" />
          <div className="mt-8 h-12 w-3/4 max-w-xl animate-pulse bg-white/10" />
          <div className="mt-4 h-24 w-full max-w-2xl animate-pulse bg-white/5" />
        </div>
      </div>
    );
  }

  if (isError || !episode) return <NotFound />;

  // Block access until 1 hour after the scheduled broadcast time (non-editor users only).
  const released = isEpisodeReleased(
    episode.date,
    isProgramScheduleMeta(program.schedule_meta) ? program.schedule_meta : null
  );
  if (!released && !editor?.enabled) {
    return (
      <div className="flex min-h-[calc(100dvh-5rem)] flex-col items-center justify-center bg-black px-6 text-center">
        <p className="font-['Space_Grotesk'] text-[10px] uppercase tracking-[0.2em] text-white/40">
          {t('common.loading')}
        </p>
        <h2 className="mt-4 font-['Space_Grotesk'] text-2xl font-bold uppercase tracking-tight text-white md:text-4xl">
          {t('episode.not-yet-available', 'Todavía no disponible')}
        </h2>
        <p className="mt-4 max-w-md font-['Space_Grotesk'] text-sm leading-relaxed text-white/55">
          {t('episode.available-after-broadcast', 'Este episodio estará disponible una hora después de la transmisión.')}
        </p>
        {programDetailPath && (
          <Link
            to={programDetailPath}
            className="mt-8 inline-flex h-10 items-center border border-white/25 bg-transparent px-5 font-['Space_Grotesk'] text-[10px] uppercase tracking-[0.18em] text-white/75 transition hover:border-white/50 hover:text-white"
          >
            ← {program.title}
          </Link>
        )}
      </div>
    );
  }

  const coverSrc = resolveCoverSrc(episode, program.logo ?? null);
  const effectiveCollaborators = (episode.collaborators && episode.collaborators.length > 0)
    ? episode.collaborators
    : (program.talent ?? []);
  const talentLine = effectiveCollaborators.length ? effectiveCollaborators.join(' · ') : null;
  const programExcerpt = program.content?.replace(/\s+/g, ' ').trim().slice(0, 320);
  const scheduleLabel = isProgramScheduleMeta(program.schedule_meta)
    ? formatProgramScheduleForViewer(program.schedule_meta, new Date(), i18n.language || 'es')
    : program.schedule;
  const episodeTags = (episode.tags ?? []).map((tag) => tag.trim()).filter(Boolean);
  const commitEpisodeCollaborators = (nextCollaborators: string[]) =>
    editor?.enabled
      ? editor.commitEpisodeField(
          program.id,
          episode.id,
          'collaborators',
          nextCollaborators.map((item) => item.trim()).filter(Boolean)
        )
      : Promise.resolve();
  const commitEpisodeTags = (nextTags: string[]) =>
    editor?.enabled
      ? editor.commitEpisodeField(
          program.id,
          episode.id,
          'tags',
          nextTags.map((item) => item.trim()).filter(Boolean)
        )
      : Promise.resolve();
  const handleUploadEpisodeAudio = async (file: File) => {
    if (!editor?.enabled) return;
    const mimeType = file.type || 'audio/mpeg';
    if (!mimeType.startsWith('audio/')) {
      setUploadMessage('Selecciona un archivo de audio válido.');
      return;
    }
    setUploadingAudio(true);
    setUploadMessage('Subiendo audio a Archive.org...');
    try {
      const dataBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('No se pudo leer el archivo de audio.'));
        reader.onload = () => {
          const result = typeof reader.result === 'string' ? reader.result : '';
          const parts = result.split(',');
          if (parts.length < 2) {
            reject(new Error('Formato de archivo inválido.'));
            return;
          }
          resolve(parts[1]);
        };
        reader.readAsDataURL(file);
      });
      const response = await devEditorService.uploadEpisodeAudioToArchive({
        programId: program.id,
        episodeId: episode.id,
        episodeTitle: episode.title,
        date: episode.date,
        description: episode.description,
        tags: episodeTags,
        mimeType,
        fileName: file.name,
        dataBase64,
      });

      if (!response.ok || !response.audioUrl) {
        throw new Error(response.message || 'No se obtuvo URL de audio.');
      }

      await editor.commitEpisodeField(program.id, episode.id, 'audioUrl', response.audioUrl);
      if (response.identifier) {
        await editor.commitEpisodeField(program.id, episode.id, 'archiveIdentifier', response.identifier);
      }
      setUploadMessage(`Audio subido correctamente (${response.identifier ?? 'archive'}).`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido al subir audio.';
      setUploadMessage(message);
    } finally {
      setUploadingAudio(false);
    }
  };

  return (
    <div className="bg-black text-white" style={accentVars}>
      <div className="flex min-h-[calc(100dvh-5rem)] flex-col lg:min-h-[calc(100dvh-5rem)] lg:flex-row">
        <div className="flex flex-1 flex-col justify-between border-white/10 px-5 py-8 md:px-10 md:py-12 lg:max-w-[52%] lg:border-r lg:py-14 xl:px-14">
          <div>
            <nav className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/45">
              <Link to={programacionPath} className="transition-colors hover:text-[var(--program-accent)]">
                {t('episode-detail.breadcrumb-root')}
              </Link>
              <span className="mx-2 text-white/25">/</span>
              {programDetailPath && (
                <>
                  <Link to={programDetailPath} className="transition-colors hover:text-[var(--program-accent)]">
                    {program.title}
                  </Link>
                  <span className="mx-2 text-white/25">/</span>
                </>
              )}
              <span className="text-[var(--program-accent-fg)]">
                {episodeSlot
                  ? t('episode-detail.breadcrumb-episode-n', { n: episodeSlot.n, total: episodeSlot.total })
                  : t('episode-detail.breadcrumb-episode')}
              </span>
            </nav>

            {editor?.enabled ? (
              <InlineEditableText
                as="h1"
                size="lg"
                className="mt-8"
                textClassName={`${PAGE_SCREEN_TITLE_CLASS} leading-[0.95] tracking-tight text-white`}
                value={episode.title}
                onCommit={(next) => editor.commitEpisodeField(program.id, episode.id, 'title', next)}
              />
            ) : (
              <h1 className={`${PAGE_SCREEN_TITLE_CLASS} mt-8 leading-[0.95] tracking-tight text-white`}>
                {episode.title}
              </h1>
            )}

            <div className="mt-4 inline-flex max-w-full items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-white/50">
              <span>{dateFormatter.format(new Date(`${episode.date}T12:00:00`))}</span>
              <span className="text-white/25">·</span>
              <span>{t('episode-detail.duration')}</span>
              <span className="text-white/25">:</span>
              {editor?.enabled ? (
                <InlineEditableText
                  as="span"
                  className="!w-auto"
                  value={episode.duration}
                  onCommit={(next) => editor.commitEpisodeField(program.id, episode.id, 'duration', next)}
                />
              ) : (
                <span>{episode.duration}</span>
              )}
            </div>

            {(editor?.enabled || episode.description) && (
              <div className="mt-8 max-w-2xl font-['Space_Grotesk'] text-base leading-relaxed text-white/75 md:text-lg">
                {editor?.enabled ? (
                  <InlineEditableText
                    value={episode.description ?? ''}
                    multiline
                    textClassName="font-['Space_Grotesk'] text-base leading-relaxed text-white/75 md:text-lg"
                    onCommit={(next) => editor.commitEpisodeField(program.id, episode.id, 'description', next)}
                  />
                ) : (
                  episode.description
                )}
              </div>
            )}

            {(editor?.enabled || episodeTags.length > 0) && (
              <div className="mt-6 max-w-2xl">
                <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/40">
                  Tags
                </p>
                {editor?.enabled ? (
                  <div className="mt-2 inline-flex flex-wrap items-center gap-1.5">
                    {episodeTags.map((tag, idx) => (
                      <EditableStringListItem
                        key={`ep-tag-${idx}-${tag}`}
                        value={tag}
                        chipClassName="border-white/20 bg-black/30"
                        textClassName="text-[11px] text-white/80 uppercase"
                        onCommit={(next) => {
                          const tags = [...episodeTags];
                          tags[idx] = next;
                          return commitEpisodeTags(tags);
                        }}
                        onRemove={() => {
                          const tags = episodeTags.filter((_, i) => i !== idx);
                          return commitEpisodeTags(tags);
                        }}
                      />
                    ))}
                    <button
                      type="button"
                      onClick={() => void commitEpisodeTags([...episodeTags, 'nuevo tag'])}
                      className="inline-flex items-center gap-1 border border-dashed border-white/30 px-2 py-1 text-[10px] uppercase tracking-wider text-white/70 transition hover:border-white/55 hover:text-white"
                    >
                      <Plus size={12} strokeWidth={2} />
                      Añadir
                    </button>
                  </div>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {episodeTags.map((tag) => (
                      <span
                        key={`ep-tag-public-${tag}`}
                        className="border border-white/20 px-2 py-1 font-['Space_Grotesk'] text-[10px] uppercase tracking-[0.14em] text-white/75"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {episode.tracklist && episode.tracklist.length > 0 && (
              <div className="mt-10 max-w-xl">
                <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--program-accent-soft)]">
                  {t('episode-detail.tracklist')}
                </p>
                <ul className="mt-4 space-y-3 border-l border-dashed border-white/25 pl-5">
                  {episode.tracklist.map((line, i) => (
                    <li
                      key={`${i}-${line}`}
                      className="font-['Space_Grotesk'] text-sm leading-snug text-white/80 md:text-base"
                    >
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-12 border-t border-white/10 pt-8">
              <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--program-accent-soft)]">
              </p>
              <p className="mt-3 font-['Space_Grotesk'] text-xl font-bold uppercase tracking-tight text-white">
                {program.title}
              </p>
              {scheduleLabel && (
                <p className="mt-2 font-mono text-xs text-white/50">
                  {t('program-detail.schedule-label')}: {scheduleLabel}
                </p>
              )}
              {talentLine && (
                <p className="mt-1 font-mono text-xs text-white/50 whitespace-nowrap">
                  {t('program-detail.with')}{' '}
                  {editor?.enabled ? (
                    <span className="inline-flex flex-wrap items-center gap-1.5 align-middle whitespace-normal">
                      {effectiveCollaborators.map((person, idx) => (
                        <EditableStringListItem
                          key={`ep-collab-${idx}-${person}`}
                          value={person}
                          chipClassName="border-white/20 bg-black/30"
                          textClassName="text-xs text-white/85"
                          onCommit={(next) => {
                            const collaborators = [...effectiveCollaborators];
                            collaborators[idx] = next;
                            return commitEpisodeCollaborators(collaborators);
                          }}
                          onRemove={() => {
                            const collaborators = effectiveCollaborators.filter((_, i) => i !== idx);
                            return commitEpisodeCollaborators(collaborators);
                          }}
                        />
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          void commitEpisodeCollaborators([...effectiveCollaborators, 'Nueva persona'])
                        }
                        className="inline-flex items-center gap-1 border border-dashed border-white/30 px-2 py-1 text-[10px] uppercase tracking-wider text-white/70 transition hover:border-white/55 hover:text-white"
                      >
                        <Plus size={12} strokeWidth={2} />
                        Añadir
                      </button>
                    </span>
                  ) : (
                    talentLine
                  )}
                </p>
              )}
              {programExcerpt && (
                <p className="mt-4 line-clamp-5 font-['Space_Grotesk'] text-sm leading-relaxed text-white/60">
                  {programExcerpt}
                  {program.content && program.content.length > 320 ? '…' : ''}
                </p>
              )}
              {programDetailPath && (
                <Link
                  to={programDetailPath}
                  className="mt-5 inline-block font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--program-accent)] transition hover:text-white"
                >
                </Link>
              )}
            </div>
          </div>

          <div className="mt-12 lg:mt-16">
            <button
              type="button"
              onClick={() => playThisEpisode(episode)}
              className="group inline-flex items-center gap-4 border border-[color:color-mix(in_srgb,var(--program-accent)_55%,transparent)] bg-black/40 px-6 py-4 text-white transition hover:bg-[var(--program-accent)] hover:text-black"
            >
              <span className="inline-block h-0 w-0 border-y-[10px] border-y-transparent border-l-[16px] border-l-current" />
              <span className="font-['Space_Grotesk'] text-lg font-black uppercase tracking-[0.12em]">
                {t('episode-detail.listen')}
              </span>
            </button>
          </div>
        </div>

        <div className="relative min-h-[42vh] w-full lg:min-h-[calc(100dvh-5rem)] lg:flex-1">
          <img
            src={coverSrc}
            alt={episode.title}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20 lg:bg-gradient-to-l"
            aria-hidden
          />
          {editor?.enabled && (
            <div className="absolute bottom-4 right-4 z-20 flex w-[min(100%,24rem)] flex-col gap-2 drop-shadow-lg">
              <EditableImageField
                label="Portada del episodio"
                previewSrc={coverSrc}
                valueForEdit={episode.coverImage ?? ''}
                uploadScope="episode-cover"
                programId={program.id}
                episodeId={episode.id}
                onCommit={(next) =>
                  editor.commitEpisodeField(program.id, episode.id, 'coverImage', next)
                }
                helpText="Sube PNG/JPEG/WebP, o edita ruta (images/…) o URL. Vacío = logo del programa."
              />
              <label className="border border-white/30 bg-black/75 p-3 text-white/85 backdrop-blur-sm">
                <span className="block font-mono text-[10px] uppercase tracking-wider text-white/70">
                  Audio del episodio (Archive.org)
                </span>
                <input
                  type="file"
                  accept="audio/*"
                  className="mt-2 block w-full text-xs text-white/75 file:mr-2 file:border file:border-white/35 file:bg-black/70 file:px-2 file:py-1 file:text-[10px] file:uppercase file:tracking-wider file:text-white/85"
                  disabled={uploadingAudio}
                  onChange={(event) => {
                    const f = event.target.files?.[0];
                    if (f) void handleUploadEpisodeAudio(f);
                    event.currentTarget.value = '';
                  }}
                />
                <p className="mt-2 font-mono text-[10px] text-white/55 break-all">
                  {episode.audioUrl || 'Sin URL de audio'}
                </p>
                {uploadMessage ? (
                  <p className="mt-1 font-mono text-[10px] text-white/70">{uploadMessage}</p>
                ) : null}
              </label>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default EpisodeDetailPage;
