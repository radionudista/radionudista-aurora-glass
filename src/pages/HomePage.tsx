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
import EditableImageField from '../components/EditableImageField';
import {
  DEFAULT_PROGRAM_LOGO,
  resolveProgramLogoSrc,
} from '../utils/programLogo';

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
      queryKey: ['home-episodes-for-event', past.programId ?? 'no-program', past.event.id, lang],
      queryFn: () =>
        past.programId
          ? episodeService.getEpisodesByProgram(past.programId, lang)
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

  const contactPath = `/${i18n.language}/contacto`;

  const manifestKicker =
    resolveEditorialText(editorial?.home.manifestKicker, lang) || t('home.manifest-kicker');
  const manifestTitle =
    resolveEditorialText(editorial?.home.manifestTitle, lang) || t('home.manifest-title');
  const manifestSubtitle =
    resolveEditorialText(editorial?.home.manifestSubtitle, lang) || t('home.manifest-subtitle');

  const defaultHeroUrl = resolveProgramLogoSrc(
    editorial?.home.defaultHeroImageUrl?.trim() || DEFAULT_PROGRAM_LOGO
  );
  const displayHeroUrl = isLive ? heroImageUrl : defaultHeroUrl;
  const defaultHeroValue = editorial?.home.defaultHeroImageUrl?.trim() ?? '';
  const hasCustomHomeHero =
    defaultHeroValue !== '' && defaultHeroValue !== DEFAULT_PROGRAM_LOGO;

  const canEditSite = Boolean(editor?.enabled && editor.canEditEditorial());
  const homeHeroEditor = canEditSite ? (
    <div className="absolute left-3 top-14 z-20 w-[min(100%,19rem)] md:left-4 md:top-20">
      <EditableImageField
        label="Imagen del home (sin programa en vivo)"
        previewSrc={defaultHeroUrl}
        valueForEdit={defaultHeroValue}
        uploadScope="home-hero"
        programId="home"
        onCommit={(next) => editor.commitHomeDefaultHeroImage(next)}
        onAfterFileUpload={(url, message) => editor.applyUploadedHomeHero(url, message)}
        canReset={hasCustomHomeHero}
        onReset={() => editor.commitHomeDefaultHeroImage('')}
        resetLabel="Quitar imagen (volver al logo)"
        helpText="Se muestra cuando no hay programa en antena. En vivo se usa el logo del programa."
      />
      {isLive ? (
        <p className="mt-2 border border-amber-400/30 bg-black/75 px-2 py-1.5 font-mono text-[9px] uppercase tracking-wider text-amber-200/80">
          Ahora en vivo: el fondo usa el logo del programa.
        </p>
      ) : null}
    </div>
  ) : null;

  return (
    <section className="relative flex-1 w-full bg-black">
      <div className="relative min-h-[calc(100dvh-5rem)] overflow-hidden">
        {/* Imagen de marca: programa en vivo (calendario) o logo de la radio */}
        <div
          className="absolute inset-0 bg-black bg-no-repeat bg-center transition-[background-image] duration-500"
          style={{
            backgroundImage: `url(${displayHeroUrl})`,
            backgroundSize: 'cover',
          }}
          role="img"
          aria-label={program?.title ?? 'Radio Nudista'}
        />

        {homeHeroEditor}

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
                  : resolveProgramLogoSrc(past.logoFile);

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
            {canEditSite ? (
              <InlineEditableText
                as="p"
                align="center"
                textClassName="font-['Space_Grotesk'] text-[10px] uppercase tracking-[0.22em] text-white/65"
                value={manifestKicker}
                language={lang}
                localizedValues={editorial?.home.manifestKicker}
                onCommit={(next) => editor.commitEditorialField('home', 'manifestKicker', lang, next)}
                onCommitLocalized={(values) =>
                  editor.commitEditorialFieldLocalized('home', 'manifestKicker', values)
                }
              />
            ) : (
              <p className="font-['Space_Grotesk'] text-[10px] uppercase tracking-[0.22em] text-white/65">
                {manifestKicker}
              </p>
            )}
            {canEditSite ? (
              <InlineEditableText
                as="h3"
                size="lg"
                align="center"
                className="mt-4 max-w-4xl"
                textClassName="font-['Space_Grotesk'] text-3xl font-black uppercase leading-[0.95] tracking-tight text-white md:text-5xl"
                value={manifestTitle}
                language={lang}
                localizedValues={editorial?.home.manifestTitle}
                onCommit={(next) => editor.commitEditorialField('home', 'manifestTitle', lang, next)}
                onCommitLocalized={(values) =>
                  editor.commitEditorialFieldLocalized('home', 'manifestTitle', values)
                }
              />
            ) : (
              <h3 className="mt-4 max-w-4xl font-['Space_Grotesk'] text-3xl font-black uppercase leading-[0.95] tracking-tight text-white md:text-5xl">
                {manifestTitle}
              </h3>
            )}
            {canEditSite ? (
              <InlineEditableText
                as="div"
                className="mt-5 max-w-2xl"
                align="center"
                textClassName="font-['Space_Grotesk'] text-sm uppercase tracking-[0.14em] text-white/75 md:text-base"
                value={manifestSubtitle}
                language={lang}
                localizedValues={editorial?.home.manifestSubtitle}
                onCommit={(next) => editor.commitEditorialField('home', 'manifestSubtitle', lang, next)}
                onCommitLocalized={(values) =>
                  editor.commitEditorialFieldLocalized('home', 'manifestSubtitle', values)
                }
              />
            ) : (
              <p className="mt-5 max-w-2xl font-['Space_Grotesk'] text-sm uppercase tracking-[0.14em] text-white/75 md:text-base">
                {manifestSubtitle}
              </p>
            )}
            <Link
              to={contactPath}
              className="mt-6 inline-block border border-white/45 px-5 py-2 font-['Space_Grotesk'] text-xs font-bold uppercase tracking-[0.18em] text-white transition hover:bg-white hover:text-black"
            >
              {t('home.manifest-join-link')}
            </Link>
          </div>
        </div>
      </section>

    </section>
  );
};

export default HomePage;
