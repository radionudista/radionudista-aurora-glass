import React, { useEffect, useRef, useState } from 'react';
import { useAudio } from '../contexts/AudioContext';

interface ArchiveEpisodePlayerProps {
  episodeId: string;
  title: string;
  audioUrl: string;
  onClose?: () => void;
  /** Start playing immediately when mounted */
  autoPlay?: boolean;
  /** Notified whenever the play/pause state changes */
  onPlayStateChange?: (playing: boolean) => void;
}

const fmt = (value: number): string => {
  if (!Number.isFinite(value) || value <= 0) return '00:00';
  const total = Math.floor(value);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const ArchiveEpisodePlayer: React.FC<ArchiveEpisodePlayerProps> = ({
  episodeId,
  title,
  audioUrl,
  onClose,
  autoPlay = false,
  onPlayStateChange,
}) => {
  const liveAudio = useAudio();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const autoPlayedRef = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    onPlayStateChange?.(isPlaying);
  }, [isPlaying, onPlayStateChange]);

  useEffect(() => {
    const audio = new Audio(audioUrl);
    audio.preload = 'auto';
    audio.volume = liveAudio.isMuted ? 0 : liveAudio.volume / 100;
    autoPlayedRef.current = false;

    const onLoadStart  = () => { setIsLoading(true); setIsConnecting(true); setError(null); };
    const onCanPlay    = () => { setIsLoading(false); setIsConnecting(false); };
    const onWaiting    = () => { setIsLoading(true); };
    const onStalled    = () => { setIsLoading(true); };
    const onPlaying    = () => { setIsLoading(false); setIsConnecting(false); setIsPlaying(true); };
    const onPause      = () => setIsPlaying(false);
    const onEnded      = () => setIsPlaying(false);
    const onMeta       = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onTime       = () => setCurrentTime(audio.currentTime || 0);
    const onErr        = () => {
      setIsLoading(false);
      setIsConnecting(false);
      setIsPlaying(false);
      setError('No se pudo reproducir este episodio.');
    };

    const stopOtherSources = () => {
      if (liveAudio.currentSource === 'radio' && liveAudio.isPlaying) {
        liveAudio.togglePlay();
      } else if (liveAudio.currentSource === 'program') {
        liveAudio.stopProgram();
      }
    };

    const attemptPlay = async (fromAutoPlay: boolean) => {
      stopOtherSources();
      setError(null);
      setIsLoading(true);
      if (fromAutoPlay) setIsConnecting(true);
      try {
        await audio.play();
      } catch {
        setError(
          fromAutoPlay
            ? 'El navegador bloqueó la reproducción. Haz click para reproducir.'
            : 'El navegador bloqueó la reproducción. Haz click otra vez.'
        );
        setIsLoading(false);
        setIsConnecting(false);
        setIsPlaying(false);
      }
    };

    audio.addEventListener('loadstart', onLoadStart);
    audio.addEventListener('canplay',   onCanPlay);
    audio.addEventListener('waiting',   onWaiting);
    audio.addEventListener('stalled',   onStalled);
    audio.addEventListener('playing',   onPlaying);
    audio.addEventListener('pause',     onPause);
    audio.addEventListener('ended',     onEnded);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('error',     onErr);

    audioRef.current = audio;
    if (autoPlay && !autoPlayedRef.current) {
      autoPlayedRef.current = true;
      void attemptPlay(true);
    }

    return () => {
      audio.pause();
      audio.removeEventListener('loadstart', onLoadStart);
      audio.removeEventListener('canplay',   onCanPlay);
      audio.removeEventListener('waiting',   onWaiting);
      audio.removeEventListener('stalled',   onStalled);
      audio.removeEventListener('playing',   onPlaying);
      audio.removeEventListener('pause',     onPause);
      audio.removeEventListener('ended',     onEnded);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('error',     onErr);
      audioRef.current = null;
    };
    // audioUrl change intentionally recreates the element; liveAudio ref is stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUrl, autoPlay]);

  useEffect(() => {
    const player = audioRef.current;
    if (!player) return;
    player.volume = liveAudio.isMuted ? 0 : liveAudio.volume / 100;
  }, [liveAudio.isMuted, liveAudio.volume]);

  // Pause this player if the live/program audio starts playing elsewhere
  useEffect(() => {
    const player = audioRef.current;
    if (!player || !isPlaying) return;
    const isLive    = liveAudio.currentSource === 'radio'   && liveAudio.isPlaying;
    const isProgram = liveAudio.currentSource === 'program' && liveAudio.isPlaying;
    if (isLive || isProgram) player.pause();
  }, [isPlaying, liveAudio.currentSource, liveAudio.isPlaying]);

  const handleToggle = async () => {
    const player = audioRef.current;
    if (!player) return;

    if (isPlaying) {
      player.pause();
      return;
    }

    setError(null);
    setIsLoading(true);
    setIsConnecting(true);
    if (liveAudio.currentSource === 'radio' && liveAudio.isPlaying)  liveAudio.togglePlay();
    else if (liveAudio.currentSource === 'program')                   liveAudio.stopProgram();
    try {
      await player.play();
    } catch {
      setError('El navegador bloqueó la reproducción. Haz click otra vez.');
      setIsLoading(false);
      setIsConnecting(false);
      setIsPlaying(false);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const player = audioRef.current;
    if (!player) return;
    const t = Number(e.target.value);
    player.currentTime = t;
    setCurrentTime(t);
  };

  const progressMax = duration > 0 ? duration : 1;
  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="w-full bg-[#0d0d0d] border-t border-white/10" data-episode-player={episodeId}>
      {/* Progress bar – flush top, full width */}
      <div className="relative h-[3px] w-full bg-white/10 group/bar">
        <div
          className="absolute left-0 top-0 h-full bg-white transition-[width]"
          style={{ width: `${progressPct}%` }}
        />
        <input
          type="range"
          min={0}
          max={progressMax}
          step={0.5}
          value={Math.min(currentTime, progressMax)}
          onChange={handleSeek}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label={`Progreso del episodio ${title}`}
        />
      </div>

      {/* Main row */}
      <div className="flex w-full items-center gap-4 px-4 py-3 md:px-6 md:py-3.5">
        {/* Brand mark */}
        <div className="hidden shrink-0 sm:block">
          <img
            src="/images/logo-radionudista-negro.png"
            alt="Radio Nudista"
            className="h-14 w-14 object-cover brightness-75 contrast-50"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>

        {/* Play / Pause */}
        <button
          type="button"
          onClick={handleToggle}
          disabled={isLoading}
          className="shrink-0 flex h-9 w-9 items-center justify-center border border-white/25 text-white transition hover:border-white/60 disabled:opacity-40"
          aria-label={isPlaying ? 'Pausar episodio' : 'Reproducir episodio'}
        >
          {isLoading ? (
            <span className="h-3 w-3 animate-spin rounded-full border border-white/30 border-t-white" />
          ) : isPlaying ? (
            <span className="flex gap-[3px]">
              <span className="w-[2.5px] h-[12px] bg-white" />
              <span className="w-[2.5px] h-[12px] bg-white" />
            </span>
          ) : (
            <span className="ml-px h-0 w-0 border-y-[6px] border-y-transparent border-l-[9px] border-l-white" />
          )}
        </button>

        {/* Title + status */}
        <div className="min-w-0 flex-1">
          <p
            className="truncate font-['Space_Grotesk'] text-sm font-bold uppercase leading-none tracking-[0.04em] text-white"
            title={title}
          >
            {title}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full transition-colors ${
                isPlaying ? 'bg-red-400 animate-pulse' : 'bg-white/25'
              }`}
            />
            <span className="font-['Space_Grotesk'] text-[9px] uppercase tracking-[0.16em] text-white/40">
              {isConnecting ? 'conectando' : isLoading ? 'cargando' : isPlaying ? 'sonando' : 'en pausa'}
            </span>
          </div>
        </div>

        {/* Time */}
        <div className="hidden shrink-0 items-center gap-1 sm:flex font-['Space_Grotesk'] text-[10px] uppercase tracking-[0.1em] text-white/40">
          <span className="text-white/70">{fmt(currentTime)}</span>
          <span>/</span>
          <span>{fmt(duration)}</span>
        </div>

        {/* Close */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 inline-flex h-7 items-center border border-white/15 px-3 font-['Space_Grotesk'] text-[9px] uppercase tracking-[0.16em] text-white/50 transition hover:border-white/35 hover:text-white/90"
          >
            Cerrar
          </button>
        )}
      </div>

      {error && (
        <p className="px-4 pb-2 font-['Space_Grotesk'] text-[10px] text-red-400/80" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

export default ArchiveEpisodePlayer;
