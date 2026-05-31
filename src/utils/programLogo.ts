/** Logo por defecto (mismo que el hero del homepage). */
export const DEFAULT_PROGRAM_LOGO = '/images/logo-radionudista-negro.png';

/** Nombre de archivo en logos/ o URL/ruta absoluta (Supabase Storage, /public, etc.). */
export const resolveProgramLogoSrc = (logo?: string | null): string => {
  const raw = logo?.trim();
  if (!raw) return DEFAULT_PROGRAM_LOGO;
  if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('/')) {
    return raw;
  }
  return `/images/logos/${raw}`;
};
