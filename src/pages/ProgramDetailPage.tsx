import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { env } from '../config/env';
import { episodeService } from '../services/episodeService';
import type { Episode } from '../types';
import NotFound from './NotFound';
import { accentCssFromHue, extractProgramAccentHue } from '../utils/imageAccent';
import { resolveCoverSrc } from '../utils/episodeCover';
import { sortEpisodesChronologicallyDesc } from '../utils/episodeOrder';
import { resolveProgramLogoSrc } from '../utils/programLogo';
import { PAGE_SCREEN_TITLE_CLASS } from '../constants/layoutConstants';
import { useContentIndexData } from '../hooks/useEditorContent';
import { useOptionalEditor } from '../contexts/EditorContext';
import { useArchivePlayer } from '../contexts/ArchivePlayerContext';
import { uploadEpisodeAudioDirectToArchive } from '../services/episodeArchiveUploadService';
import EditableImageField from '../components/EditableImageField';
import EditableStringListItem from '../components/EditableStringListItem';
import InlineEditableText from '../components/InlineEditableText';
import { mapRouteToContentIndexLanguage, resolveContentIndexEntry, resolveContentIndexString } from '../utils/contentLanguage';
import { useRouteLanguage } from '../hooks/useRouteLanguage';
import { buildLocalizedDraft } from '../utils/editorialText';
import {
  formatProgramScheduleForViewer,
  isEpisodeReleased,
  isProgramScheduleMeta,
  nearestPastOccurrence,
  scheduleMetaToLegacyString,
  type ProgramScheduleMeta,
} from '../utils/programSchedule';
import { isCalendarEventEntry } from '../editor/programUtils';
import type { ContentKind } from '../editor/contracts';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ProgramMetadata {
  id: string;
  title: string;
  slug: string;
  content?: string;
  audio_source?: string;
  schedule?: string;
  talent?: string[];
  social?: string[];
  logo?: string;
  program_order?: number;
  component?: string;
  public?: boolean | string;
  date?: string;
  language?: string;
  markdownfile?: string;
  menu?: string;
  menu_position?: number;
  schedule_meta?: ProgramScheduleMeta;
  content_kind?: ContentKind;
}

const normalize = (value?: string): string => (value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim();

const normalizeSocialHandle = (value: string): string =>
  value
    .trim()
    .replace(/^@+/, '')
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/\/+$/, '')
    .trim();

const ProgramDetailPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const contentIndex = useContentIndexData();
  const editor = useOptionalEditor();
  const archivePlayer = useArchivePlayer();
  const { programId } = useParams();
  const location = useLocation();
  const [accentHue, setAccentHue] = useState(38);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [showScheduleEditor, setShowScheduleEditor] = useState(false);
  const [scheduleDraft, setScheduleDraft] = useState<ProgramScheduleMeta | null>(null);
  const [createEpisodeOpen, setCreateEpisodeOpen] = useState(false);
  const [archiveView, setArchiveView] = useState<'active' | 'trash'>('active');
  const [purgeConfirmOpen, setPurgeConfirmOpen] = useState(false);
  const [episodeToPurge, setEpisodeToPurge] = useState<Episode | null>(null);
  const [newEpisodeTitle, setNewEpisodeTitle] = useState('');
  const [newEpisodeDate, setNewEpisodeDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newEpisodeDuration, setNewEpisodeDuration] = useState('00:00');
  const [newEpisodeDescription, setNewEpisodeDescription] = useState('');
  const [newEpisodeTags, setNewEpisodeTags] = useState('');
  const [newEpisodeFile, setNewEpisodeFile] = useState<File | null>(null);
  const [creatingEpisode, setCreatingEpisode] = useState(false);
  const [createEpisodeMessage, setCreateEpisodeMessage] = useState<string | null>(null);
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
  const routeLang = useRouteLanguage();
  const contentLang = mapRouteToContentIndexLanguage(currentLang);

  const program = useMemo(() => {
    if (!programId) return null;

    const target = normalize(programId);

    for (const [key, localized] of Object.entries(contentIndex)) {
      for (const probeLang of ['es', 'pt', 'en'] as const) {
        const candidate = localized[probeLang] as ProgramMetadata | undefined;
        if (!candidate || candidate.component !== 'ProgramPage') continue;
        if (candidate.public !== true && candidate.public !== 'true') continue;
        if (isCalendarEventEntry(candidate) && !editor?.enabled) continue;
        if (
          normalize(candidate.id) !== target
          && normalize(candidate.slug) !== target
          && normalize(key) !== target
        ) {
          continue;
        }

        const base = resolveContentIndexEntry<ProgramMetadata>(localized, contentLang);
        if (!base) return null;

        return {
          ...base,
          id: candidate.id || key,
          title: resolveContentIndexString(localized, contentLang, 'title') || base.title,
          content: resolveContentIndexString(localized, contentLang, 'content') || base.content || '',
        };
      }
    }

    return null;
  }, [contentIndex, contentLang, programId, editor?.enabled]);

  const isEvent = program ? isCalendarEventEntry(program) : false;
  const canEditThisProgram = Boolean(
    editor?.enabled && program?.id && editor.canEditProgram(program.id)
  );
  const canManagePrograms = Boolean(editor?.enabled && editor.canManagePrograms());
  const logoSrc = program?.logo ? resolveProgramLogoSrc(program.logo) : null;

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

  const excerpt = useMemo(() => {
    if (!program?.content) return null;
    const text = program.content.trim();
    if (!text) return null;
    return text.length > 240 ? `${text.slice(0, 237)}…` : text;
  }, [program]);

  const scheduleMeta = isProgramScheduleMeta(program?.schedule_meta)
    ? program.schedule_meta
    : null;
  const effectiveScheduleMeta =
    scheduleDraft ??
    scheduleMeta ?? {
      weekday: 1,
      startTime: '20:00',
      timezone: 'America/Argentina/Buenos_Aires',
    };
  // Always show the viewer's local time, using the draft when the editor is open
  const scheduleLocalized = effectiveScheduleMeta
    ? formatProgramScheduleForViewer(effectiveScheduleMeta, new Date(), i18n.language || 'es')
    : (program?.schedule || null);
  const scheduleSourceLabel = effectiveScheduleMeta
    ? formatProgramScheduleForViewer(effectiveScheduleMeta, new Date(), i18n.language || 'es', {
        includeSourceTimezone: true,
      })
    : null;
  const weekdayOptions = useMemo(() => {
    const locale = i18n.language || 'es';
    const formatter = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' });
    const mondayUtc = Date.UTC(2024, 0, 1); // Monday
    return Array.from({ length: 7 }, (_, idx) => {
      const d = new Date(mondayUtc + idx * 24 * 60 * 60 * 1000);
      return { value: idx + 1, label: formatter.format(d) };
    });
  }, [i18n.language]);
  const timezoneOptions = [
    { value: 'America/Argentina/Buenos_Aires', label: 'Argentina (Buenos Aires)' },
    { value: 'America/Sao_Paulo', label: 'Brasil (Sao Paulo)' },
    { value: 'America/Santiago', label: 'Chile (Santiago)' },
    { value: 'America/Bogota', label: 'Colombia (Bogota)' },
    { value: 'America/Mexico_City', label: 'Mexico (CDMX)' },
    { value: 'America/New_York', label: 'USA East (New York)' },
    { value: 'America/Los_Angeles', label: 'USA West (Los Angeles)' },
    { value: 'Europe/Madrid', label: 'España (Madrid)' },
    { value: 'Europe/Lisbon', label: 'Portugal (Lisboa)' },
    { value: 'Europe/London', label: 'UK (London)' },
  ];
  const talentLine = useMemo(() => {
    if (!program?.talent?.length) return null;
    return program.talent.join(' · ');
  }, [program]);
  const socialHandles = useMemo(
    () => (program?.social ?? []).map((item) => normalizeSocialHandle(item)).filter(Boolean),
    [program?.social]
  );

  const accentVars = useMemo(() => {
    const c = accentCssFromHue(accentHue);
    return {
      '--program-accent': c.accent,
      '--program-accent-mid': c.accentMid,
      '--program-accent-soft': c.accentSoft,
      '--program-accent-fg': c.accentFg,
    } as React.CSSProperties;
  }, [accentHue]);

  const archiveProgramId = program?.id ?? '';

  const { data: archiveData, isLoading: archiveLoading, isError: archiveError } = useQuery({
    queryKey: ['program-episodes', archiveProgramId, contentLang],
    queryFn: () => episodeService.getEpisodesByProgram(archiveProgramId, contentLang),
    enabled: Boolean(program?.id) && !canEditThisProgram,
  });

  React.useEffect(() => {
    if (canEditThisProgram && archiveProgramId) {
      void editor.loadEpisodes(archiveProgramId);
    }
  }, [archiveProgramId, canEditThisProgram, editor?.loadEpisodes]);

  const activeArchiveData = React.useMemo(() => {
    if (!archiveProgramId) return archiveData;
    const editorProgramEpisodes = editor?.episodesByProgram[archiveProgramId];
    if (canEditThisProgram && editorProgramEpisodes) {
      const hasEditorEpisodes = editorProgramEpisodes.episodes.length > 0;
      const hasArchiveEpisodes = (archiveData?.episodes.length ?? 0) > 0;
      if (hasEditorEpisodes || !hasArchiveEpisodes) {
        return editorProgramEpisodes;
      }
    }
    return archiveData;
  }, [archiveData, archiveProgramId, editor]);

  const sortedEpisodes = useMemo(
    () => sortEpisodesChronologicallyDesc(activeArchiveData?.episodes ?? []),
    [activeArchiveData]
  );
  const sortedTrashEpisodes = useMemo(
    () =>
      sortEpisodesChronologicallyDesc(
        canEditThisProgram ? editor.episodesTrashByProgram[archiveProgramId]?.episodes ?? [] : []
      ),
    [archiveProgramId, editor]
  );
  const visibleEpisodes = useMemo(() => {
    if (import.meta.env.DEV || canEditThisProgram) return sortedEpisodes;
    return sortedEpisodes.filter((ep) =>
      isEpisodeReleased(ep.date, scheduleMeta)
    );
  }, [canEditThisProgram, sortedEpisodes, scheduleMeta]);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
    [i18n.language]
  );

  if (!program) return <NotFound />;

  const programImageEditor = canEditThisProgram ? (
    <div className="absolute right-2 top-14 z-20 w-[min(100%,19rem)] md:right-4 md:top-20">
      <EditableImageField
        label="Imagen del programa"
        previewSrc={resolveProgramLogoSrc(program.logo)}
        valueForEdit={program.logo ?? ''}
        uploadScope="program-logo"
        programId={program.id}
        onCommit={(next) =>
          editor.commitContentFieldAllLanguages(program.id, 'logo', next || '')
        }
        onAfterFileUpload={(url, message) =>
          editor.applyUploadedProgramLogo(program.id, url, message)
        }
        helpText="Sube PNG/JPEG/WebP o edita el archivo (en /images/logos). Vacío = sin foto de cabecera."
      />
    </div>
  ) : null;

  const playEpisode = (ep: Episode) => {
    archivePlayer.openEpisode({
      episodeId: ep.id,
      audioUrl: ep.audioUrl,
      title: `${program.title} / ${ep.title}`,
    });
  };

  const handleDeleteProgram = async () => {
    if (!canManagePrograms) return;
    const ok = await editor.deleteProgram({
      id: program.id,
      confirmText: deleteConfirm.trim(),
    });
    if (ok) {
      setDeleteOpen(false);
      setDeleteConfirm('');
      void navigate(`/${currentLang}/programacion`);
    }
  };

  const handlePurgeEpisode = () => {
    if (!canEditThisProgram || !episodeToPurge) return;
    void editor.purgeEpisode(program.id, episodeToPurge.id);
    setPurgeConfirmOpen(false);
    setEpisodeToPurge(null);
  };

  const openScheduleEditor = () => {
    setScheduleDraft(
      scheduleMeta ?? {
        weekday: 1,
        startTime: '20:00',
        timezone: 'America/Argentina/Buenos_Aires',
      }
    );
    setShowScheduleEditor(true);
  };

  const closeScheduleEditor = () => {
    setShowScheduleEditor(false);
    setScheduleDraft(null);
  };

  const saveScheduleEditor = async () => {
    if (!canEditThisProgram || !scheduleDraft) return;
    const legacy = scheduleMetaToLegacyString(scheduleDraft);
    await editor.commitMultipleContentFieldsAllLanguages(program.id, {
      schedule_meta: scheduleDraft,
      schedule: legacy,
    });
    closeScheduleEditor();
  };

  const handleCreateEpisodeWithAudio = async () => {
    if (!canEditThisProgram || !newEpisodeFile) return;
    if (!newEpisodeTitle.trim()) {
      setCreateEpisodeMessage('El título es obligatorio.');
      return;
    }
    if (!newEpisodeDuration.trim()) {
      setCreateEpisodeMessage('La duración es obligatoria.');
      return;
    }
    setCreatingEpisode(true);
    setCreateEpisodeMessage('Preparando audio...');
    try {
      const episodeId = `${program.id}-${Date.now()}`;
      const tags = newEpisodeTags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);
      const upload = await uploadEpisodeAudioDirectToArchive({
        programId: program.id,
        episodeId,
        date: newEpisodeDate,
        file: newEpisodeFile,
        onStatus: setCreateEpisodeMessage,
      });
      const createdEpisodeId = await editor.addEpisode(program.id, {
        id: episodeId,
        title: newEpisodeTitle.trim(),
        date: newEpisodeDate,
        duration: newEpisodeDuration.trim(),
        audioUrl: upload.audioUrl,
        description: newEpisodeDescription.trim(),
        tags,
        archiveIdentifier: upload.identifier,
      });
      if (!createdEpisodeId) {
        throw new Error('No se pudo crear el episodio.');
      }
      setCreateEpisodeMessage('Episodio creado y subido.');
      setCreateEpisodeOpen(false);
      setNewEpisodeTitle('');
      setNewEpisodeDate(new Date().toISOString().slice(0, 10));
      setNewEpisodeDuration('00:00');
      setNewEpisodeDescription('');
      setNewEpisodeTags('');
      setNewEpisodeFile(null);
      void navigate(`/${currentLang}/programacion/${encodeURIComponent(program.id)}/${encodeURIComponent(createdEpisodeId)}`);
    } catch (error) {
      setCreateEpisodeMessage(error instanceof Error ? error.message : 'Error al crear episodio.');
    } finally {
      setCreatingEpisode(false);
    }
  };

  const commitTalentList = (nextTalent: string[]) =>
    canEditThisProgram
      ? editor.commitContentFieldAllLanguages(
          program.id,
          'talent',
          nextTalent.map((item) => item.trim()).filter(Boolean)
        )
      : Promise.resolve();

  const commitSocialList = (nextSocial: string[]) =>
    canEditThisProgram
      ? editor.commitContentFieldAllLanguages(
          program.id,
          'social',
          nextSocial.map((item) => normalizeSocialHandle(item)).filter(Boolean)
        )
      : Promise.resolve();

  const heroShellClass = 'relative h-[calc(100dvh-5rem)] w-full overflow-hidden bg-black text-white';

  const overlayBlock = (
    <div className="animate-in fade-in slide-in-from-bottom-8 max-w-5xl duration-1000">

      {scheduleLocalized && (
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.24em] text-white/50">
          <span className="text-white/35">{t('program-detail.schedule-label')}</span>
          <span className="mx-2 text-[var(--program-accent-mid)]">—</span>
          <span className="inline-flex items-center gap-2 text-white/70">
            <span>{scheduleLocalized}</span>
            {canEditThisProgram ? (
              <button
                type="button"
                onClick={openScheduleEditor}
                className="inline-flex items-center justify-center border border-white/30 bg-black/60 p-1.5 text-white/85 transition hover:border-white hover:text-white"
                aria-label="Editar horario"
              >
                <Pencil size={12} strokeWidth={2} />
              </button>
            ) : null}
          </span>
        </p>
      )}
      {canEditThisProgram && showScheduleEditor ? (
        <div className="mt-3 grid max-w-xl grid-cols-1 gap-2 border border-white/15 bg-black/40 p-3 md:grid-cols-4">
          <select
            className="border border-white/20 bg-black px-2 py-1 text-xs"
            value={String(effectiveScheduleMeta.weekday)}
            onChange={(e) => {
              setScheduleDraft((prev) => ({
                ...(prev ?? effectiveScheduleMeta),
                weekday: Number(e.target.value),
              }));
            }}
          >
            {weekdayOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <input
            type="time"
            className="border border-white/20 bg-black px-2 py-1 text-xs"
            value={effectiveScheduleMeta.startTime}
            onChange={(e) => {
              setScheduleDraft((prev) => ({
                ...(prev ?? effectiveScheduleMeta),
                startTime: e.target.value || '20:00',
              }));
            }}
          />
          <select
            className="border border-white/20 bg-black px-2 py-1 text-xs md:col-span-2"
            value={effectiveScheduleMeta.timezone}
            onChange={(e) => {
              setScheduleDraft((prev) => ({
                ...(prev ?? effectiveScheduleMeta),
                timezone: e.target.value || 'America/Argentina/Buenos_Aires',
              }));
            }}
          >
            {timezoneOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {scheduleSourceLabel ? (
            <p className="text-[10px] text-white/45 md:col-span-4">
              Tu hora local: {formatProgramScheduleForViewer(effectiveScheduleMeta, new Date(), i18n.language || 'es')}
              {' · '}
              Base: {scheduleSourceLabel}
            </p>
          ) : null}
          <button
            type="button"
            onClick={saveScheduleEditor}
            disabled={editor?.saving}
            className="border border-emerald-500/70 px-2 py-1 text-[10px] uppercase tracking-wider text-emerald-300 md:col-span-2 disabled:opacity-50"
          >
            Guardar horario
          </button>
          <button
            type="button"
            onClick={closeScheduleEditor}
            className="border border-white/25 px-2 py-1 text-[10px] uppercase tracking-wider text-white/70 md:col-span-2"
          >
            Cancelar
          </button>
        </div>
      ) : null}

      {canEditThisProgram ? (
        <InlineEditableText
          as="h1"
          size="lg"
          className="mt-4"
          textClassName={`${PAGE_SCREEN_TITLE_CLASS} leading-[0.94] tracking-tight text-white [text-shadow:0_2px_24px_rgba(0,0,0,0.75)]`}
          value={program.title}
          language={routeLang}
          localizedValues={buildLocalizedDraft({
            es: contentIndex[program.id]?.es?.title as string | undefined,
            en: contentIndex[program.id]?.en?.title as string | undefined,
            pt: contentIndex[program.id]?.pt?.title as string | undefined,
          }, program.title)}
          onCommit={(next) => editor.commitContentField(program.id, routeLang, 'title', next)}
          onCommitLocalized={(values) =>
            editor.commitContentFieldLocalized(program.id, 'title', values)
          }
        />
      ) : (
        <h1
          className={`${PAGE_SCREEN_TITLE_CLASS} mt-4 leading-[0.94] tracking-tight text-white [text-shadow:0_2px_24px_rgba(0,0,0,0.75)]`}
        >
          {program.title}
        </h1>
      )}

      {(talentLine || canEditThisProgram) && (
        <p className="mt-4 font-mono text-xs leading-relaxed text-white/55 whitespace-nowrap md:text-sm">
          <span className="text-[var(--program-accent)]">{t('program-detail.with')}</span>
          <span className="text-white/75 whitespace-nowrap">
            {' '}
            {canEditThisProgram ? (
              <span className="inline-flex flex-wrap items-center gap-1.5 align-middle whitespace-normal">
                {(program.talent ?? []).map((person, idx) => (
                  <EditableStringListItem
                    key={`talent-${idx}-${person}`}
                    value={person}
                    chipClassName="border-white/20 bg-black/30"
                    textClassName="text-xs text-white/85 md:text-sm"
                    onCommit={(next) => {
                      const talent = [...(program.talent ?? [])];
                      talent[idx] = next;
                      return commitTalentList(talent);
                    }}
                    onRemove={() => {
                      const talent = (program.talent ?? []).filter((_, i) => i !== idx);
                      return commitTalentList(talent);
                    }}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => void commitTalentList([...(program.talent ?? []), 'Nueva persona'])}
                  className="inline-flex items-center gap-1 border border-dashed border-white/30 px-2 py-1 text-[10px] uppercase tracking-wider text-white/70 transition hover:border-white/55 hover:text-white"
                >
                  <Plus size={12} strokeWidth={2} />
                  Añadir
                </button>
              </span>
            ) : (
              talentLine
            )}
          </span>
        </p>
      )}

      {(socialHandles.length > 0 || canEditThisProgram) && (
        <p className="mt-2 font-mono text-[11px] tracking-[0.08em] text-white/35">
          {canEditThisProgram ? (
            <span className="inline-flex flex-wrap items-center gap-1.5 align-middle">
              {socialHandles.map((handle, idx) => (
                <EditableStringListItem
                  key={`social-${idx}-${handle}`}
                  value={`@${handle}`}
                  chipClassName="border-white/20 bg-black/30"
                  textClassName="text-[11px] text-white/80"
                  onCommit={(next) => {
                    const social = [...socialHandles];
                    social[idx] = normalizeSocialHandle(next);
                    return commitSocialList(social);
                  }}
                  onRemove={() => {
                    const social = socialHandles.filter((_, i) => i !== idx);
                    return commitSocialList(social);
                  }}
                />
              ))}
              <button
                type="button"
                onClick={() => void commitSocialList([...socialHandles, 'instagram'])}
                className="inline-flex items-center gap-1 border border-dashed border-white/30 px-2 py-1 text-[10px] uppercase tracking-wider text-white/70 transition hover:border-white/55 hover:text-white"
              >
                <Plus size={12} strokeWidth={2} />
                Añadir
              </button>
            </span>
          ) : (
            socialHandles.map((handle, index) => (
              <React.Fragment key={handle}>
                {index > 0 ? ' / ' : null}
                <a
                  href={`https://instagram.com/${handle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline-offset-2 transition hover:text-white hover:underline"
                >
                  @{handle}
                </a>
              </React.Fragment>
            ))
          )}
        </p>
      )}

      {(canEditThisProgram || excerpt) && (
        <div className="mt-8 max-w-2xl border-l-2 border-[var(--program-accent)] pl-5">
          <p className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.32em] text-[var(--program-accent-soft)]">
          </p>
          {canEditThisProgram ? (
            <InlineEditableText
              value={program.content ?? ''}
              multiline
              textClassName="font-['Space_Grotesk'] text-sm italic leading-relaxed text-white/70 md:text-base"
              language={routeLang}
              localizedValues={buildLocalizedDraft({
                es: contentIndex[program.id]?.es?.content as string | undefined,
                en: contentIndex[program.id]?.en?.content as string | undefined,
                pt: contentIndex[program.id]?.pt?.content as string | undefined,
              }, program.content ?? '')}
              onCommit={(next) => editor.commitContentField(program.id, routeLang, 'content', next)}
              onCommitLocalized={(values) =>
                editor.commitContentFieldLocalized(program.id, 'content', values)
              }
            />
          ) : (
            <p className="line-clamp-4 whitespace-pre-wrap font-['Space_Grotesk'] text-sm italic leading-relaxed text-white/70 md:text-base">
              {excerpt}
            </p>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-black text-white" style={accentVars}>
      <div className={heroShellClass}>
        <Link
          to={`/${currentLang}/programacion`}
          className="absolute left-2 top-2 z-30 inline-flex border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] transition-colors bg-black/70 text-[var(--program-accent-fg)] border-[color:color-mix(in_srgb,var(--program-accent)_35%,transparent)] hover:bg-[var(--program-accent)] hover:text-black hover:border-[var(--program-accent)]"
        >
          {t('program-detail.back')}
        </Link>
        {canEditThisProgram ? (
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="absolute right-2 top-2 z-30 inline-flex border border-red-500/60 bg-black/75 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-red-300 transition-colors hover:bg-red-500/20 hover:text-red-200"
          >
            {t('program-detail.delete-program')}
          </button>
        ) : null}

        {program.logo ? (
          <div className="relative h-full w-full">
            {programImageEditor}
            <img
              src={logoSrc!}
              alt={program.title}
              className="h-full w-full object-cover object-center"
            />
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_100%,rgba(0,0,0,0.85),transparent_55%)]"
              aria-hidden
            />

            <div className="absolute inset-0 z-10 flex flex-col justify-end p-5 pb-8 md:p-10 md:pb-12 lg:p-14 lg:pb-16">
              {overlayBlock}
            </div>
          </div>
        ) : (
          <div className="relative flex h-full w-full flex-col justify-end bg-[#070707] px-5 pb-8 md:px-10 md:pb-12 lg:px-14 lg:pb-16">
            {programImageEditor}
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(255,255,255,0.03)_2px,rgba(255,255,255,0.03)_3px)]"
              aria-hidden
            />
            <div className="relative">{overlayBlock}</div>
          </div>
        )}
      </div>

      {isEvent ? (
        <section className="border-t border-white/10 px-3 py-10 md:px-5 md:py-14 xl:px-7">
          <p className="max-w-2xl font-['Space_Grotesk'] text-sm uppercase tracking-widest text-white/55">
            {t('program-detail.event-only-hint')}
          </p>
        </section>
      ) : (
      <section className="border-t border-white/10 px-3 py-10 md:px-5 md:py-14 xl:px-7">
        <div className="w-full">
          <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-[var(--program-accent-fg)]">
            {t('program-detail.archive-kicker')}
          </p>
          <h2 className="mt-2 font-['Space_Grotesk'] text-2xl font-bold uppercase tracking-tight text-white md:text-4xl">
            {t('program-detail.archive-title')}
          </h2>
          {canEditThisProgram ? (
            <div className="mt-4">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setArchiveView('active');
                  }}
                  className={`border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] transition ${
                    archiveView === 'active'
                      ? 'border-white bg-white text-black'
                      : 'border-white/35 bg-black/60 text-white/85 hover:border-white hover:text-white'
                  }`}
                >
                  {t('program-detail.archive-tab-active')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setArchiveView('trash');
                  }}
                  className={`inline-flex items-center gap-1.5 border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] transition ${
                    archiveView === 'trash'
                      ? 'border-red-400 bg-red-500/20 text-red-200'
                      : 'border-white/35 bg-black/60 text-white/85 hover:border-white hover:text-white'
                  }`}
                >
                  <Trash2 size={12} />
                  {t('program-detail.archive-tab-trash')}
                  <span className="text-white/60">({sortedTrashEpisodes.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const prefilledDate = scheduleMeta
                      ? nearestPastOccurrence(scheduleMeta)
                      : new Date().toISOString().slice(0, 10);
                    setNewEpisodeDate(prefilledDate);
                    setCreateEpisodeOpen(true);
                  }}
                  className="inline-flex items-center gap-2 border border-white/35 bg-black/60 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-white/85 transition hover:border-white hover:text-white"
                >
                  <Plus size={13} strokeWidth={2} />
                  {t('program-detail.add-episode')}
                </button>
              </div>
            </div>
          ) : null}

          {archiveLoading && (
            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-48 animate-pulse border border-white/10 bg-white/5"
                  aria-hidden
                />
              ))}
            </div>
          )}

          {archiveError && (
            <p className="mt-8 font-['Space_Grotesk'] text-sm uppercase tracking-widest text-white/50">
              {t('program-detail.archive-load-error')}
            </p>
          )}

          {!archiveLoading && !archiveError && archiveView === 'active' && visibleEpisodes.length === 0 && (
            <p className="mt-8 font-['Space_Grotesk'] text-sm uppercase tracking-widest text-white/50">
              {t('program-detail.archive-empty')}
            </p>
          )}

          {!archiveLoading && !archiveError && archiveView === 'trash' && sortedTrashEpisodes.length === 0 && (
            <p className="mt-8 font-['Space_Grotesk'] text-sm uppercase tracking-widest text-white/50">
              {t('program-detail.archive-trash-empty')}
            </p>
          )}

          {!archiveLoading && !archiveError && archiveView === 'active' && visibleEpisodes.length > 0 && (
            <>
              <p className="mt-2 font-['Space_Grotesk'] text-xs uppercase tracking-[0.16em] text-white/50">
                {t('program-detail.archive-count', { count: visibleEpisodes.length })}
              </p>
              <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {visibleEpisodes.map((ep) => {
                  const episodePath = `/${currentLang}/programacion/${encodeURIComponent(program.id)}/${encodeURIComponent(ep.id)}`;
                  const cardCover = resolveCoverSrc(ep, program.logo ?? null);
                  return (
                  <article
                    key={ep.id}
                    className="group overflow-hidden border border-white/15 bg-black transition-colors hover:border-[color:color-mix(in_srgb,var(--program-accent)_45%,white)]"
                  >
                    <div className="relative h-52 w-full overflow-hidden md:h-56">
                      <Link
                        to={episodePath}
                        className="absolute inset-0 z-0 block"
                        aria-label={`${t('episode-detail.open-page')}: ${ep.title}`}
                      />
                      <div
                        className="pointer-events-none h-full w-full bg-cover bg-center bg-no-repeat transition-transform duration-500 group-hover:scale-[1.03]"
                        style={{ backgroundImage: `url(${cardCover})` }}
                        aria-hidden
                      />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-black/20" />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          playEpisode(ep);
                        }}
                        className="absolute bottom-3 left-3 z-10 inline-flex h-9 items-center gap-2 border border-white/35 bg-black/65 px-3 font-['Space_Grotesk'] text-[10px] font-bold uppercase tracking-[0.16em] text-white transition hover:bg-black/85"
                        aria-label={`${t('program-detail.play-episode')}: ${ep.title}`}
                      >
                        <span className="inline-block h-0 w-0 border-y-[5px] border-y-transparent border-l-[7px] border-l-white" />
                        {t('program-detail.play-episode')}
                      </button>
                    </div>

                    <div className="px-4 py-4">
                      <p className="font-['Space_Grotesk'] text-[10px] uppercase tracking-[0.18em] text-white/45">
                        {dateFormatter.format(new Date(`${ep.date}T12:00:00`))}
                        <span className="mx-2 text-white/25">·</span>
                        {ep.duration}
                      </p>
                      <Link
                        to={episodePath}
                        className="mt-2 block font-['Space_Grotesk'] text-xl font-bold uppercase leading-tight tracking-tight text-white transition-colors hover:text-[var(--program-accent-fg)]"
                      >
                        {ep.title}
                      </Link>
                      {ep.description && (
                        <p className="mt-2 line-clamp-2 font-['Space_Grotesk'] text-xs leading-relaxed text-white/55">
                          {ep.description}
                        </p>
                      )}
                      {ep.tags && ep.tags.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-1.5">
                          {ep.tags.slice(0, 4).map((tag) => (
                            <span
                              key={`${ep.id}-${tag}`}
                              className="border border-white/20 px-2 py-1 font-['Space_Grotesk'] text-[10px] uppercase tracking-[0.14em] text-white/75"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      {canEditThisProgram ? (
                        <div className="mt-4">
                          <button
                            type="button"
                            onClick={() => editor.removeEpisode(program.id, ep.id)}
                            className="inline-flex items-center gap-1.5 border border-red-500/60 bg-red-500/10 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-red-200 transition hover:bg-red-500/20"
                          >
                            <Trash2 size={12} />
                            {t('program-detail.archive-delete')}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </article>
                  );
                })}
              </div>
            </>
          )}

          {!archiveLoading && !archiveError && archiveView === 'trash' && sortedTrashEpisodes.length > 0 && (
            <>
              <p className="mt-2 font-['Space_Grotesk'] text-xs uppercase tracking-[0.16em] text-white/50">
                {t('program-detail.archive-trash-count', { count: sortedTrashEpisodes.length })}
              </p>
              <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {sortedTrashEpisodes.map((ep) => {
                  const cardCover = resolveCoverSrc(ep, program.logo ?? null);
                  return (
                    <article
                      key={`trash-${ep.id}`}
                      className="group overflow-hidden border border-red-500/25 bg-black transition-colors hover:border-red-400/50"
                    >
                      <div className="relative h-52 w-full overflow-hidden md:h-56">
                        <div
                          className="pointer-events-none h-full w-full bg-cover bg-center bg-no-repeat opacity-70 transition-transform duration-500 group-hover:scale-[1.03]"
                          style={{ backgroundImage: `url(${cardCover})` }}
                          aria-hidden
                        />
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/30" />
                      </div>
                      <div className="px-4 py-4">
                        <p className="font-['Space_Grotesk'] text-[10px] uppercase tracking-[0.18em] text-white/45">
                          {dateFormatter.format(new Date(`${ep.date}T12:00:00`))}
                          <span className="mx-2 text-white/25">·</span>
                          {ep.duration}
                        </p>
                        <h3 className="mt-2 font-['Space_Grotesk'] text-xl font-bold uppercase leading-tight tracking-tight text-white">
                          {ep.title}
                        </h3>
                        {ep.description && (
                          <p className="mt-2 line-clamp-2 font-['Space_Grotesk'] text-xs leading-relaxed text-white/55">
                            {ep.description}
                          </p>
                        )}
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => editor?.restoreEpisode(program.id, ep.id)}
                            className="inline-flex items-center gap-1.5 border border-emerald-500/60 bg-emerald-500/10 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-emerald-200 transition hover:bg-emerald-500/20"
                          >
                            <RotateCcw size={12} />
                            {t('program-detail.archive-restore')}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEpisodeToPurge(ep);
                              setPurgeConfirmOpen(true);
                            }}
                            className="inline-flex items-center gap-1.5 border border-red-500/60 bg-red-500/10 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-red-200 transition hover:bg-red-500/20"
                          >
                            <Trash2 size={12} />
                            {t('program-detail.archive-purge')}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </section>
      )}

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="border border-red-500/40 bg-[#0a0a0a] text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-['Space_Grotesk'] text-xl uppercase tracking-tight text-red-200">
              {t('program-detail.delete-program-title')}
            </DialogTitle>
            <DialogDescription className="text-sm text-white/65">
              {t('program-detail.delete-program-description', { id: program.id })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-white/55">
              {t('program-detail.delete-program-confirm')}
            </p>
            <input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="eliminar"
              className="w-full border border-white/30 bg-black/70 px-3 py-2 text-sm text-white placeholder:text-white/35 focus:border-red-400/70 focus:outline-none"
            />
          </div>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => {
                setDeleteOpen(false);
                setDeleteConfirm('');
              }}
              className="border border-white/30 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-white/85 hover:bg-white/10"
            >
              {t('programs.create-program-cancel')}
            </button>
            <button
              type="button"
              disabled={editor?.saving || deleteConfirm.trim().toLowerCase() !== 'eliminar'}
              onClick={() => void handleDeleteProgram()}
              className="border border-red-500 bg-red-600/90 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-white hover:bg-red-600 disabled:opacity-40"
            >
              {t('program-detail.delete-program-submit')}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={purgeConfirmOpen} onOpenChange={setPurgeConfirmOpen}>
        <DialogContent className="border border-red-500/40 bg-[#0a0a0a] text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-['Space_Grotesk'] text-xl uppercase tracking-tight text-red-200">
              {t('program-detail.archive-purge-title')}
            </DialogTitle>
            <DialogDescription className="text-sm text-white/65">
              {t('program-detail.archive-purge-description', { title: episodeToPurge?.title ?? '' })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => {
                setPurgeConfirmOpen(false);
                setEpisodeToPurge(null);
              }}
              className="border border-white/30 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-white/85 hover:bg-white/10"
            >
              {t('programs.create-program-cancel')}
            </button>
            <button
              type="button"
              onClick={handlePurgeEpisode}
              className="border border-red-500 bg-red-600/90 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-white hover:bg-red-600 disabled:opacity-40"
            >
              {t('program-detail.archive-purge-confirm')}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createEpisodeOpen} onOpenChange={setCreateEpisodeOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border border-white/30 bg-[#0a0a0a] text-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-['Space_Grotesk'] text-xl uppercase tracking-tight text-white">
              Crear episodio + subir a Archive.org
            </DialogTitle>
            <DialogDescription className="text-sm text-white/65">
              El episodio se crea solo si la subida a Archive.org termina correctamente. WAV/FLAC se convierten a MP3 antes de subir.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-1">
            <label className="grid gap-1.5 text-left">
              <span className="font-mono text-[10px] uppercase tracking-wider text-white/45">Título</span>
              <input
                value={newEpisodeTitle}
                onChange={(e) => setNewEpisodeTitle(e.target.value)}
                className="border border-white/25 bg-black/60 px-3 py-2 text-sm text-white focus:border-white/45 focus:outline-none"
              />
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5 text-left">
                <span className="font-mono text-[10px] uppercase tracking-wider text-white/45">Fecha</span>
                <input
                  type="date"
                  value={newEpisodeDate}
                  onChange={(e) => setNewEpisodeDate(e.target.value)}
                  className="border border-white/25 bg-black/60 px-3 py-2 text-sm text-white focus:border-white/45 focus:outline-none"
                />
              </label>
              <label className="grid gap-1.5 text-left">
                <span className="font-mono text-[10px] uppercase tracking-wider text-white/45">Duración</span>
                <input
                  value={newEpisodeDuration}
                  onChange={(e) => setNewEpisodeDuration(e.target.value)}
                  placeholder="58:30"
                  className="border border-white/25 bg-black/60 px-3 py-2 text-sm text-white focus:border-white/45 focus:outline-none"
                />
              </label>
            </div>
            <label className="grid gap-1.5 text-left">
              <span className="font-mono text-[10px] uppercase tracking-wider text-white/45">Descripción</span>
              <textarea
                value={newEpisodeDescription}
                onChange={(e) => setNewEpisodeDescription(e.target.value)}
                rows={3}
                className="border border-white/25 bg-black/60 px-3 py-2 text-sm text-white focus:border-white/45 focus:outline-none"
              />
            </label>
            <label className="grid gap-1.5 text-left">
              <span className="font-mono text-[10px] uppercase tracking-wider text-white/45">Tags (separados por coma)</span>
              <input
                value={newEpisodeTags}
                onChange={(e) => setNewEpisodeTags(e.target.value)}
                placeholder="radionudista, archivo sonoro"
                className="border border-white/25 bg-black/60 px-3 py-2 text-sm text-white focus:border-white/45 focus:outline-none"
              />
            </label>
            <label className="grid gap-1.5 text-left">
              <span className="font-mono text-[10px] uppercase tracking-wider text-white/45">Archivo de audio</span>
              <input
                type="file"
                accept="audio/*"
                onChange={(e) => setNewEpisodeFile(e.target.files?.[0] ?? null)}
                className="border border-white/25 bg-black/60 px-3 py-2 text-xs text-white/85 file:mr-2 file:border file:border-white/35 file:bg-black/70 file:px-2 file:py-1 file:text-[10px] file:uppercase file:tracking-wider file:text-white/85"
              />
            </label>
            {creatingEpisode ? (
              <div className="flex items-center gap-2.5 border border-white/20 bg-white/5 px-3 py-2">
                <span
                  className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white/20 border-t-white"
                  aria-hidden
                />
                <p className="font-mono text-[10px] leading-snug text-white/80">
                  Subiendo a Archive.org... no cierres esta ventana.
                </p>
              </div>
             ) : createEpisodeMessage ? (
              <p className="font-mono text-[10px] leading-snug text-white/70">{createEpisodeMessage}</p>
            ) : null}
          </div>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setCreateEpisodeOpen(false)}
              className="border border-white/30 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-white/85 hover:bg-white/10"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={creatingEpisode || !newEpisodeFile || !newEpisodeTitle.trim()}
              onClick={() => void handleCreateEpisodeWithAudio()}
              className="border border-white bg-white px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-black hover:bg-white/90 disabled:opacity-40"
            >
              {creatingEpisode ? 'Subiendo audio...' : 'Subir y crear episodio'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default ProgramDetailPage;










