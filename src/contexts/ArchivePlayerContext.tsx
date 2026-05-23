import React, { createContext, useContext, useMemo, useState } from 'react';
import ArchiveEpisodePlayer from '../components/ArchiveEpisodePlayer';

interface ActiveArchiveEpisode {
  episodeId: string;
  title: string;
  audioUrl: string;
}

interface ArchivePlayerContextValue {
  activeEpisode: ActiveArchiveEpisode | null;
  openEpisode: (episode: ActiveArchiveEpisode) => void;
  closeEpisode: () => void;
}

const ArchivePlayerContext = createContext<ArchivePlayerContextValue | null>(null);

export const ArchivePlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeEpisode, setActiveEpisode] = useState<ActiveArchiveEpisode | null>(null);

  const value = useMemo<ArchivePlayerContextValue>(
    () => ({
      activeEpisode,
      openEpisode: (episode) => setActiveEpisode(episode),
      closeEpisode: () => setActiveEpisode(null),
    }),
    [activeEpisode]
  );

  return (
    <ArchivePlayerContext.Provider value={value}>
      {children}
      {activeEpisode && (
        <div className="fixed bottom-0 left-0 right-0 z-40">
          <ArchiveEpisodePlayer
            episodeId={activeEpisode.episodeId}
            audioUrl={activeEpisode.audioUrl}
            title={activeEpisode.title}
            autoPlay
            onClose={() => setActiveEpisode(null)}
          />
        </div>
      )}
    </ArchivePlayerContext.Provider>
  );
};

export const useArchivePlayer = (): ArchivePlayerContextValue => {
  const context = useContext(ArchivePlayerContext);
  if (!context) {
    throw new Error('useArchivePlayer must be used within ArchivePlayerProvider');
  }
  return context;
};
