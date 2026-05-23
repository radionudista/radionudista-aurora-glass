export interface ProgramScheduleMeta {
  weekday: number; // 1..7 (Mon..Sun)
  startTime: string; // HH:mm in source timezone
  timezone: string; // IANA timezone
  durationMin?: number;
}

const WEEKDAY_LABELS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const isProgramScheduleMeta = (value: unknown): value is ProgramScheduleMeta => {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.weekday === 'number' &&
    v.weekday >= 1 &&
    v.weekday <= 7 &&
    typeof v.startTime === 'string' &&
    /^\d{2}:\d{2}$/.test(v.startTime) &&
    typeof v.timezone === 'string'
  );
};

const getPartsInTimeZone = (
  date: Date,
  timeZone: string
): { weekday: number; hour: number; minute: number } => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const weekdayStr = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon';
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  const weekday = Math.max(1, WEEKDAY_LABELS_EN.indexOf(weekdayStr) + 1);
  return { weekday, hour, minute };
};

const getUtcOffsetMinutes = (timeZone: string, date: Date): number => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset',
  }).formatToParts(date);
  const token = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+0';
  const match = token.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) return 0;
  const sign = match[1] === '-' ? -1 : 1;
  const h = Number(match[2] || 0);
  const m = Number(match[3] || 0);
  return sign * (h * 60 + m);
};

