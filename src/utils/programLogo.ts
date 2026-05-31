/** Logo por defecto (mismo que el hero del homepage). PNG, no JPEG. */
export const DEFAULT_PROGRAM_LOGO = '/images/logo-radionudista-negro.png';

/** Copia del logo original del hero para descargar y reutilizar. */
export const DEFAULT_HOME_HERO_DOWNLOAD = '/downloads/radionudista-logo-hero-original.png';

/** Nombre de archivo en logos/ o URL/ruta absoluta (Supabase Storage, /public, etc.). */
export const resolveProgramLogoSrc = (logo?: string | null): string => {
  const raw = logo?.trim();
  if (!raw) return DEFAULT_PROGRAM_LOGO;
  if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('/')) {
    return raw;
  }
  return `/images/logos/${raw}`;
};
