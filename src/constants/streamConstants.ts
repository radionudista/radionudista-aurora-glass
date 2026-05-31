import { env } from '../config/env';

/** En dev el proxy de Vite oculta la URL externa (SV1BR) en Network. */
const RADIO_STATUS_DEV_PROXY = '/api/radio/status';

/**
 * Stream configuration URLs - Now using environment variables
 */
export const STREAM_CONFIG = {
  streamUrl: env.RADIO_STREAM_URL,
  statusUrl: import.meta.env.DEV ? RADIO_STATUS_DEV_PROXY : env.RADIO_STATUS_URL,
  twitchChannel: env.TWITCH_CHANNEL,
} as const;