const getLocalizedWeekday = (weekday: number, locale: string, style: 'short' | 'long' = 'long'): string => {
  const mondayUtc = Date.UTC(2024, 0, 1); // Monday
  const date = new Date(mondayUtc + (Math.max(1, Math.min(7, weekday)) - 1) * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat(locale, { weekday: style, timeZone: 'UTC' }).format(date);
};

const toHHMM = (minsInDay: number): string => {
  const total = ((minsInDay % 1440) + 1440) % 1440;
  const hh = String(Math.floor(total / 60)).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}`;
};

export const formatProgramScheduleForViewer = (
  scheduleMeta: ProgramScheduleMeta,
  viewerDate: Date = new Date(),
  locale = 'es',
  options?: { includeSourceTimezone?: boolean }
): string => {
  const includeSourceTimezone = options?.includeSourceTimezone ?? false;
  const [sourceHh, sourceMm] = scheduleMeta.startTime.split(':').map(Number);
  const sourceMins = sourceHh * 60 + sourceMm;
  const sourceOffset = getUtcOffsetMinutes(scheduleMeta.timezone, viewerDate);
  const localOffset = -viewerDate.getTimezoneOffset();
  const delta = localOffset - sourceOffset;
  const localMinsRaw = sourceMins + delta;
  const dayShift = Math.floor(localMinsRaw / 1440);
  const localWeekday = (((scheduleMeta.weekday - 1 + dayShift) % 7) + 7) % 7 + 1;
  const localWeekdayLabel = getLocalizedWeekday(localWeekday, locale);
  const sourceWeekdayLabel = getLocalizedWeekday(scheduleMeta.weekday, locale);
  const localHHMM = toHHMM(localMinsRaw);
  if (!includeSourceTimezone) {
    return `${localWeekdayLabel}, ${localHHMM}`;
  }
  return `${sourceWeekdayLabel}, ${scheduleMeta.startTime} (${scheduleMeta.timezone}) → ${localWeekdayLabel}, ${localHHMM}`;
};

export const formatProgramScheduleSource = (
  scheduleMeta: ProgramScheduleMeta,
  locale = 'es'
): string => {
  const sourceWeekdayLabel = getLocalizedWeekday(scheduleMeta.weekday, locale);
  return `${sourceWeekdayLabel}, ${scheduleMeta.startTime}`;
};

export const scheduleMetaToLegacyString = (scheduleMeta: ProgramScheduleMeta): string => {
  const day = WEEKDAY_LABELS_EN[scheduleMeta.weekday - 1] ?? 'Mon';
  return `${day} ${scheduleMeta.startTime} - ${scheduleMeta.timezone}`;
};

/**
 * Returns the most recent past date (YYYY-MM-DD) on which the program would
 * have aired, based on its scheduled weekday in its source timezone.
 * If today is that weekday but the broadcast hasn't started yet, returns
 * the previous occurrence (7 days earlier).
 */
export const nearestPastOccurrence = (
  scheduleMeta: ProgramScheduleMeta,
  now: Date = new Date()
): string => {
  const [hh, mm] = scheduleMeta.startTime.split(':').map(Number);
  // Build a UTC timestamp representing "today at startTime in source timezone"
  const sourceOffset = (() => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: scheduleMeta.timezone,
      timeZoneName: 'shortOffset',
    }).formatToParts(now);
    const token = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+0';
    const m = token.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/);
    if (!m) return 0;
    const sign = m[1] === '-' ? -1 : 1;
    return sign * (Number(m[2]) * 60 + Number(m[3] ?? 0));
  })();

  // Current date parts in source timezone
  const sourceParts = new Intl.DateTimeFormat('en-US', {
    timeZone: scheduleMeta.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) => Number(sourceParts.find((p) => p.type === type)?.value ?? '0');
  const sourceYear = get('year');
  const sourceMonth = get('month') - 1;
  const sourceDay = get('day');
  const sourceHour = get('hour');
  const sourceMinute = get('minute');

  // Day of week in source tz (1=Mon..7=Sun)
  const sourceDate = new Date(Date.UTC(sourceYear, sourceMonth, sourceDay));
  const jsDay = sourceDate.getUTCDay(); // 0=Sun
  const sourceWeekday = jsDay === 0 ? 7 : jsDay;

  // Days to go back to reach the scheduled weekday
  let daysBack = (sourceWeekday - scheduleMeta.weekday + 7) % 7;

  // If today is the right weekday but the show hasn't started yet, go back a week
  if (daysBack === 0) {
    const nowMins = sourceHour * 60 + sourceMinute;
    const scheduledMins = hh * 60 + mm;
    if (nowMins < scheduledMins) daysBack = 7;
  }

  const result = new Date(Date.UTC(sourceYear, sourceMonth, sourceDay - daysBack));
  return result.toISOString().slice(0, 10);
};

/**
 * Returns true when the episode is past its release time in the viewer's local
 * timezone. Release = broadcast start + releaseAfterMin (default 60 min).
 *
 * Uses the calendar event's endTime when available (most accurate), or falls
 * back to schedule_meta + episode.date.
 */
export const isEpisodeReleased = (
  episodeDate: string,
  scheduleMeta: ProgramScheduleMeta | null | undefined,
  now: Date = new Date(),
  releaseAfterMin = 60,
  eventEndTime?: Date
): boolean => {
  if (eventEndTime) return now.getTime() >= eventEndTime.getTime();
  if (!scheduleMeta) return true; // No schedule info → always visible

  const [hh, mm] = scheduleMeta.startTime.split(':').map(Number);
  // Construct a UTC instant for "episodeDate at startTime in source timezone"
  const [y, mo, d] = episodeDate.split('-').map(Number);
  // Get offset for that specific date in source timezone
  const refDate = new Date(Date.UTC(y, mo - 1, d, hh, mm, 0));
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: scheduleMeta.timezone,
    timeZoneName: 'shortOffset',
  }).formatToParts(refDate);
  const token = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+0';
  const match = token.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/);
  const offsetMin = match
    ? (match[1] === '-' ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3] ?? 0))
    : 0;

  const broadcastStartUtcMs =
    Date.UTC(y, mo - 1, d, hh, mm, 0) - offsetMin * 60_000;
  const releaseUtcMs = broadcastStartUtcMs + releaseAfterMin * 60_000;
  return now.getTime() >= releaseUtcMs;
};

export interface ScheduleAnomaly {
  key: string;
  kind: 'out_of_slot' | 'overlap';
  message: string;
  programId?: string;
}

export const detectScheduleAnomalies = (input: {
  events: Array<{
    id: string;
    title: string;
    startTime: Date;
    endTime: Date;
    programId?: string;
  }>;
  expectedByProgram: Record<string, ProgramScheduleMeta>;
  titleToProgramId: Record<string, string>;
  toleranceMin?: number;
}): ScheduleAnomaly[] => {
  const { events, expectedByProgram, titleToProgramId, toleranceMin = 20 } = input;
  const anomalies: ScheduleAnomaly[] = [];

  const sorted = [...events].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  for (let i = 0; i < sorted.length; i += 1) {
    const ev = sorted[i];
    const idFromTitle = titleToProgramId[ev.title.toLowerCase().trim()];
    const pid = (ev.programId || idFromTitle || '').toLowerCase();
    const expected = expectedByProgram[pid];
    if (expected) {
      const p = getPartsInTimeZone(ev.startTime, expected.timezone);
      const [hh, mm] = expected.startTime.split(':').map(Number);
      const diff = Math.abs((p.hour * 60 + p.minute) - (hh * 60 + mm));
      if (p.weekday !== expected.weekday || diff > toleranceMin) {
        anomalies.push({
          key: `out_of_slot:${ev.id}:${pid}`,
          kind: 'out_of_slot',
          programId: pid || undefined,
          message: `${ev.title} fuera de horario esperado`,
        });
      }
    }

    if (i < sorted.length - 1) {
      const next = sorted[i + 1];
      if (next.startTime.getTime() < ev.endTime.getTime()) {
        anomalies.push({
          key: `overlap:${ev.id}:${next.id}`,
          kind: 'overlap',
          message: `Solapamiento entre "${ev.title}" y "${next.title}"`,
        });
      }
    }
  }

  return anomalies;
};

