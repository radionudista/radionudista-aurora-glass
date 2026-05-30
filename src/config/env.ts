/**
 * Environment Configuration
 * 
 * This module provides type-safe access to environment variables
 * and centralized configuration management for the application.
 */

export type AppEnvironment = 'production' | 'local' | 'feature';

export interface EnvConfig {
  APP_ENVIRONMENT: AppEnvironment;
  APP_DEBUG: boolean;
  LAUNCHING_DATE: string;
  TWITCH_CHANNEL: string;
  TWITCH_STATIC_PARENTS: string;
  STREAM_URL: string;
  RADIO_STREAM_URL: string;
  RADIO_STATUS_URL: string;
  RADIO_INFO_URL: string;
  RADIO_INFO_API_URL: string;
  RADIO_STATUS_POLL_INTERVAL: number;
  TWITCH_PLAYER_WINDOW_SIZE_PERCENT: number;
  DEV_LAUNCHING_SECONDS: number;
  SUPPORTED_LANGUAGES: string[];
  DEFAULT_LANGUAGE: string;
  EDITOR_ENABLED: boolean;
  EDITOR_SALT: string;
  EDITOR_PASSWORD_HASH: string;
  CALENDAR_CONFIG_DATA: {
    apiKey: string;
    calendarId: string;
    timezone: string;
    maxResults: number;
    config: {
      singleEvents: boolean;
      orderBy: string;
    };
  } | null;
}

/**
 * Get environment variable with type checking
 */
const getEnvVar = (key: string, defaultValue?: string): string => {
  const value = import.meta.env[`VITE_${key}`];
  if (value === undefined && defaultValue === undefined) {
    throw new Error(`Environment variable VITE_${key} is not defined`);
  }
  return value || defaultValue || '';
};

/**
 * Get boolean environment variable
 */
const getEnvBoolean = (key: string, defaultValue: boolean = false): boolean => {
  const value = getEnvVar(key, defaultValue.toString());
  return value.toLowerCase() === 'true';
};

/**
 * Get number environment variable
 */
const getEnvNumber = (key: string, defaultValue?: number): number => {
  const value = getEnvVar(key, defaultValue?.toString());
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable VITE_${key} must be a number, got: ${value}`);
  }
  return parsed;
};

/**
 * Application environment configuration
 */
export const env: EnvConfig = {
  APP_ENVIRONMENT: getEnvVar('APP_ENVIRONMENT', 'local') as AppEnvironment,
  APP_DEBUG: getEnvBoolean('APP_DEBUG', false),
  LAUNCHING_DATE: getEnvVar('LAUNCHING_DATE', '2025-08-09T12:00:00-03:00'),
  TWITCH_CHANNEL: getEnvVar('TWITCH_CHANNEL', 'radionudista'),
  TWITCH_STATIC_PARENTS: getEnvVar('TWITCH_STATIC_PARENTS', 'localhost'),
  STREAM_URL: getEnvVar('STREAM_URL', `https://twitch.tv/${getEnvVar('TWITCH_CHANNEL', 'radionudista')}`),
  RADIO_STREAM_URL: getEnvVar('RADIO_STREAM_URL', 'https://servidor30.brlogic.com:7024/live'),
  RADIO_STATUS_URL: getEnvVar('RADIO_STATUS_URL', 'https://d36nr0u3xmc4mm.cloudfront.net/index.php/api/streaming/status/7024/2348c62ead2082a25b4573ed601473a3/SV1BR'),
  RADIO_INFO_URL: getEnvVar('RADIO_INFO_URL', 'https://public-player-widget.webradiosite.com/app/player/info/251579?hash=f9eb0f4eb62691f958df840acfd1936b22ce8ffc&version=1.00'),
  RADIO_INFO_API_URL: getEnvVar('RADIO_INFO_API_URL', 'https://public-player-widget.webradiosite.com/app/player/info/251579?hash=f9eb0f4eb62691f958df840acfd1936b22ce8ffc&version=1.00'),
  RADIO_STATUS_POLL_INTERVAL: getEnvNumber('RADIO_STATUS_POLL_INTERVAL', 10000),
  TWITCH_PLAYER_WINDOW_SIZE_PERCENT: getEnvNumber('TWITCH_PLAYER_WINDOW_SIZE_PERCENT', 70),
  DEV_LAUNCHING_SECONDS: getEnvNumber('DEV_LAUNCHING_SECONDS', -1),
  SUPPORTED_LANGUAGES: getEnvVar('SUPPORTED_LANGUAGES', 'es,pt,en').split(','),
  DEFAULT_LANGUAGE: getEnvVar('DEFAULT_LANGUAGE', 'es'),
  EDITOR_ENABLED: getEnvBoolean('EDITOR_ENABLED', false),
  EDITOR_SALT: getEnvVar('EDITOR_SALT', ''),
  EDITOR_PASSWORD_HASH: getEnvVar('EDITOR_PASSWORD_HASH', ''),
  CALENDAR_CONFIG_DATA: (() => {
    try {
      const apiKey = getEnvVar('CALENDAR_API_KEY', '').trim();
      const calendarId = getEnvVar('CALENDAR_ID', '').trim();
      if (apiKey && calendarId) {
        return {
          apiKey,
          calendarId,
          timezone: getEnvVar('CALENDAR_TIMEZONE', 'America/Argentina/Buenos_Aires'),
          maxResults: getEnvNumber('CALENDAR_MAX_RESULTS', 2500),
          config: {
            singleEvents: getEnvBoolean('CALENDAR_SINGLE_EVENTS', true),
            orderBy: getEnvVar('CALENDAR_ORDER_BY', 'startTime'),
          },
        };
      }

      const raw = getEnvVar('CALENDAR_CONFIG_DATA', '').trim();
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn('Failed to parse VITE_CALENDAR_CONFIG_DATA');
      return null;
    }
  })(),
};

/**
 * Utility functions for environment checking
 */
export const isProduction = () => env.APP_ENVIRONMENT === 'production';
export const isDevelopment = () => env.APP_ENVIRONMENT === 'local';
export const isFeature = () => env.APP_ENVIRONMENT === 'feature';
export const isDebugMode = () => env.APP_ENVIRONMENT !== 'production' && env.APP_DEBUG;
