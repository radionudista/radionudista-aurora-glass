import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { endOfWeek, startOfWeek, subWeeks } from 'date-fns';
import { calendarService } from '../services/calendarService';
import { findLiveEvent, resolveLiveProgram, type ResolvedLiveProgram } from '../utils/liveSchedule';
import { useContentIndexData } from './useEditorContent';

import { DEFAULT_PROGRAM_LOGO, resolveProgramLogoSrc } from '../utils/programLogo';

const HOME_RECENT_LIMIT = 4;
const HOME_LOOKBACK_WEEKS = 8;

/**
 * Semana actual (lun–dom) del calendario y programa en emisión en este instante.
 * Reutiliza la misma query que la grilla de schedule (`schedule` + rango ISO).
 */
export function useLiveProgram() {
  const { i18n } = useTranslation();
  const contentIndexData = useContentIndexData();
  const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const currentWeekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });

  const { data: events, isLoading, isError, isFetching } = useQuery({
    queryKey: [
      'home-schedule-lookback',
      currentWeekStart.toISOString(),
      currentWeekEnd.toISOString(),
      HOME_RECENT_LIMIT,
      HOME_LOOKBACK_WEEKS,
    ],
    queryFn: async () => {
      const collected = new Map<string, (Awaited<ReturnType<typeof calendarService.getWeeklySchedule>>)[number]>();

      for (let weekOffset = 0; weekOffset <= HOME_LOOKBACK_WEEKS; weekOffset += 1) {
        const weekDate = subWeeks(new Date(), weekOffset);
        const weekStart = startOfWeek(weekDate, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(weekDate, { weekStartsOn: 1 });
        const weekEvents = await calendarService.getWeeklySchedule(weekStart, weekEnd);

        for (const event of weekEvents) {
          const key = `${event.id}-${event.startTime.toISOString()}`;
          collected.set(key, event);
        }

        const now = Date.now();
        const endedEventsCount = Array.from(collected.values()).filter(
          (event) => event.endTime.getTime() < now
        ).length;
        if (endedEventsCount >= HOME_RECENT_LIMIT) {
          break;
        }
      }

      return Array.from(collected.values());
    },
    staleTime: 1000 * 60 * 5,
    refetchInterval: 60 * 1000,
  });

  const live = useMemo(() => {
    if (!events?.length) {
      return { liveEvent: null as null, program: null as ResolvedLiveProgram | null };
    }
    const liveEvent = findLiveEvent(events, new Date());
    if (!liveEvent) {
      return { liveEvent: null as null, program: null as ResolvedLiveProgram | null };
    }
    const program = resolveLiveProgram(liveEvent, i18n.language, contentIndexData);
    return { liveEvent, program };
  }, [events, i18n.language, contentIndexData]);

  const pastPrograms = useMemo(() => {
    if (!events?.length) return [] as ResolvedLiveProgram[];
    const now = Date.now();
    return events
      .filter((event) => event.endTime.getTime() < now)
      .sort((a, b) => b.endTime.getTime() - a.endTime.getTime())
      .slice(0, HOME_RECENT_LIMIT)
      .map((event) => resolveLiveProgram(event, i18n.language, contentIndexData));
  }, [events, i18n.language, contentIndexData]);

  const heroImageUrl = useMemo(() => {
    if (!live.liveEvent) return DEFAULT_PROGRAM_LOGO;
    if (live.program?.logoFile) return resolveProgramLogoSrc(live.program.logoFile);
    return DEFAULT_PROGRAM_LOGO;
  }, [live.liveEvent, live.program]);

  return {
    liveEvent: live.liveEvent,
    program: live.program,
    pastPrograms,
    heroImageUrl,
    isLive: Boolean(live.liveEvent),
    isLoading,
    isError,
    isFetching,
  };
}

export { DEFAULT_PROGRAM_LOGO as FALLBACK_LOGO };
