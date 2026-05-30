import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import DOMPurify from 'dompurify';
import { useSchedule } from '../hooks/useSchedule';
import { ScheduleEvent } from '../types';
import { addDays, format, isSameWeek, startOfWeek } from 'date-fns';
import { episodeService } from '../services/episodeService';
import MediaButton from '../components/ui/MediaButton';
import { useContentIndexData } from '../hooks/useEditorContent';
import { useArchivePlayer } from '../contexts/ArchivePlayerContext';
import {
  PAGE_SCREEN_TITLE_CLASS,
  PAGE_SHELL_BELOW_NAV,
  PAGE_SHELL_CONTENT,
} from '../constants/layoutConstants';
import { isEpisodeReleased, isProgramScheduleMeta } from '../utils/programSchedule';
const SchedulePage: React.FC = () => {
    const contentIndexData = useContentIndexData();
    const archivePlayer = useArchivePlayer();
    const { t, i18n } = useTranslation();
    const { groupedEvents, isLoading, isError, currentDate, nextWeek, prevWeek, goToToday } = useSchedule();
    const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | null>(null);
    const [mobileSelectedDay, setMobileSelectedDay] = useState<number>(() => {
        const today = new Date().getDay();
        return today === 0 ? 7 : today; // Map Sunday to 7
    });
    const now = new Date();

    // Merge metadata
    const programMetadata = React.useMemo(() => {
        if (!selectedEvent) return null;
        let match: Record<string, Record<string, unknown>> | null = null;
        
        // 1. By ID
        if (selectedEvent.programId) {
             const key = selectedEvent.programId.toLowerCase();
             if (contentIndexData[key as keyof typeof contentIndexData]) {
                 match = contentIndexData[key as keyof typeof contentIndexData] as Record<string, Record<string, unknown>>;
             }
        }
        
        // 2. By Title
        if (!match) {
             const titleLower = selectedEvent.title.toLowerCase();
             match =
                (Object.values(contentIndexData).find((prog) => {
                    if (!prog || typeof prog !== 'object') return false;
                    const typed = prog as { es?: { title?: string } };
                    return Boolean(typed.es?.title && typed.es.title.toLowerCase() === titleLower);
                }) as Record<string, Record<string, unknown>> | undefined) ?? null;
        }

        if (match) {
            const lang = i18n.language || 'es';
            return match[lang] || match.es;
        }
        return null;
    }, [contentIndexData, selectedEvent, i18n.language]);

    const selectedProgramId = programMetadata?.id || selectedEvent?.programId || null;
    const sanitizedEventDescription = React.useMemo(() => {
        if (!selectedEvent?.description) return '';
        return DOMPurify.sanitize(selectedEvent.description, {
            ALLOWED_TAGS: ['p', 'br', 'a', 'strong', 'b', 'em', 'i', 'ul', 'ol', 'li'],
            ALLOWED_ATTR: ['href', 'title', 'rel'],
        });
    }, [selectedEvent?.description]);

    const { data: selectedProgramEpisodes } = useQuery({
        queryKey: ['episodes', selectedProgramId],
        queryFn: () => episodeService.getEpisodesByProgram(selectedProgramId as string),
        enabled: Boolean(selectedProgramId),
        staleTime: 1000 * 60 * 10
    });

    const latestEpisode = React.useMemo(() => {
        if (!selectedProgramEpisodes?.episodes?.length) return null;

        const scheduleMeta = isProgramScheduleMeta(programMetadata?.schedule_meta)
          ? programMetadata.schedule_meta
          : null;
        const releasedEpisodes = selectedProgramEpisodes.episodes.filter((episode) =>
          isEpisodeReleased(episode.date, scheduleMeta)
        );
        if (releasedEpisodes.length === 0) return null;

        return [...releasedEpisodes].sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        )[0];
    }, [selectedProgramEpisodes, programMetadata]);

    const selectedProgramAudio = useMemo(() => {
        if (!selectedEvent || !latestEpisode) return null;

        const programTitle = programMetadata?.title || selectedEvent.title;
        const programId = programMetadata?.id || selectedEvent.programId || selectedEvent.id;

        return {
            id: latestEpisode.id,
            title: `${programTitle} / ${latestEpisode.title}`,
            audioSource: latestEpisode.audioUrl
        };
    }, [latestEpisode, programMetadata, selectedEvent]);

    const weekStart = useMemo(
        () => startOfWeek(currentDate, { weekStartsOn: 1 }),
        [currentDate]
    );

    const dayHeaders = useMemo(
        () =>
            Array.from({ length: 7 }).map((_, index) => {
                const date = addDays(weekStart, index);
                return {
                    dayIndex: index + 1,
                    label: format(date, 'EEE'),
                    dayNumber: format(date, 'd'),
                };
            }),
        [weekStart]
    );

    const isTodayInCurrentWeek = useMemo(
        () => isSameWeek(now, currentDate, { weekStartsOn: 1 }),
        [now, currentDate]
    );

    const currentDayIndex = useMemo(() => {
        const day = now.getDay();
        return day === 0 ? 7 : day;
    }, [now]);

    const nowTop = useMemo(() => (now.getHours() + now.getMinutes() / 60) * 32, [now]);
    const nowLineLeft = useMemo(() => `${((currentDayIndex - 1) / 7) * 100}%`, [currentDayIndex]);

    const hoursArray = Array.from({ length: 24 }).map((_, i) => i);

    const getEventDurationHours = (event: ScheduleEvent) => {
        const startHour = event.startTime.getHours() + event.startTime.getMinutes() / 60;
        const endHour = event.endTime.getHours() + event.endTime.getMinutes() / 60;
        let duration = endHour - startHour;
        if (duration < 0) duration += 24; // If crosses midnight
        return duration;
    };

    // Helper to calculate position in the grid
    const getEventStyle = (event: ScheduleEvent) => {
        const startHour = event.startTime.getHours() + event.startTime.getMinutes() / 60;
        const duration = getEventDurationHours(event);
        
        // 1 hour = 32px (because a 2-hour block is h-16 = 64px)
        const top = startHour * 32;
        const height = duration * 32;

        return {
            top: `${top}px`,
            height: `${height}px`,
            backgroundColor: event.color || '#ffffff',
            color: event.color && event.color !== '#ffffff' ? '#000000' : '#000000',
        };
    };

    const episodeIsPlaying = Boolean(
        selectedProgramAudio && archivePlayer.activeEpisode?.episodeId === selectedProgramAudio.id
    );

    return (
        <div className="relative bg-black font-['Inter'] text-white">
            <style dangerouslySetInnerHTML={{__html: `
                    .grid-lines {
                    background-image: linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px),
                                      linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px);
                    background-size: 100% 32px;
                }
                .glitch-hover:hover {
                    box-shadow: 2px 2px 0px #ffffff;
                    transform: translate(-1px, -1px);
                }
            `}} />

            <div className="absolute inset-0 bg-black z-0 pointer-events-none" />

            <main className={`relative z-10 ${PAGE_SHELL_BELOW_NAV}`}>
                {/* Calendar Header */}
                <header
                    className={`${PAGE_SHELL_CONTENT} mb-12 flex flex-col gap-4 md:flex-row md:items-start md:justify-between`}
                >
                    <div>
                        <h1 className="font-['Space_Grotesk'] text-[2.7rem] font-black uppercase leading-[0.9] tracking-tighter text-white sm:text-6xl md:text-8xl break-words">
                            {t('navigation.programacion')}
                        </h1>
                        <p className="font-['Space_Grotesk'] text-xs tracking-widest text-[#919191] mt-4 uppercase">
                            [ {format(currentDate, "MMM yyyy")} / WEEK {format(currentDate, "w")} ]
                        </p>
                    </div>
                    <div className="flex flex-col items-end gap-4">
                        <div className="flex gap-4 mb-2">
                            <button onClick={goToToday} className="uppercase text-xs font-['Space_Grotesk'] border border-white/20 px-3 py-1 hover:bg-white hover:text-black transition-colors">{t('common.today') || 'Hoy'}</button>
                            <button onClick={prevWeek} className="uppercase text-xs font-['Space_Grotesk'] border border-white/20 px-3 py-1 hover:bg-white hover:text-black transition-colors">{t('common.previous') || 'Prev'}</button>
                            <button onClick={nextWeek} className="uppercase text-xs font-['Space_Grotesk'] border border-white/20 px-3 py-1 hover:bg-white hover:text-black transition-colors">{t('common.next') || 'Next'}</button>
                        </div>

                    </div>
                </header>

                <div className="grid w-full grid-cols-1 border-t border-b border-white/10 lg:grid-cols-12">
                    {/* Mobile Layout */}
                    <div className="lg:hidden border-b border-white/10">
                        <div className="px-4 py-5 space-y-4">
                            <div className="flex gap-2 overflow-x-auto pb-1">
                                {dayHeaders.map((day) => (
                                    <button
                                        key={day.dayIndex}
                                        onClick={() => setMobileSelectedDay(day.dayIndex)}
                                        className={`shrink-0 px-3 py-2 border text-xs font-['Space_Grotesk'] uppercase tracking-widest transition-colors ${
                                            mobileSelectedDay === day.dayIndex
                                                ? 'bg-white text-black border-white'
                                                : 'bg-transparent text-[#c6c6c6] border-white/20 hover:border-white/40'
                                        }`}
                                    >
                                        {day.label} {day.dayNumber}
                                    </button>
                                ))}
                            </div>

                            {isLoading ? (
                                <div className="py-8 text-center text-[#919191] font-['Space_Grotesk'] tracking-widest uppercase">
                                    {t('common.loading') || 'Loading...'}
                                </div>
                            ) : isError ? (
                                <div className="py-8 text-center text-[#ffb4ab] font-['Space_Grotesk'] tracking-widest uppercase">
                                    {t('common.error') || 'Error loading schedule'}
                                </div>
                            ) : (groupedEvents.get(mobileSelectedDay) || []).length === 0 ? (
                                <div className="py-8 text-center text-[#919191] font-['Space_Grotesk'] text-xs tracking-widest uppercase border border-white/10 bg-black">
                                    No programs for this day
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {(groupedEvents.get(mobileSelectedDay) || [])
                                        .slice()
                                        .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
                                        .map((event) => (
                                            <button
                                                key={event.id}
                                                onClick={() => setSelectedEvent(event)}
                                                className={`w-full text-left border p-4 transition-colors ${
                                                    selectedEvent?.id === event.id
                                                        ? 'border-white bg-white text-black'
                                                        : 'border-white/15 bg-black hover:border-white/40'
                                                }`}
                                            >
                                                <p className="font-['Space_Grotesk'] text-[10px] uppercase tracking-widest opacity-70 mb-2">
                                                    {format(event.startTime, 'HH:mm')} — {format(event.endTime, 'HH:mm')}
                                                </p>
                                                <p className="font-['Space_Grotesk'] text-lg font-bold uppercase leading-tight">
                                                    {event.title}
                                                </p>
                                            </button>
                                        ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Desktop Grid Layout */}
                    <div className="hidden lg:block lg:col-span-8 border-r border-white/10 relative overflow-x-auto">
                        <div className="min-w-[800px]">
                            {/* Days Header */}
                            <div className="grid grid-cols-8 border-b border-white/10">
                                <div className="p-4 border-r border-white/10 font-['Space_Grotesk'] text-[10px] text-[#919191] uppercase tracking-widest">
                                    <span>Time</span>
                                    <span className="block normal-case text-[9px] text-[#555] mt-0.5 truncate" title={Intl.DateTimeFormat().resolvedOptions().timeZone}>
                                        {Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/_/g, ' ')}
                                    </span>
                                </div>
                                {dayHeaders.map((day, i) => (
                                    <div key={day.dayIndex} className={`p-4 ${i < 6 ? 'border-r' : ''} border-white/10 font-['Space_Grotesk'] text-xs uppercase tracking-widest`}>
                                        {day.label} {day.dayNumber}
                                    </div>
                                ))}
                            </div>

                            {/* Time Slots & Content */}
                            {isLoading ? (
                                <div className="p-12 text-center text-[#919191] font-['Space_Grotesk'] tracking-widest uppercase">{t('common.loading') || 'Loading...'}</div>
                            ) : isError ? (
                                <div className="p-12 text-center text-[#ffb4ab] font-['Space_Grotesk'] tracking-widest uppercase">{t('common.error') || 'Error loading schedule'}</div>
                            ) : (
                                <div className="relative grid grid-cols-8 grid-lines" style={{ height: '768px' }}>
                                    {/* Y-Axis Time Labels */}
                                    <div className="flex flex-col border-r border-white/10">
                                        {hoursArray.map((hour) => (
                                            <div key={hour} className="h-8 px-2 flex items-center font-['Space_Grotesk'] text-[10px] text-[#919191]">
                                                {String(hour).padStart(2, '0')}:00
                                            </div>
                                        ))}
                                    </div>

                                    {/* Calendar Blocks */}
                                    <div className="col-span-7 grid grid-cols-7 relative">
                                        {isTodayInCurrentWeek && (
                                            <>
                                                <div
                                                    className="pointer-events-none absolute z-20 h-px bg-red-400/80"
                                                    style={{ top: `${nowTop}px`, left: nowLineLeft, width: '14.28%' }}
                                                    aria-hidden
                                                />
                                                <div
                                                    className="pointer-events-none absolute z-20 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-400"
                                                    style={{ top: `${nowTop}px`, left: nowLineLeft }}
                                                    aria-hidden
                                                />
                                            </>
                                        )}
                                        {Array.from({ length: 7 }).map((_, index) => {
                                            const dayIndex = index + 1; // 1 to 7
                                            const dayEvents = groupedEvents.get(dayIndex) || [];
                                            const leftPosition = `${(index / 7) * 100}%`;
                                            const width = `14.28%`; // 1/7

                                            return dayEvents.map(event => (
                                                (() => {
                                                    const isCompactEvent = getEventDurationHours(event) <= 1;
                                                    return (
                                                <div 
                                                    key={event.id}
                                                    onClick={() => setSelectedEvent(event)}
                                                    className={`absolute w-[14.28%] flex flex-col cursor-pointer transition-colors z-10 border border-[#131313] hover:z-20 hover:border-white ${
                                                        isCompactEvent ? 'p-1 justify-center' : 'p-2'
                                                    }`}
                                                    style={{
                                                        ...getEventStyle(event),
                                                        left: leftPosition,
                                                        backgroundColor: event.id === selectedEvent?.id ? '#ffffff' : (event.color || '#e2e2e2'),
                                                        color: '#000000'
                                                    }}
                                                >
                                                    <span className="block font-['Space_Grotesk'] font-bold text-xs leading-tight uppercase truncate">
                                                        {event.title}
                                                    </span>
                                                    {!isCompactEvent && (
                                                        <span className="font-['Space_Grotesk'] text-[9px] font-bold uppercase mt-1 opacity-70">
                                                            {format(event.startTime, 'HH:mm')} — {format(event.endTime, 'HH:mm')}
                                                        </span>
                                                    )}
                                                </div>
                                                    );
                                                })()
                                            ));
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Detailed View Panel */}
                    <aside className="lg:col-span-4 bg-black p-8 border-b border-white/10 lg:border-b-0 min-h-[768px]">
                        <div className="sticky top-24">
                            {selectedEvent ? (
                                <>
                                    {programMetadata?.logo && (
                                        <div className="mb-6 bg-[#000000] aspect-square overflow-hidden relative">
                                            <img 
                                                src={`/images/logos/${programMetadata.logo}`} 
                                                alt={selectedEvent.title} 
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                    )}

                                    <div className="mb-6">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="bg-white text-black font-['Space_Grotesk'] text-[10px] px-2 py-0.5 uppercase tracking-widest font-bold">Selected Program</span>
                                            <span className="font-['Space_Grotesk'] text-[10px] uppercase tracking-widest text-[#919191]">
                                                {programMetadata ? '[ ARCHIVE AVL ]' : ''}
                                            </span>
                                        </div>
                                        <h2 className="font-['Space_Grotesk'] text-5xl font-black uppercase tracking-tighter leading-none mb-4 break-words">
                                            {programMetadata?.title || selectedEvent.title}
                                        </h2>
                                        
                                        <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-4 mb-6">
                                            
                                            {programMetadata?.talent && programMetadata.talent.length > 0 && (
                                                <div>
                                                    <p className="font-['Space_Grotesk'] text-[10px] text-[#919191] uppercase mb-1">Host</p>
                                                    <p className="font-['Space_Grotesk'] text-sm uppercase font-bold whitespace-nowrap overflow-hidden text-ellipsis">
                                                        {programMetadata.talent.join(', ')}
                                                    </p>
                                                </div>
                                            )}
                                            
                                            <div>
                                                <p className="font-['Space_Grotesk'] text-[10px] text-[#919191] uppercase mb-1">Genre</p>
                                                <p className="font-['Space_Grotesk'] text-sm uppercase font-bold">
                                                    EXPERIMENTAL / {programMetadata?.genre || 'ALTERNATIVE'}
                                                </p>
                                            </div>

                                            <div>
                                                <p className="font-['Space_Grotesk'] text-[10px] text-[#919191] uppercase mb-1">Time</p>
                                                <p className="font-['Space_Grotesk'] text-sm uppercase">
                                                    {format(selectedEvent.startTime, 'HH:mm')} — {format(selectedEvent.endTime, 'HH:mm')}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="font-['Space_Grotesk'] text-[10px] text-[#919191] uppercase mb-1">Frequency</p>
                                                <p className="font-['Space_Grotesk'] text-sm uppercase">
                                                    WEEKLY ({format(selectedEvent.startTime, 'EEE')})
                                                </p>
                                            </div>
                                        </div>

                                        {programMetadata?.content ? (
                                            <div className="text-sm text-[#c6c6c6] leading-relaxed mb-8 font-['Inter'] whitespace-pre-wrap">
                                                {programMetadata.content.replace(/\*\*/g, '').split('\n').slice(0, 3).join('\n')}
                                            </div>
                                        ) : sanitizedEventDescription ? (
                                            <div 
                                                className="text-sm text-[#c6c6c6] leading-relaxed mb-8 prose prose-invert max-w-none prose-p:mb-2 prose-a:text-white"
                                                dangerouslySetInnerHTML={{ __html: sanitizedEventDescription }} 
                                            />
                                        ) : null}

                                        {latestEpisode && (
                                            <section className="mt-8 border-t border-white/10 pt-6">
                                                <p className="font-['Space_Grotesk'] text-[10px] text-[#919191] uppercase tracking-widest mb-2">
                                                    Ultimo episodio disponible
                                                </p>
                                                <h3 className="font-['Space_Grotesk'] text-xl uppercase font-bold tracking-tighter mb-1">
                                                    {latestEpisode.title}
                                                </h3>
                                                <p className="text-xs text-[#919191] uppercase tracking-widest mb-4">
                                                    {latestEpisode.date} · {latestEpisode.duration}
                                                </p>
                                                {selectedProgramAudio && (
                                                    <div className="flex items-center gap-3">
                                                        <MediaButton
                                                            isPlaying={episodeIsPlaying}
                                                            isLoading={false}
                                                            onClick={() =>
                                                                archivePlayer.openEpisode({
                                                                    episodeId: selectedProgramAudio.id,
                                                                    audioUrl: selectedProgramAudio.audioSource,
                                                                    title: selectedProgramAudio.title,
                                                                })
                                                            }
                                                            size="small"
                                                            className="border border-white/20 hover:bg-white/5"
                                                        />
                                                        <span className="text-[10px] uppercase tracking-widest text-[#919191]">
                                                            {episodeIsPlaying ? 'Sonando' : 'Reproducir'}
                                                        </span>
                                                    </div>
                                                )}
                                            </section>
                                        )}
                                        
                                    </div>
                                </>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-center opacity-50 py-20">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mb-4">
                                        <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
                                        <line x1="16" x2="16" y1="2" y2="6"/>
                                        <line x1="8" x2="8" y1="2" y2="6"/>
                                        <line x1="3" x2="21" y1="10" y2="10"/>
                                    </svg>
                                    <p className="font-['Space_Grotesk'] uppercase tracking-widest text-sm">Select a program to view details</p>
                                </div>
                            )}
                        </div>
                    </aside>
                </div>
            </main>

        </div>
    );
};

export default SchedulePage;
