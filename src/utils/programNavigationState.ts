export type ProgramNavigationState = {
  /** Ruta completa (pathname + search) desde la que se abrió la ficha. */
  from?: string;
  /** Nombre legible del origen (ej. Inicio, Archivo). */
  fromLabel?: string;
};

export type ProgramNavOriginLabels = {
  home: string;
  archive: string;
  about: string;
  contact: string;
  schedule: string;
  adminUsers: string;
  fallback: string;
};

export const currentLocationFrom = (location: {
  pathname: string;
  search?: string;
}): string => `${location.pathname}${location.search ?? ''}`;

export const buildProgramNavigationState = (
  from: string,
  fromLabel?: string
): ProgramNavigationState => {
  const state: ProgramNavigationState = { from };
  const label = fromLabel?.trim();
  if (label) state.fromLabel = label;
  return state;
};

export const readProgramNavigationFrom = (
  location: { state?: unknown },
  fallbackPath: string
): string => {
  const from = (location.state as ProgramNavigationState | null | undefined)?.from?.trim();
  if (from && from.startsWith('/') && !from.startsWith('//')) {
    return from;
  }
  return fallbackPath;
};

export const resolveProgramNavLabelFromPath = (
  path: string,
  labels: ProgramNavOriginLabels
): string => {
  const pathname = path.split('?')[0]?.split('#')[0] ?? '';
  const segments = pathname.split('/').filter(Boolean);
  const rest =
    segments.length > 0 && /^[a-z]{2}$/i.test(segments[0]!) ? segments.slice(1) : segments;

  if (rest.length === 0) return labels.home;
  if (rest[0] === 'programacion' && rest.length === 1) return labels.archive;
  if (rest[0] === 'about' || rest[0] === 'acerca-de-nosotros') return labels.about;
  if (rest[0] === 'contacto' || rest[0] === 'contact') return labels.contact;
  if (rest[0] === 'schedule') return labels.schedule;
  if (rest[0] === 'admin' && rest[1] === 'usuarios') return labels.adminUsers;

  return labels.fallback;
};

export const readProgramNavigationBack = (
  location: { state?: unknown },
  fallbackPath: string,
  originLabels: ProgramNavOriginLabels
): { to: string; originLabel: string } => {
  const to = readProgramNavigationFrom(location, fallbackPath);
  const state = location.state as ProgramNavigationState | null | undefined;
  const originLabel =
    state?.fromLabel?.trim() || resolveProgramNavLabelFromPath(to, originLabels);
  return { to, originLabel };
};

export const preserveProgramNavigationState = (
  location: { state?: unknown }
): ProgramNavigationState | undefined => {
  const state = location.state as ProgramNavigationState | null | undefined;
  const from = state?.from?.trim();
  if (!from || !from.startsWith('/') || from.startsWith('//')) return undefined;
  const preserved: ProgramNavigationState = { from };
  const label = state?.fromLabel?.trim();
  if (label) preserved.fromLabel = label;
  return preserved;
};
