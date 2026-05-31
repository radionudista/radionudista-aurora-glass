/** Pixels per hour in the desktop schedule grid (24h × this = total height). */
export const SCHEDULE_PX_PER_HOUR = 32;

export const SCHEDULE_GRID_HEIGHT_PX = 24 * SCHEDULE_PX_PER_HOUR;

/** Short events keep their real duration; this only prevents sub-20m events from disappearing. */
export const SCHEDULE_SHORT_EVENT_MAX_HOURS = 1;

export const SCHEDULE_MIN_EVENT_HEIGHT_PX = 10;

export const scheduleTimeToPx = (date: Date): number => {
  const hours =
    date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  return hours * SCHEDULE_PX_PER_HOUR;
};

export type ScheduleEventBlockRect = {
  topPx: number;
  heightPx: number;
  isShort: boolean;
};

export const scheduleEventBlockRect = (durationHours: number, start: Date): ScheduleEventBlockRect => {
  const topPx = scheduleTimeToPx(start);
  const naturalHeightPx = durationHours * SCHEDULE_PX_PER_HOUR;
  const isShort = durationHours < SCHEDULE_SHORT_EVENT_MAX_HOURS;
  const heightPx = Math.max(naturalHeightPx, SCHEDULE_MIN_EVENT_HEIGHT_PX);

  return { topPx, heightPx, isShort };
};
