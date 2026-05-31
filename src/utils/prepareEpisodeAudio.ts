import type { FFmpeg } from '@ffmpeg/ffmpeg';

export const MAX_EPISODE_AUDIO_BYTES = 512 * 1024 * 1024;
const MAX_BROWSER_INPUT_BYTES = 1536 * 1024 * 1024;
const PASS_THROUGH_MAX_BYTES = 96 * 1024 * 1024;
const MP3_BITRATE = '128k';

const CONVERT_MIME_PREFIXES = ['audio/wav', 'audio/x-wav', 'audio/wave', 'audio/flac', 'audio/x-flac'];
const CONVERT_EXTENSIONS = /\.(wav|flac)$/i;
const COMPRESSED_EXTENSIONS = /\.(mp3|m4a)$/i;
const COMPRESSED_MIMES = new Set(['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a']);

let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoadPromise: Promise<FFmpeg> | null = null;

const inferInputName = (file: File): string => {
  const ext = file.name.match(/\.[a-z0-9]+$/i)?.[0]?.toLowerCase();
  if (ext && ext.length <= 5) return `input${ext}`;
  const mime = (file.type || '').toLowerCase();
  if (mime.includes('wav')) return 'input.wav';
  if (mime.includes('flac')) return 'input.flac';
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'input.mp3';
  return 'input.audio';
};

export const needsEpisodeAudioConversion = (file: File): boolean => {
  const mime = (file.type || '').toLowerCase();
  const name = file.name.toLowerCase();

  if (file.size > MAX_EPISODE_AUDIO_BYTES) return true;
  if (CONVERT_EXTENSIONS.test(name)) return true;
  if (CONVERT_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix) || mime === prefix)) return true;
  if (file.size > PASS_THROUGH_MAX_BYTES) return true;
  if (COMPRESSED_MIMES.has(mime) || COMPRESSED_EXTENSIONS.test(name)) return false;

  return false;
};

const loadFfmpeg = async (onStatus?: (message: string) => void): Promise<FFmpeg> => {
  if (ffmpegInstance?.loaded) return ffmpegInstance;
  if (ffmpegLoadPromise) return ffmpegLoadPromise;

  ffmpegLoadPromise = (async () => {
    onStatus?.('Cargando conversor de audio...');
    const [{ FFmpeg }, { fetchFile, toBlobURL }] = await Promise.all([
      import('@ffmpeg/ffmpeg'),
      import('@ffmpeg/util'),
    ]);
    const ffmpeg = new FFmpeg();
    const base = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';
    await ffmpeg.load({
      coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    ffmpegInstance = ffmpeg;
    return ffmpeg;
  })();

  try {
    return await ffmpegLoadPromise;
  } catch (error) {
    ffmpegLoadPromise = null;
    throw error;
  }
};

const convertToMp3 = async (file: File, onStatus?: (message: string) => void): Promise<File> => {
  if (file.size > MAX_BROWSER_INPUT_BYTES) {
    throw new Error(
      'Archivo demasiado pesado para convertir en el navegador (>1.5 GB). Exporta MP3 128 kbps externamente.'
    );
  }

  const ffmpeg = await loadFfmpeg(onStatus);
  const inputName = inferInputName(file);
  const outputName = 'output.mp3';
  const baseName = file.name.replace(/\.[a-z0-9]+$/i, '') || 'episodio';

  onStatus?.('Convirtiendo a MP3 (128 kbps)... puede tardar unos minutos.');
  const { fetchFile } = await import('@ffmpeg/util');
  await ffmpeg.writeFile(inputName, await fetchFile(file));
  await ffmpeg.exec([
    '-i',
    inputName,
    '-vn',
    '-codec:a',
    'libmp3lame',
    '-b:a',
    MP3_BITRATE,
    '-ar',
    '44100',
    outputName,
  ]);

  const output = await ffmpeg.readFile(outputName);
  const bytes =
    output instanceof Uint8Array
      ? output
      : new TextEncoder().encode(String(output));
  const mp3Blob = new Blob([bytes as BlobPart], { type: 'audio/mpeg' });
  const mp3File = new File([mp3Blob], `${baseName}.mp3`, { type: 'audio/mpeg' });

  await ffmpeg.deleteFile(inputName).catch(() => undefined);
  await ffmpeg.deleteFile(outputName).catch(() => undefined);

  if (mp3File.size > MAX_EPISODE_AUDIO_BYTES) {
    throw new Error('El MP3 convertido sigue siendo demasiado grande. Acorta el episodio o baja la calidad.');
  }
  if (mp3File.size < 1024) {
    throw new Error('La conversión produjo un archivo vacío o corrupto.');
  }

  const sizeMb = (mp3File.size / (1024 * 1024)).toFixed(1);
  onStatus?.(`MP3 listo (${sizeMb} MB). Subiendo...`);
  return mp3File;
};

export const prepareEpisodeAudioForUpload = async (
  file: File,
  onStatus?: (message: string) => void
): Promise<File> => {
  if (!(file.type || '').startsWith('audio/') && !/\.(wav|flac|mp3|m4a|ogg|aac)$/i.test(file.name)) {
    throw new Error('Selecciona un archivo de audio válido.');
  }
  if (file.size < 1024) {
    throw new Error('Archivo vacío o corrupto.');
  }

  if (!needsEpisodeAudioConversion(file)) {
    if (file.size > MAX_EPISODE_AUDIO_BYTES) {
      throw new Error('Audio demasiado grande (máx. 512 MB).');
    }
    return file;
  }

  return convertToMp3(file, onStatus);
};
