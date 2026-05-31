import { env } from '../config/env';
import { CoverImageService, type ICoverImageService } from './coverImageService';
import { logger } from '../utils/logger';

/**
 * Stream Service Interface
 * Follows Interface Segregation Principle - specific interfaces for stream operations
 */
export interface StreamStatus {
  isMobile: boolean;
  streamingStatus: number;
  streamingType: string;
  currentTrack: string;
}

export interface RadioInfo {
  radioName: string;
  customerUrl: string;
  retailerUrl: string;
  retailerAlt: string;
  customerLogo: string;
  locale: string;
  nextSchedules: Record<string, {
    id: string | number;
    start: number;
    end: number;
    program_info: {
      program_id: string | number;
      program_name: string;
      program_image: string;
      broadcaster_id: string | number;
      broadcaster_name: string;
      broadcaster_image: string;
      start_time: string | number;
      end_time: string | number;
    };
  }>;
  streamingUrl: string;
  updateStatusUrl: string;
  songCoverUrl: string;
  cast: {
    receiverAppId: string;
    receiverInfoUrl: string;
  };
  assetUrls: {
    upload: string;
    cover: string;
  };
}

export interface IStreamService {
  fetchCurrentTrack(): Promise<string>;
  getStreamUrl(): string;
  fetchRadioInfo(): Promise<RadioInfo | null>;
  fetchSongCover(songName: string): Promise<string | null>;
}

/**
 * Radio Stream Service Implementation
 * Follows Single Responsibility Principle - handles only stream-related operations
 * Follows Dependency Inversion Principle - depends on cover service abstraction
 */
export class RadioStreamService implements IStreamService {
  private radioInfoCache: RadioInfo | null = null;
  private readonly radioInfoUrl: string;
  private readonly coverImageService: ICoverImageService;
  private lastStatusErrorLoggedAt = 0;

  constructor(
    private readonly statusUrl: string,
    private readonly streamUrl: string,
    private readonly defaultTrack: string = 'RadioNudista - Live Stream'
  ) {
    // Use the radio info API URL from environment configuration
    this.radioInfoUrl = env.RADIO_INFO_API_URL;
    // Inject cover image service (Dependency Inversion Principle)
    this.coverImageService = new CoverImageService();
  }

  async fetchCurrentTrack(): Promise<string> {
    try {
      const response = await fetch(this.statusUrl, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: StreamStatus = await response.json();
      return data.currentTrack || this.defaultTrack;
    } catch (error) {
      const now = Date.now();
      if (now - this.lastStatusErrorLoggedAt > 60_000) {
        this.lastStatusErrorLoggedAt = now;
        logger.debug('Radio status fetch failed', error);
      }
      return this.defaultTrack;
    }
  }

  async fetchRadioInfo(): Promise<RadioInfo | null> {
    try {
      // Use cached data if available
      if (this.radioInfoCache) {
        return this.radioInfoCache;
      }

      const response = await fetch(this.radioInfoUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: RadioInfo = await response.json();
      this.radioInfoCache = data;
      return data;
    } catch (error) {
      logger.debug('Error fetching radio info', error);
      return null;
    }
  }

  async fetchSongCover(songName: string): Promise<string | null> {
    // Delegate to specialized cover image service (Single Responsibility Principle)
    return await this.coverImageService.fetchCoverImageUrl(songName);
  }

  getStreamUrl(): string {
    return this.streamUrl;
  }
}
