import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const MP3_BITRATE = '128k';
const MAX_MP3_BYTES = 512 * 1024 * 1024;

const resolveFfmpegBin = () => {
  const fromEnv = process.env.FFMPEG_PATH?.trim();
  if (fromEnv) return fromEnv;
  try {
    const bundled = require('ffmpeg-static');
    if (bundled) return bundled;
  } catch {
    // optional dependency
  }
  return 'ffmpeg';
};

const runFfmpeg = (ffmpegBin, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(ffmpegBin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (error) => {
      if (error.code === 'ENOENT') {
        reject(
          new Error(
            'ffmpeg no encontrado. Instalá ffmpeg en PATH o ejecutá: npm install (incluye ffmpeg-static).'
          )
        );
        return;
      }
      reject(error);
    });
    child.on('close', (code) => {
      if (code === 0) resolve(undefined);
      else reject(new Error(`ffmpeg falló (code ${code}): ${stderr.slice(-400)}`));
    });
  });

/**
 * Convierte cualquier audio soportado por ffmpeg a MP3 128 kbps / 44.1 kHz.
 * @param {string} inputPath - ruta absoluta al archivo fuente
 * @returns {Promise<Buffer>}
 */
export const convertFileToMp3 = async (inputPath) => {
  const ffmpegBin = resolveFfmpegBin();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rn-bulk-audio-'));
  const outputPath = path.join(tmpDir, 'output.mp3');

  try {
    await runFfmpeg(ffmpegBin, [
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      inputPath,
      '-vn',
      '-codec:a',
      'libmp3lame',
      '-b:a',
      MP3_BITRATE,
      '-ar',
      '44100',
      '-y',
      outputPath,
    ]);

    const mp3 = fs.readFileSync(outputPath);
    if (mp3.length < 1024) throw new Error('La conversión produjo un MP3 vacío o corrupto.');
    if (mp3.length > MAX_MP3_BYTES) {
      throw new Error('El MP3 convertido supera 512 MB.');
    }
    return mp3;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
};

/**
 * @param {Buffer} buffer
 * @param {string} originalName
 * @returns {Promise<Buffer>}
 */
export const convertBufferToMp3 = async (buffer, originalName) => {
  const ext = path.extname(originalName || '.audio').toLowerCase() || '.audio';
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rn-bulk-in-'));
  const inputPath = path.join(tmpDir, `input${ext}`);
  try {
    fs.writeFileSync(inputPath, buffer);
    return await convertFileToMp3(inputPath);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
};

export const mp3FileNameFrom = (fileName) => {
  const base = path.basename(fileName, path.extname(fileName)) || 'episodio';
  return `${base}.mp3`;
};

export const isMp3FileName = (fileName) => /\.mp3$/i.test(String(fileName || ''));

/** WAV/FLAC/etc. → MP3; si ya es .mp3 válido, se sube tal cual. */
export const needsMp3Conversion = (fileName, sizeBytes) => {
  if (!isMp3FileName(fileName)) return true;
  if (sizeBytes > MAX_MP3_BYTES) return true;
  return false;
};

const assertValidAudioBuffer = (buffer) => {
  if (buffer.length < 1024) throw new Error('Archivo vacío o corrupto.');
  if (buffer.length > MAX_MP3_BYTES) {
    throw new Error('Audio demasiado grande (máx. 512 MB).');
  }
};

/**
 * @returns {Promise<{ buffer: Buffer; fileName: string; converted: boolean }>}
 */
export const prepareAudioForBulkUpload = async ({ filePath, buffer, fileName }) => {
  const sizeBytes = buffer ? buffer.length : fs.statSync(filePath).size;
  const uploadFileName = mp3FileNameFrom(fileName);

  if (!needsMp3Conversion(fileName, sizeBytes)) {
    const mp3Buffer = buffer ?? fs.readFileSync(filePath);
    assertValidAudioBuffer(mp3Buffer);
    return { buffer: mp3Buffer, fileName: uploadFileName, converted: false };
  }

  const mp3Buffer = buffer
    ? await convertBufferToMp3(buffer, fileName)
    : await convertFileToMp3(filePath);
  return { buffer: mp3Buffer, fileName: uploadFileName, converted: true };
};
