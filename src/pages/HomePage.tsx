import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueries } from '@tanstack/react-query';
import { useLiveProgram } from '../hooks/useLiveProgram';
import { episodeService } from '../services/episodeService';
import type { ResolvedLiveProgram } from '../utils/liveSchedule';
import { getNextVideoFromCycle, VIDEO_CONFIG } from '../utils/videoConfig';
import { useEditorialText } from '../hooks/useEditorContent';
import { useRouteLanguage } from '../hooks/useRouteLanguage';
import { resolveEditorialText } from '../utils/editorialText';
import { useOptionalEditor } from '../contexts/EditorContext';
import { useArchivePlayer } from '../contexts/ArchivePlayerContext';
import InlineEditableText from '../components/InlineEditableText';
import type { Episode } from '../types';

const HOME_MANIFEST_VIDEO_STORAGE_KEY = 'rn.home.manifest.video.queue';
const HOME_MANIFEST_VIDEO_LOAD_MARK_KEY = 'rn.home.manifest.video.load-mark';

const toLocalDateKey = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const HomePage = () => {
  const { t, i18n } = useTranslation();
  const editorial = useEditorialText();
  const editor = useOptionalEditor();
  const archivePlayer = useArchivePlayer();
  const lang = useRouteLanguage();
  const { program, heroImageUrl, isLive, isLoading, isError, pastPrograms } = useLiveProgram();
  const [isJoinPanelOpen, setIsJoinPanelOpen] = React.useState(false);
  const [isMailChoiceOpen, setIsMailChoiceOpen] = React.useState(false);
  const [mailChoiceError, setMailChoiceError] = React.useState<string | null>(null);
  const [manifestVideo, setManifestVideo] = React.useState<string>(VIDEO_CONFIG.defaultVideo);
  const failedVideosRef = React.useRef<Set<string>>(new Set());

  const programLink =
    program?.programId != null
      ? `/${i18n.language}/programacion/${encodeURIComponent(program.programId)}`
      : null;

  const dateFormatter = React.useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
    [i18n.language]
  );

  const timeFormatter = React.useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language, {
        hour: '2-digit',
        minute: '2-digit',
      }),
    [i18n.language]
  );

  const pastProgramEpisodeQueries = useQueries({
    queries: pastPrograms.map((past) => ({
      queryKey: ['home-episodes-for-event', past.programId ?? 'no-program', past.event.id],
      queryFn: () =>
        past.programId
          ? episodeService.getEpisodesByProgram(past.programId)
          : Promise.resolve({ programId: '', episodes: [] as Episode[] }),
      enabled: Boolean(past.programId),
      staleTime: 1000 * 60 * 10,
    })),
  });

  /**
   * For each past calendar event, resolve the episode that matches that specific
   * broadcast date. Past events have already ended, so all matched episodes are
   * considered "released" and visible.
   */
  const cardDataByEventId = React.useMemo<
    Record<string, { episode: Episode | null; tags: string[] }>
  >(() => {
    const result: Record<string, { episode: Episode | null; tags: string[] }> = {};
    pastPrograms.forEach((past, index) => {
      const eventStartDate = toLocalDateKey(past.event.startTime);
      const eventEndDate = toLocalDateKey(past.event.endTime);
      const queryData = pastProgramEpisodeQueries[index]?.data;
      const episodes = queryData?.episodes ?? [];
      const matched =
        episodes.find((ep) => ep.date === eventStartDate || ep.date === eventEndDate) ?? null;
      const tags = (matched?.tags ?? []).map((tag) => tag.trim()).filter(Boolean);
      result[past.event.id] = { episode: matched, tags };
    });
    return result;
  }, [pastPrograms, pastProgramEpisodeQueries]);

  const handlePlayEpisode = React.useCallback((item: ResolvedLiveProgram, episode: Episode) => {
    archivePlayer.openEpisode({
      episodeId: episode.id,
      audioUrl: episode.audioUrl,
      title: `${item.title} / ${episode.title}`,
    });
  }, [archivePlayer]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    // Prevent double-consumption in React Strict Mode dev remounts.
    // Each real page load has a unique performance.timeOrigin.
    const loadMark = String(window.performance.timeOrigin);
    const consumedMark = window.sessionStorage.getItem(HOME_MANIFEST_VIDEO_LOAD_MARK_KEY);
    if (consumedMark === loadMark) return;

    window.sessionStorage.setItem(HOME_MANIFEST_VIDEO_LOAD_MARK_KEY, loadMark);
    const nextVideo = getNextVideoFromCycle(HOME_MANIFEST_VIDEO_STORAGE_KEY);
    setManifestVideo(nextVideo);
  }, []);

  const handleManifestVideoError = React.useCallback(() => {
    // Some browsers can emit repeated error events for the same failing src.
    // Ensure we consume at most one extra queue item per failed video.
    if (failedVideosRef.current.has(manifestVideo)) {
      return;
    }
    failedVideosRef.current.add(manifestVideo);

    // Try another video from the user-specific cycle.
    // Stop retrying when all configured videos failed in this session.
    if (failedVideosRef.current.size >= VIDEO_CONFIG.videos.length) {
      return;
    }

    const nextVideo = getNextVideoFromCycle(HOME_MANIFEST_VIDEO_STORAGE_KEY);
    setManifestVideo(nextVideo);
  }, [manifestVideo]);

  const openJoinMail = React.useCallback((provider: 'system' | 'gmail' | 'outlook') => {
    const subject = encodeURIComponent('Quiero proponer un programa');
    const body = encodeURIComponent(
      'Hola RadioNudista,\n\nMe gustaria sumarme con un programa.\n\nFormato:\nTema:\nFrecuencia:\n\nGracias.'
    );
    const to = encodeURIComponent('correonudista@gmail.com');
    const urlByProvider = {
      system: `mailto:correonudista@gmail.com?subject=${subject}&body=${body}`,
      gmail: `https://mail.google.com/mail/u/0/?view=cm&fs=1&to=${to}&su=${subject}&body=${body}`,
      outlook: `https://outlook.office.com/mail/deeplink/compose?to=${to}&subject=${subject}&body=${body}`,
    };
    const url = urlByProvider[provider];

    if (provider === 'system') {
      setMailChoiceError(null);
      setIsMailChoiceOpen(false);
      window.location.href = url;
      return;
    }

    // Open a tab first, then navigate it, so current app route is never replaced.
    const popup = window.open('', '_blank');
    if (!popup) {
      setMailChoiceError('Tu navegador bloqueó la nueva pestaña. Habilita popups para continuar.');
      return;
    }
    popup.opener = null;
    popup.location.href = url;
    setMailChoiceError(null);
    setIsMailChoiceOpen(false);
  }, []);

  return (
    <section className="relative flex-1 w-full bg-black">
      <div className="relative min-h-[calc(100dvh-5rem)] overflow-hidden">
        {/* Imagen de marca: programa en vivo (calendario) o logo de la radio */}
        <div
          className="absolute inset-0 bg-black bg-no-repeat bg-center transition-[background-image] duration-500"
          style={{
            backgroundImage: `url(${heroImageUrl})`,
            backgroundSize: 'cover',
          }}
          role="img"
          aria-label={program?.title ?? 'Radio Nudista'}
        />

        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-black/65"
          aria-hidden
        />

        {(isLoading || isError) && (
          <div className="absolute top-4 left-1/2 z-10 -translate-x-1/2 rounded border border-white/15 bg-black/50 px-3 py-1 font-['Space_Grotesk'] text-[10px] uppercase tracking-widest text-white/70">
            {isError ? t('common.error') : t('common.loading')}
          </div>
        )}

        {program && isLive && programLink && (
          <Link
            to={programLink}
            className="absolute inset-0 z-[5] block outline-none ring-offset-2 ring-offset-black focus-visible:ring-2 focus-visible:ring-white/40"
            aria-label={program.title}
          />
        )}

        {program && isLive && (
          <div className="pointer-events-none absolute bottom-8 left-6 right-6 z-10 max-w-2xl md:bottom-10 md:left-auto md:right-10 md:max-w-xl lg:max-w-2xl">
            <div className="border border-white/25 bg-black/90 px-6 py-5 shadow-2xl backdrop-blur-md sm:px-7 sm:py-6 md:px-8 md:py-7">
              <h2 className="font-['Space_Grotesk'] text-xl font-bold uppercase tracking-tight text-white md:text-2xl">
                {program.title}
              </h2>
              {program.blurb && (
                <p className="mt-3 font-['Space_Grotesk'] text-sm leading-relaxed text-[#b8b8b8]">
                  {program.blurb}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <section className="bg-black px-3 py-10 md:px-5 md:py-14 xl:px-7">
        <div className="w-full">
          <h2 className="font-['Space_Grotesk'] text-2xl md:text-4xl font-bold uppercase tracking-tight text-white">
            {t('home.latest-shows')}
          </h2>
          <p className="mt-2 font-['Space_Grotesk'] text-xs uppercase tracking-[0.16em] text-white/50">
            {t('home.latest-shows-subtitle')}
          </p>

          {pastPrograms.length === 0 ? (
            <p className="mt-8 font-['Space_Grotesk'] text-sm uppercase tracking-widest text-white/50">
              {t('home.no-past-shows')}
            </p>
          ) : (
            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {pastPrograms.map((past) => {
                const cardData = cardDataByEventId[past.event.id];
                const matchedEpisode = cardData?.episode ?? null;
                const episodeTags = cardData?.tags ?? [];

                const programPath = past.programId
                  ? `/${i18n.language}/programacion/${encodeURIComponent(past.programId)}`
                  : null;
                const episodePath =
                  past.programId && matchedEpisode
                    ? `/${i18n.language}/programacion/${encodeURIComponent(past.programId)}/${encodeURIComponent(matchedEpisode.id)}`
                    : null;
                const linkPath = episodePath ?? programPath;

                const cardImage = matchedEpisode?.coverImage
                  ? matchedEpisode.coverImage
                  : past.logoFile
                  ? `/images/logos/${past.logoFile}`
                  : '/images/logo-radionudista-negro.png';

                return (
                  <article
                    key={past.event.id}
                    className="group overflow-hidden border border-white/15 bg-black transition-colors hover:border-white/35"
                  >
                    <div className="relative h-52 w-full overflow-hidden md:h-56">
                      <div
                        className="h-full w-full bg-cover bg-center bg-no-repeat transition-transform duration-500 group-hover:scale-[1.03]"
                        style={{ backgroundImage: `url(${cardImage})` }}
                        aria-hidden
                      />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-black/20" />
                      {matchedEpisode && (
                        <button
                          type="button"
                          onClick={() => handlePlayEpisode(past, matchedEpisode)}
                          className="absolute bottom-3 left-3 inline-flex h-9 items-center gap-2 border border-white/35 bg-black/65 px-3 font-['Space_Grotesk'] text-[10px] font-bold uppercase tracking-[0.16em] text-white transition hover:bg-black/85 disabled:opacity-60"
                          aria-label={`${t('home.play-latest-episode')} - ${past.title}`}
                        >
                          <span className="inline-block h-0 w-0 border-y-[5px] border-y-transparent border-l-[7px] border-l-white" />
                          {t('home.play-archive')}
                        </button>
                      )}
                    </div>

                    <div className="px-4 py-4">
                      <p className="font-['Space_Grotesk'] text-[10px] uppercase tracking-[0.18em] text-white/45">
                        {dateFormatter.format(past.event.startTime)} •{' '}
                        {timeFormatter.format(past.event.startTime)}
                      </p>
                      {linkPath ? (
                        <Link
                          to={linkPath}
                          className="mt-2 block font-['Space_Grotesk'] text-xl font-bold uppercase leading-tight tracking-tight text-white transition-colors hover:text-[#d9d9d9]"
                        >
                          {past.title}
                        </Link>
                      ) : (
                        <h3 className="mt-2 font-['Space_Grotesk'] text-xl font-bold uppercase leading-tight tracking-tight text-white">
                          {past.title}
                        </h3>
                      )}
                      {episodeTags.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-1.5">
                          {episodeTags.map((tag) => (
                            <span
                              key={`${past.event.id}-${tag}`}
                              className="border border-white/20 px-2 py-1 font-['Space_Grotesk'] text-[10px] uppercase tracking-[0.14em] text-white/75"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="border-t border-white/20 bg-black">
        <div className="relative overflow-hidden">
          <video
            key={manifestVideo}
            className="absolute inset-0 h-full w-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            onError={handleManifestVideoError}
          >
            <source src={manifestVideo} type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-black/70" aria-hidden />

          <div className="relative z-10 mx-auto flex min-h-[42vh] w-full max-w-5xl flex-col items-center justify-center px-6 py-16 text-center">
            <p className="font-['Space_Grotesk'] text-[10px] uppercase tracking-[0.22em] text-white/65">
              {t('home.manifest-kicker')}
            </p>
            {editor?.enabled ? (
              <InlineEditableText
                as="h3"
                size="lg"
                align="center"
                className="mt-4 max-w-4xl"
                textClassName="font-['Space_Grotesk'] text-3xl font-black uppercase leading-[0.95] tracking-tight text-white md:text-5xl"
                value={resolveEditorialText(editorial?.home.manifestTitle, lang)}
                language={lang}
                localizedValues={editorial?.home.manifestTitle}
                onCommit={(next) => editor.commitEditorialField('home', 'manifestTitle', lang, next)}
                onCommitLocalized={(values) =>
                  editor.commitEditorialFieldLocalized('home', 'manifestTitle', values)
                }
              />
            ) : (
              <h3 className="mt-4 max-w-4xl font-['Space_Grotesk'] text-3xl font-black uppercase leading-[0.95] tracking-tight text-white md:text-5xl">
                {resolveEditorialText(editorial?.home.manifestTitle, lang)}
              </h3>
            )}
            {editor?.enabled ? (
              <InlineEditableText
                as="div"
                className="mt-5 max-w-2xl"
                align="center"
                textClassName="font-['Space_Grotesk'] text-sm uppercase tracking-[0.14em] text-white/75 md:text-base"
                value={resolveEditorialText(editorial?.home.manifestSubtitle, lang)}
                language={lang}
                localizedValues={editorial?.home.manifestSubtitle}
                onCommit={(next) => editor.commitEditorialField('home', 'manifestSubtitle', lang, next)}
                onCommitLocalized={(values) =>
                  editor.commitEditorialFieldLocalized('home', 'manifestSubtitle', values)
                }
              />
            ) : (
              <p className="mt-5 max-w-2xl font-['Space_Grotesk'] text-sm uppercase tracking-[0.14em] text-white/75 md:text-base">
                {resolveEditorialText(editorial?.home.manifestSubtitle, lang)}
              </p>
            )}
            <button
              type="button"
              onClick={() => setIsJoinPanelOpen(true)}
              className="mt-6 border border-white/45 px-5 py-2 font-['Space_Grotesk'] text-xs font-bold uppercase tracking-[0.18em] text-white transition hover:bg-white hover:text-black"
            >
              {t('home.manifest-join-link')}
            </button>
          </div>

          <div
            className={`fixed inset-0 z-20 transition-colors duration-300 ${
              isJoinPanelOpen ? 'pointer-events-auto bg-black/40' : 'pointer-events-none bg-transparent'
            }`}
            onClick={() => setIsJoinPanelOpen(false)}
            aria-hidden
          />

          <aside
            className={`fixed right-0 top-20 bottom-0 z-30 w-full border-l border-white/20 bg-black/95 p-5 md:absolute md:top-0 md:h-full md:max-w-[540px] md:p-8 transition-transform duration-300 ease-out overflow-y-auto ${
              isJoinPanelOpen ? 'translate-x-0' : 'translate-x-full'
            }`}
            aria-hidden={!isJoinPanelOpen}
          >
            <div className="flex h-full flex-col">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-['Space_Grotesk'] text-[10px] uppercase tracking-[0.2em] text-white/50">
                    {t('home.join-panel-kicker')}
                  </p>
                  <h4 className="mt-2 font-['Space_Grotesk'] text-2xl font-black uppercase leading-tight tracking-tight text-white">
                    {t('home.join-panel-title')}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setIsJoinPanelOpen(false)}
                  className="h-9 w-9 border border-white/30 text-white/80 transition hover:text-white"
                  aria-label={t('common.close')}
                >
                  ×
                </button>
              </div>

              {editor?.enabled ? (
                <div className="mt-5">
                  <InlineEditableText
                    multiline
                    textClassName="font-['Space_Grotesk'] text-sm leading-relaxed text-white/80"
                    value={resolveEditorialText(editorial?.home.joinPanelCopy, lang)}
                    language={lang}
                    localizedValues={editorial?.home.joinPanelCopy}
                    onCommit={(next) => editor.commitEditorialField('home', 'joinPanelCopy', lang, next)}
                    onCommitLocalized={(values) =>
                      editor.commitEditorialFieldLocalized('home', 'joinPanelCopy', values)
                    }
                  />
                </div>
              ) : (
                <p className="mt-5 font-['Space_Grotesk'] text-sm leading-relaxed text-white/80">
                  {resolveEditorialText(editorial?.home.joinPanelCopy, lang)}
                </p>
              )}

              <div className="mt-6 grid gap-3">
                <p className="border border-white/15 px-3 py-2 font-['Space_Grotesk'] text-[11px] uppercase tracking-[0.15em] text-white/75">
                  {t('home.join-panel-point-1')}
                </p>
                <p className="border border-white/15 px-3 py-2 font-['Space_Grotesk'] text-[11px] uppercase tracking-[0.15em] text-white/75">
                  {t('home.join-panel-point-2')}
                </p>
                <p className="border border-white/15 px-3 py-2 font-['Space_Grotesk'] text-[11px] uppercase tracking-[0.15em] text-white/75">
                  {t('home.join-panel-point-3')}
                </p>
              </div>

              <div className="mt-auto pt-6">
                <button
                  type="button"
                  onClick={() => {
                    setMailChoiceError(null);
                    setIsMailChoiceOpen(true);
                  }}
                  className="inline-block border border-white bg-white px-5 py-3 font-['Space_Grotesk'] text-xs font-black uppercase tracking-[0.16em] text-black transition hover:bg-transparent hover:text-white"
                >
                  {t('home.join-panel-cta')}
                </button>
                <p className="mt-3 font-['Space_Grotesk'] text-[11px] uppercase tracking-[0.14em] text-white/55">
                  {t('home.join-panel-note')}
                </p>
              </div>
            </div>
          </aside>

          {isMailChoiceOpen && (
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4">
              <div className="w-full max-w-sm border border-white/20 bg-black p-5 shadow-2xl">
                <p className="font-['Space_Grotesk'] text-xs uppercase tracking-[0.16em] text-white/70">
                  Proponer programa
                </p>
                <h5 className="mt-2 font-['Space_Grotesk'] text-lg font-bold uppercase tracking-tight text-white">
                  Abrir correo prellenado
                </h5>
                <p className="mt-3 font-['Space_Grotesk'] text-sm leading-relaxed text-white/65">
                  No enviamos nada automáticamente. Se abrirá tu correo con el mensaje listo para revisar.
                </p>
                <div className="mt-5 grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={() => openJoinMail('system')}
                    className="border border-white bg-white px-4 py-3 font-['Space_Grotesk'] text-xs font-black uppercase tracking-[0.16em] text-black transition hover:bg-transparent hover:text-white"
                  >
                    Usar mi app de correo
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => openJoinMail('gmail')}
                      className="border border-white/30 px-4 py-3 font-['Space_Grotesk'] text-xs font-bold uppercase tracking-[0.16em] text-white transition hover:border-white hover:bg-white hover:text-black"
                    >
                      Gmail web
                    </button>
                    <button
                      type="button"
                      onClick={() => openJoinMail('outlook')}
                      className="border border-white/30 px-4 py-3 font-['Space_Grotesk'] text-xs font-bold uppercase tracking-[0.16em] text-white transition hover:border-white hover:bg-white hover:text-black"
                    >
                      Outlook web
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMailChoiceOpen(false)}
                  className="mt-4 text-xs uppercase tracking-[0.16em] text-white/60 hover:text-white"
                >
                  Cancelar
                </button>
                {mailChoiceError && (
                  <p className="mt-3 text-[11px] uppercase tracking-[0.14em] text-rose-300">
                    {mailChoiceError}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

    </section>
  );
};

export default HomePage;
