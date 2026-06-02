import React, { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { env } from '../config/env';
import { useOptionalEditor } from '../contexts/EditorContext';
import { useContentIndexData } from '../hooks/useEditorContent';
import { mapRouteToContentIndexLanguage, resolveContentIndexEntry, resolveContentIndexString } from '../utils/contentLanguage';
import { useRouteLanguage } from '../hooks/useRouteLanguage';
import { resolveProgramLogoSrc } from '../utils/programLogo';
import { episodeService } from '../services/episodeService';
import { isEpisodeReleased, isProgramScheduleMeta, type ProgramScheduleMeta } from '../utils/programSchedule';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  PAGE_SCREEN_TITLE_CLASS,
  PAGE_SHELL_BELOW_NAV,
  PAGE_SHELL_CONTENT,
} from '../constants/layoutConstants';
import { getContentKind, isArchivosProgramEntry } from '../editor/programUtils';
import type { ContentKind } from '../editor/contracts';

interface ShowData {
  id: string;
  title: string;
  content?: string;
  talent?: string[];
  logo?: string;
  component?: string;
  public?: boolean | string;
  program_order?: number;
  content_kind?: ContentKind;
  schedule_meta?: ProgramScheduleMeta;
}

const INITIAL_VISIBLE_SHOWS = 12;

