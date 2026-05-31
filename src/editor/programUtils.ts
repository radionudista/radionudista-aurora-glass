import type { ContentIndexData, ContentKind } from './contracts';
import { DEFAULT_PROGRAM_LOGO } from '../utils/programLogo';

export const getContentKind = (entry: { content_kind?: ContentKind | string } | null | undefined): ContentKind => {
  const kind = entry?.content_kind;
  return kind === 'event' ? 'event' : 'program';
};

export const isArchivosProgramEntry = (
  entry: { content_kind?: ContentKind | string; component?: string } | null | undefined
): boolean => {
  if (!entry || entry.component !== 'ProgramPage') return false;
  return getContentKind(entry) === 'program';
};

export const isCalendarEventEntry = (
  entry: { content_kind?: ContentKind | string; component?: string } | null | undefined
): boolean => {
  if (!entry || entry.component !== 'ProgramPage') return false;
  return getContentKind(entry) === 'event';
};

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const normalizeProgramId = (raw: string): string => {
  const id = raw.trim().toLowerCase().replace(/\s+/g, '-').replace(/_/g, '-');
  if (!SLUG_RE.test(id)) {
    throw new Error('ID inválido: minúsculas, números y guiones (ej. mi-programa-nuevo).');
  }
  return id;
};

export const readNextProgramOrder = (contentIndex: ContentIndexData): number => {
  let max = 0;
  for (const entry of Object.values(contentIndex)) {
    if (!entry) continue;
    for (const lang of ['es', 'pt', 'en'] as const) {
      const order = entry[lang]?.program_order;
      if (typeof order === 'number' && !Number.isNaN(order)) max = Math.max(max, order);
    }
  }
  return max + 1;
};

export const buildNewProgramIndexEntry = (options: {
  lang: 'es' | 'pt' | 'en';
  id: string;
  title: string;
  program_order: number | null;
  schedule: string;
  contentKind?: ContentKind;
}) => {
  const { lang, id, title, program_order, schedule, contentKind = 'program' } = options;
  const isEvent = contentKind === 'event';
  const dateStr = new Date().toISOString();
  const body =
    lang === 'es'
      ? isEvent
        ? 'Descripción del evento para el calendario. Edita en archivos (solo editores).'
        : 'Descripción provisional. Edita en la ficha del programa.'
      : lang === 'pt'
        ? isEvent
          ? 'Descrição do evento para o calendário. Edite em arquivos (somente editores).'
          : 'Descrição provisória. Edite na ficha do programa.'
        : isEvent
          ? 'Event description for the schedule. Edit in archives (editors only).'
          : 'Provisional description. Edit on the program page.';
  return {
    language: lang,
    title,
    slug: id,
    id,
    component: 'ProgramPage',
    content_kind: contentKind,
    public: true,
    program_order: isEvent ? undefined : (program_order ?? undefined),
    date: dateStr,
    schedule,
    talent: [] as string[],
    social: [] as string[],
    logo: DEFAULT_PROGRAM_LOGO,
    audio_source: `${id}.mp3`,
    menu: '',
    content: body,
  };
};
