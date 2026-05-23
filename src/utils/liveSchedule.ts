import type { ScheduleEvent } from '../types';
import type { ContentIndexData } from '../editor/contracts';

export interface ResolvedLiveProgram {
  event: ScheduleEvent;
  title: string;
  logoFile: string | null;
  programId: string | null;
  slug: string | null;
  blurb: string | null;
}

/** Evento cuyo horario contiene `at` (inicio inclusive, fin exclusive). */
export function findLiveEvent(events: ScheduleEvent[], at: Date): ScheduleEvent | null {
  const t = at.getTime();
  for (const e of events) {
    if (t >= e.startTime.getTime() && t < e.endTime.getTime()) {
      return e;
    }
  }
  return null;
}

/**
 * Enlaza un evento del calendario con contentIndex (logo, slug, etc.).
 * Misma heurística que en SchedulePage: PROGRAM_ID en descripción o título = título del programa en ES.
 */
export function resolveLiveProgram(
  event: ScheduleEvent,
  lang: string,
  contentIndexData: ContentIndexData
): ResolvedLiveProgram {
  let match: Record<string, Record<string, unknown>> | null = null;

  if (event.programId) {
    const key = event.programId.toLowerCase();
    const entry = contentIndexData[key as keyof typeof contentIndexData];
    if (entry && typeof entry === 'object') {
      match = entry as Record<string, Record<string, unknown>>;
    }
  }

  if (!match) {
    const titleLower = event.title.toLowerCase();
    const found = Object.values(contentIndexData).find((prog: unknown) => {
      if (!prog || typeof prog !== 'object') return false;
      const p = prog as { es?: { title?: string } };
      return p.es?.title && String(p.es.title).toLowerCase() === titleLower;
    });
    match = (found as Record<string, Record<string, unknown>>) || null;
  }

  const localized =
    match && (match[lang] || match.es)
      ? ((match[lang] || match.es) as Record<string, unknown>)
      : null;

  const title =
    (localized?.title as string | undefined)?.trim() || event.title;
  const logoRaw = localized?.logo as string | undefined;
  const logoFile = logoRaw?.trim() ? logoRaw.trim() : null;
  const programId = (localized?.id as string | undefined) || event.programId || null;
  const slug = (localized?.slug as string | undefined) || null;
  const content = localized?.content as string | undefined;
  const blurb = (() => {
    if (!content || !String(content).trim()) return null;
    return String(content).replace(/\s+/g, ' ').trim();
  })();

  return {
    event,
    title,
    logoFile,
    programId,
    slug,
    blurb,
  };
}
