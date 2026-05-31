/**
 * Core Application Types
 * Follows Interface Segregation Principle - small, focused interfaces
 */

import type { EditorLanguage } from '../editor/contracts';

// Audio Player Types
export interface AudioPlayerState {
  isPlaying: boolean;
  isLoading: boolean;
  currentTrack: string;
}

export interface AudioPlayerActions {
  togglePlay: () => Promise<void>;
}

export interface AudioPlayerContext extends AudioPlayerState, AudioPlayerActions {}

// Media Control Types
export type MediaButtonSize = 'small' | 'medium' | 'large';

export interface MediaButtonProps {
  isPlaying: boolean;
  isLoading: boolean;
  onClick: () => void;
  size: MediaButtonSize;
}

// Component Props Types
export interface RadioPlayerProps {
  className?: string;
  showTitle?: boolean;
  size?: MediaButtonSize;
}

export interface LayoutProps {
  children: React.ReactNode;
}

// Configuration Types
export interface StreamConfiguration {
  streamUrl: string;
  statusUrl: string;
  twitchChannel: string;
}

export interface MediaConfiguration {
  aspectRatios: Record<string, string>;
  intervals: Record<string, number>;
  visualization: Record<string, number>;
  stream: {
    defaultTrack: string;
    preload: 'none' | 'metadata' | 'auto';
    updateInterval: number;
  };
}

// Calendar Types
export interface ScheduleEvent {
  id: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  programId?: string;
  color?: string;
  recurrence?: string[];
}

export interface ICalendarService {
  getWeeklySchedule(timeMin: Date, timeMax: Date): Promise<ScheduleEvent[]>;
}

// Archive / Episodes Types
export interface Episode {
  id: string;
  title: string;
  date: string; // ISO date string (YYYY-MM-DD)
  duration: string; // e.g. "58:30"
  description?: string;
  audioUrl: string;
  /** Internet Archive item identifier used for this episode upload. */
  archiveIdentifier?: string;
  /** Overrides collaborators shown in this episode detail (falls back to program talent). */
  collaborators?: string[];
  tags?: string[];
  /** Líneas tipo "Artista — Tema" o una sola línea por tema */
  tracklist?: string[];
  /** Ruta bajo /public o URL absoluta; si no hay, se usa el logo del programa */
  coverImage?: string;
}

export interface ProgramEpisodes {
  programId: string;
  episodes: Episode[];
}

export interface ProgramEpisodesTrash {
  programId: string;
  episodes: Episode[];
}

export interface IEpisodeService {
  getEpisodesByProgram(programId: string, lang?: EditorLanguage): Promise<ProgramEpisodes>;
}
