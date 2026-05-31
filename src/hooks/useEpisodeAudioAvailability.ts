import { useEffect, useMemo, useState } from 'react';
import type { Episode } from '../types';
import {
  episodeNeedsAudioAvailabilityCheck,
  resolveEpisodeAudioAvailability,
  type EpisodeAudioAvailabilityState,
} from '../utils/episodeAudioAvailability';

const POLL_MS = 45_000;

const initialCheckingState = (episodes: Episode[]): Record<string, EpisodeAudioAvailabilityState> => {
  const next: Record<string, EpisodeAudioAvailabilityState> = {};
  for (const ep of episodes) {
    if (episodeNeedsAudioAvailabilityCheck(ep)) next[ep.id] = 'checking';
  }
  return next;
};

export const useEpisodeAudioAvailability = (
  episodes: Episode[],
  enabled: boolean
): Record<string, EpisodeAudioAvailabilityState> => {
  const watchIds = useMemo(
    () =>
      episodes
        .filter(episodeNeedsAudioAvailabilityCheck)
        .map((ep) => ep.id)
        .sort()
        .join('|'),
    [episodes]
  );

  const [availability, setAvailability] = useState<Record<string, EpisodeAudioAvailabilityState>>(() =>
    enabled ? initialCheckingState(episodes) : {}
  );

  useEffect(() => {
    if (!enabled || !watchIds) {
      setAvailability({});
      return undefined;
    }

    const watched = episodes.filter(episodeNeedsAudioAvailabilityCheck);
    let cancelled = false;

    setAvailability(initialCheckingState(watched));

    const runCheck = async () => {
      setAvailability((prev) => {
        const next = { ...prev };
        for (const ep of watched) {
          if (next[ep.id] !== 'ready') next[ep.id] = 'checking';
        }
        return next;
      });

      const results = await Promise.all(
        watched.map(async (ep) => [ep.id, await resolveEpisodeAudioAvailability(ep)] as const)
      );

      if (cancelled) return;

      setAvailability((prev) => {
        const next = { ...prev };
        for (const [id, state] of results) next[id] = state;
        return next;
      });

      const hasPending = results.some(([, state]) => state !== 'ready');
      if (!hasPending && intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    let intervalId: ReturnType<typeof setInterval> | null = null;

    void runCheck();
    intervalId = setInterval(() => {
      void runCheck();
    }, POLL_MS);

    return () => {
      cancelled = true;
      if (intervalId !== null) clearInterval(intervalId);
    };
  }, [enabled, watchIds, episodes]);

  return availability;
};

export const getEpisodeAudioUiState = (
  episode: Episode,
  availability: Record<string, EpisodeAudioAvailabilityState>
): EpisodeAudioAvailabilityState | 'ready' => {
  if (!episodeNeedsAudioAvailabilityCheck(episode)) return 'ready';
  return availability[episode.id] ?? 'checking';
};