const normalize = (value?: string): string =>
  (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const ProgramPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const editor = useOptionalEditor();
  const contentIndex = useContentIndexData();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleShows, setVisibleShows] = useState(INITIAL_VISIBLE_SHOWS);
  const [createOpen, setCreateOpen] = useState(false);
  const [newId, setNewId] = useState('');
  const [newTitleEs, setNewTitleEs] = useState('');
  const [newTitlePt, setNewTitlePt] = useState('');
  const [newSchedule, setNewSchedule] = useState('');
  const [newContentKind, setNewContentKind] = useState<ContentKind>('program');

  const routeLang = useRouteLanguage();
  const contentLang = mapRouteToContentIndexLanguage(routeLang);

  const allShows = useMemo(() => {
    return Object.entries(contentIndex)
      .map(([key, localized]) => {
        const entry = resolveContentIndexEntry<ShowData>(localized, contentLang);
        if (!entry || entry.component !== 'ProgramPage' || (entry.public !== true && entry.public !== 'true')) {
          return null;
        }
        if (!editor?.enabled && !isArchivosProgramEntry(entry)) {
          return null;
        }
        return {
          ...entry,
          id: entry.id || key,
          title: resolveContentIndexString(localized, contentLang, 'title') || entry.title,
          content: resolveContentIndexString(localized, contentLang, 'content') || entry.content || '',
        };
      })
      .filter((entry): entry is ShowData => entry !== null);
  }, [contentIndex, contentLang, editor?.enabled]);

  const orderedShows = useMemo(() => {
    return [...allShows].sort((a, b) => {
      const oa = a.program_order ?? 999;
      const ob = b.program_order ?? 999;
      if (oa !== ob) return oa - ob;
      return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
    });
  }, [allShows]);

  const filteredShows = useMemo(() => {
    const query = normalize(searchQuery);
    if (!query) return orderedShows;

    return orderedShows.filter((show) => {
      const searchable = normalize(`${show.title} ${show.talent?.join(' ') || ''} ${show.content || ''}`);
      return searchable.includes(query);
    });
  }, [orderedShows, searchQuery]);

  const visibleFilteredShows = filteredShows.slice(0, visibleShows);
  const hasMoreShows = visibleFilteredShows.length < filteredShows.length;

  const { data: episodeDateRows = [] } = useQuery({
    queryKey: ['archivos-episode-counts'],
    queryFn: () => episodeService.getActiveEpisodeDatesByProgram(),
    staleTime: 1000 * 60 * 5,
  });

  const episodeCountByProgramId = useMemo(() => {
    const showMetaById = new Map(
      allShows.map((show) => [
        show.id,
        isProgramScheduleMeta(show.schedule_meta) ? show.schedule_meta : null,
      ])
    );
    const includeUnreleased = import.meta.env.DEV || Boolean(editor?.enabled);
    const counts: Record<string, number> = {};

    for (const row of episodeDateRows) {
      if (!showMetaById.has(row.program_id)) continue;
      const scheduleMeta = showMetaById.get(row.program_id) ?? null;
      if (!includeUnreleased && !isEpisodeReleased(row.episode_date, scheduleMeta)) {
        continue;
      }
      counts[row.program_id] = (counts[row.program_id] ?? 0) + 1;
    }

    return counts;
  }, [allShows, editor?.enabled, episodeDateRows]);

  const handleCreateProgram = async () => {
    if (!editor?.enabled) return;
    const id = newId
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '-')
      .replace(/_/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    if (!id) return;
    const createdId = await editor.createProgram({
      id,
      titleEs: newTitleEs.trim(),
      titlePt: (newTitlePt.trim() || newTitleEs.trim()),
      schedule: newSchedule.trim() || undefined,
      contentKind: newContentKind,
    });
    if (createdId) {
      setCreateOpen(false);
      setNewId('');
      setNewTitleEs('');
      setNewTitlePt('');
      setNewSchedule('');
      setNewContentKind('program');
      void navigate(`/${routeLang}/programacion/${encodeURIComponent(createdId)}`);
    }
  };

  return (
    <section className={PAGE_SHELL_BELOW_NAV}>
      <header className={PAGE_SHELL_CONTENT}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <h1 className={`${PAGE_SCREEN_TITLE_CLASS} leading-none text-white`}>
            {t('programs.page-title')}
          </h1>
          {editor?.enabled ? (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="shrink-0 border border-white/35 bg-black/40 px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.18em] text-white transition hover:border-white hover:bg-white/10"
            >
              {t('programs.create-program')}
            </button>
          ) : null}
        </div>

        <div className="mt-6 grid grid-cols-1 border border-white/20 md:grid-cols-[1fr_auto]">
          <label className="relative flex min-h-[48px] min-w-0 border-b border-white/20 md:border-b-0 md:border-r md:border-white/20">
            <span className="sr-only">{t('programs.search-label')}</span>
            <input
              type="search"
              value={searchQuery}
              autoComplete="off"
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setVisibleShows(INITIAL_VISIBLE_SHOWS);
              }}
              placeholder={t('programs.search-placeholder')}
              className="h-full min-h-[48px] w-full bg-black/40 px-4 py-3 font-['Space_Grotesk'] text-sm text-white placeholder:text-white/40 focus:bg-black/55 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white/15 md:text-[0.8125rem] md:tracking-wide"
            />
          </label>

          <div className="flex min-h-[48px] items-center justify-center px-4 text-white/55 md:min-w-[3.25rem]">
            <Search size={18} strokeWidth={2} aria-hidden />
          </div>
        </div>
      </header>

      <div
        className={`${PAGE_SHELL_CONTENT} mt-8 grid grid-cols-1 gap-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`}
      >
        {visibleFilteredShows.map((show) => {
          const episodeCount = episodeCountByProgramId[show.id] ?? 0;
          const isEvent = getContentKind(show) === 'event';

          return (
            <article key={show.id} className="group">
              <Link
                to={`/${routeLang}/programacion/${show.id}`}
                className="block overflow-hidden border border-white/20 bg-black"
              >
                <div className="aspect-[4/3] overflow-hidden bg-[#0a0a0a]">
                  <img
                    src={resolveProgramLogoSrc(show.logo)}
                    alt={show.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                </div>
              </Link>

              <div className="pt-3">
                <Link
                  to={`/${routeLang}/programacion/${show.id}`}
                  className="block font-['Space_Grotesk'] text-2xl font-bold uppercase leading-[0.95] tracking-tighter text-white transition hover:underline xl:text-[1.65rem] xl:leading-tight"
                >
                  {show.title}
                </Link>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {isEvent ? (
                    <span className="inline-flex min-h-6 items-center border border-amber-400/50 bg-amber-500/10 px-2.5 py-1 font-['Space_Grotesk'] text-[11px] font-semibold uppercase leading-none tracking-[0.08em] text-amber-100/95">
                      {t('programs.event-badge')}
                    </span>
                  ) : (
                    <span className="inline-flex min-h-6 items-center border border-white/45 bg-white/5 px-2.5 py-1 font-['Space_Grotesk'] text-[11px] font-semibold uppercase leading-none tracking-[0.08em] text-white/90">
                      {episodeCount} {t('programs.episodes-label')}
                    </span>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {filteredShows.length === 0 && (
        <p className={`${PAGE_SHELL_CONTENT} mt-10 font-['Space_Grotesk'] text-sm uppercase tracking-widest text-white/70`}>
          {t('programs.empty')}
        </p>
      )}

      {hasMoreShows && (
        <div className={`${PAGE_SHELL_CONTENT} mt-8 flex justify-center`}>
          <button
            type="button"
            onClick={() => setVisibleShows((prev) => prev + INITIAL_VISIBLE_SHOWS)}
            className="border border-white px-5 py-3 font-['Space_Grotesk'] text-xs font-bold uppercase tracking-widest text-white transition hover:bg-white hover:text-black"
          >
            {t('programs.show-more')}
          </button>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border border-white/25 bg-[#0a0a0a] text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-['Space_Grotesk'] text-xl uppercase tracking-tight text-white">
              {t('programs.create-program-title')}
            </DialogTitle>
            <DialogDescription className="text-sm text-white/55">
              {t('programs.create-program-description')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-1">
            <label className="grid gap-1.5 text-left">
              <span className="font-mono text-[10px] uppercase tracking-wider text-white/45">
                {t('programs.create-program-id')}
              </span>
              <input
                value={newId}
                onChange={(e) => setNewId(e.target.value)}
                autoComplete="off"
                placeholder="mi-programa-nuevo"
                className="border border-white/25 bg-black/60 px-3 py-2 font-mono text-sm text-white placeholder:text-white/30 focus:border-white/45 focus:outline-none"
              />
            </label>
            <label className="grid gap-1.5 text-left">
              <span className="font-mono text-[10px] uppercase tracking-wider text-white/45">
                {t('programs.create-program-title-es')}
              </span>
              <input
                value={newTitleEs}
                onChange={(e) => setNewTitleEs(e.target.value)}
                className="border border-white/25 bg-black/60 px-3 py-2 text-sm text-white focus:border-white/45 focus:outline-none"
              />
            </label>
            <label className="grid gap-1.5 text-left">
              <span className="font-mono text-[10px] uppercase tracking-wider text-white/45">
                {t('programs.create-program-title-pt')}
              </span>
              <input
                value={newTitlePt}
                onChange={(e) => setNewTitlePt(e.target.value)}
                placeholder={newTitleEs || '…'}
                className="border border-white/25 bg-black/60 px-3 py-2 text-sm text-white placeholder:text-white/35 focus:border-white/45 focus:outline-none"
              />
            </label>
            <fieldset className="grid gap-2 text-left">
              <legend className="font-mono text-[10px] uppercase tracking-wider text-white/45">
                {t('programs.create-program-kind-label')}
              </legend>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setNewContentKind('program')}
                  className={`flex-1 border px-3 py-2 font-mono text-[10px] uppercase tracking-wider transition ${
                    newContentKind === 'program'
                      ? 'border-white bg-white text-black'
                      : 'border-white/25 bg-black/60 text-white/70 hover:border-white/40'
                  }`}
                >
                  {t('programs.create-program-kind-program')}
                </button>
                <button
                  type="button"
                  onClick={() => setNewContentKind('event')}
                  className={`flex-1 border px-3 py-2 font-mono text-[10px] uppercase tracking-wider transition ${
                    newContentKind === 'event'
                      ? 'border-amber-300 bg-amber-400 text-black'
                      : 'border-white/25 bg-black/60 text-white/70 hover:border-white/40'
                  }`}
                >
                  {t('programs.create-program-kind-event')}
                </button>
              </div>
              <p className="text-xs text-white/45 leading-relaxed">
                {newContentKind === 'event'
                  ? t('programs.create-program-kind-event-hint')
                  : t('programs.create-program-kind-program-hint')}
              </p>
            </fieldset>
            <label className="grid gap-1.5 text-left">
              <span className="font-mono text-[10px] uppercase tracking-wider text-white/45">
                {t('programs.create-program-schedule')}
              </span>
              <input
                value={newSchedule}
                onChange={(e) => setNewSchedule(e.target.value)}
                placeholder="ej. miércoles 20:00 - ESP"
                className="border border-white/25 bg-black/60 px-3 py-2 text-sm text-white placeholder:text-white/35 focus:border-white/45 focus:outline-none"
              />
            </label>
          </div>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="border border-white/30 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-white/85 hover:bg-white/10"
            >
              {t('programs.create-program-cancel')}
            </button>
            <button
              type="button"
              disabled={editor?.saving || !newId.trim() || !newTitleEs.trim()}
              onClick={() => void handleCreateProgram()}
              className="border border-white bg-white px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-black hover:bg-white/90 disabled:opacity-40"
            >
              {t('programs.create-program-submit')}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default ProgramPage;
