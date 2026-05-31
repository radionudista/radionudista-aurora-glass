import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const AUDACITY_PROJECT_EXT = new Set(['.aup3', '.aup']);

const AUP2WAV_DOWNLOAD_URL =
  'https://web.archive.org/web/2025/https://lame.buanzo.org/aup2wav.py';

export const isAudacityProject = (fileName) =>
  AUDACITY_PROJECT_EXT.has(path.extname(String(fileName || '')).toLowerCase());

const resolvePythonBin = () => {
  const fromEnv = process.env.PYTHON_PATH?.trim();
  if (fromEnv) return fromEnv;
  return process.platform === 'win32' ? 'py' : 'python3';
};

const resolveAup2WavScript = () => {
  const fromEnv = process.env.AUP2WAV_PY?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.join(__dirname, '..', 'vendor', 'aup2wav.py');
};

const isValidAup2WavScript = (scriptPath) => {
  if (!fs.existsSync(scriptPath)) return false;
  const head = fs.readFileSync(scriptPath, 'utf8').slice(0, 400);
  return head.includes('aup2wav') && !head.includes('<!DOCTYPE html>');
};

export const ensureAup2WavScript = async () => {
  const scriptPath = resolveAup2WavScript();
  if (isValidAup2WavScript(scriptPath)) return scriptPath;

  fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
  const res = await fetch(AUP2WAV_DOWNLOAD_URL);
  if (!res.ok) {
    throw new Error(`No se pudo descargar aup2wav.py (${res.status}).`);
  }
  const text = await res.text();
  if (!text.includes('aup2wav') || text.includes('<!DOCTYPE html>')) {
    throw new Error('La descarga de aup2wav.py no es válida.');
  }
  fs.writeFileSync(scriptPath, text, 'utf8');
  return scriptPath;
};

const runProcess = (bin, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (error) => {
      if (error.code === 'ENOENT') {
        reject(
          new Error(
            'Python no encontrado. Instalá Python 3.8+ desde python.org o definí PYTHON_PATH.'
          )
        );
        return;
      }
      reject(error);
    });
    child.on('close', (code) => {
      if (code === 0) resolve(undefined);
      else reject(new Error(`${bin} falló (code ${code}): ${stderr.slice(-500)}`));
    });
  });

export const checkPythonAvailable = async () => {
  const python = resolvePythonBin();
  const args = python === 'py' ? ['-3', '-c', 'print("ok")'] : ['-c', 'print("ok")'];
  await runProcess(python, args);
};

/**
 * Mezcla un proyecto Audacity (.aup3 / .aup) a WAV con aup2wav.py
 * @returns {Promise<string>} ruta al WAV generado
 */
export const exportAudacityProjectToWav = async (projectPath) => {
  await checkPythonAvailable();
  const scriptPath = await ensureAup2WavScript();

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rn-aup3-'));
  const outputWav = path.join(tmpDir, 'mixdown.wav');
  const python = resolvePythonBin();
  const args =
    python === 'py'
      ? ['-3', scriptPath, path.resolve(projectPath), '-o', outputWav]
      : [scriptPath, path.resolve(projectPath), '-o', outputWav];

  await runProcess(python, args);

  if (!fs.existsSync(outputWav) || fs.statSync(outputWav).size < 1024) {
    throw new Error('aup2wav no produjo un WAV válido.');
  }

  return outputWav;
};

export const listAudacityProjectsInDir = (folder) =>
  fs
    .readdirSync(folder)
    .filter((name) => isAudacityProject(name))
    .sort((a, b) => a.localeCompare(b, 'es'));
