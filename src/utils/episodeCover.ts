import type { Episode } from '../types';

import { DEFAULT_PROGRAM_LOGO, resolveProgramLogoSrc } from './programLogo';

/** Ruta bajo /public, URL absoluta, o nombre de archivo en logos del programa */
export function resolveCoverSrc(episode: Episode, programLogo: string | null): string {
  if (episode.coverImage?.trim()) {
    const c = episode.coverImage.trim();
    if (c.startsWith('http://') || c.startsWith('https://')) return c;
    return c.startsWith('/') ? c : `/${c}`;
  }
  if (programLogo?.trim()) return resolveProgramLogoSrc(programLogo);
  return DEFAULT_PROGRAM_LOGO;
}
