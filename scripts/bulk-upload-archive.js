#!/usr/bin/env node

/**
 * Subida masiva a Archive.org + episodios mínimos en Supabase.
 *
 * Modo carpeta (recomendado): descargás los audios, los ponés en una carpeta y el script
 * Soporta .aup3 / .aup (proyectos Audacity) → mezcla a WAV → MP3 → Archive.org.
 *
 * Estructura A — subcarpetas = programas (busca audio en profundidad):
 *   C:/audio-import/misterios/ep01/ep.mp3
 *
 * Estructura B — carpeta anidada + un programa (--program):
 *   C:/La Otra Puerta/La Otra Puerta/04/ep.mp3
 *   → --dir=C:/La Otra Puerta --program=la-otra-puerta
 *
 * Ignora .jpg, .mp4, .xlsx, etc. Solo audio (.mp3, .wav, .flac, .aup3…).
 *
 * Uso:
 *   node scripts/bulk-upload-archive.js --dir=C:/audio-import --dry-run
 *   node scripts/bulk-upload-archive.js --dir=C:/audio-import --program=misterios
 *   node scripts/bulk-upload-archive.js --dir=C:/audio-import --delay=45 --max=5
 *
 * Requiere .env: IA_*, SUPABASE_* + Python 3.8+ si hay archivos .aup3
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import {
  EXT_TO_MIME,
  uploadBufferWithRetry,
  sleep,
} from './lib/archiveUpload.js';
import { prepareAudioForBulkUpload, needsMp3Conversion, convertFileToMp3 } from './lib/convertToMp3.js';
import {
  isAudacityProject,
  exportAudacityProjectToWav,
  checkPythonAvailable,
} from './lib/audacityProject.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

dotenv.config({ path: path.join(ROOT, '.env') });
dotenv.config({ path: path.join(ROOT, '.env.local') });

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const AUDIO_EXT = new Set(Object.keys(EXT_TO_MIME));
const DEFAULT_TITLE = 'Episodio sin título';
const DEFAULT_DURATION = '00:00';

/** Título provisional desde el nombre del archivo (sin extensión). */
const titleFromFileName = (fileName) => {
  const base = path.basename(String(fileName || ''), path.extname(String(fileName || '')));
  const cleaned = base.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned || DEFAULT_TITLE;
};

const dryRun = process.argv.includes('--dry-run');
const migrateSupabase = process.argv.includes('--migrate-supabase');
const archiveOnly = process.argv.includes('--archive-only');

const readArg = (name) => {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length).trim() : '';
};

const delaySec = Number(readArg('delay') || process.env.IA_BULK_DELAY_SEC || 45);
const maxItems = Number(readArg('max') || 0) || Infinity;
const manifestPath = readArg('manifest');
const dirPath = readArg('dir');
const programFilter = readArg('program');
const translationLang = readArg('lang') || 'es';

const log = (msg) => console.log(`[bulk-archive] ${msg}`);
const fail = (msg) => {
  console.error(`[bulk-archive] ${msg}`);
  process.exit(1);
};

const requireEnv = () => {
  const accessKey = process.env.IA_ACCESS_KEY?.trim();
  const secretKey = process.env.IA_SECRET_KEY?.trim();
  const collection = process.env.IA_COLLECTION?.trim() || 'opensource_audio';
  if (!accessKey || !secretKey) fail('Faltan IA_ACCESS_KEY o IA_SECRET_KEY en .env');
  return { accessKey, secretKey, collection };
};

const createSupabase = async ({ write = false } = {}) => {
  const url = process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const anonKey =
    process.env.SUPABASE_ANON_KEY?.trim() || process.env.VITE_SUPABASE_ANON_KEY?.trim();
  const editorEmail = process.env.SUPABASE_EDITOR_EMAIL?.trim();
  const editorPassword = process.env.SUPABASE_EDITOR_PASSWORD?.trim();

  if (!url) fail('Falta SUPABASE_URL en .env');

  if (write && serviceKey) {
    log('Supabase: usando service role key');
    return createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  if (write && anonKey && editorEmail && editorPassword) {
    log(`Supabase: login editor (${editorEmail})`);
    const supabase = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await supabase.auth.signInWithPassword({
      email: editorEmail,
      password: editorPassword,
    });
    if (error) fail(`Login editor falló: ${error.message}`);
    return supabase;
  }

  if (write) {
    fail(
      'Para crear episodios: SUPABASE_SERVICE_ROLE_KEY o (SUPABASE_ANON_KEY + SUPABASE_EDITOR_EMAIL + SUPABASE_EDITOR_PASSWORD) en .env'
    );
  }

  const readKey = serviceKey || anonKey;
  if (!readKey) fail('Falta clave Supabase (service role o anon).');
  return createClient(url, readKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};

const isAudioFile = (fileName) => AUDIO_EXT.has(path.extname(fileName).toLowerCase());

const mimeForFile = (fileName) => {
  const ext = path.extname(fileName).toLowerCase();
  return EXT_TO_MIME[ext] || 'audio/mpeg';
};

const todayIso = () => new Date().toISOString().slice(0, 10);

const isUploadableFile = (fileName) => isAudacityProject(fileName) || isAudioFile(fileName);

const walkUploadableFiles = (folder, results = []) => {
  let entries;
  try {
    entries = fs.readdirSync(folder, { withFileTypes: true });
  } catch (error) {
    throw new Error(`No se pudo leer carpeta ${folder}: ${error instanceof Error ? error.message : error}`);
  }

  for (const entry of entries) {
    const fullPath = path.join(folder, entry.name);
    if (entry.isDirectory()) {
      walkUploadableFiles(fullPath, results);
    } else if (entry.isFile() && isUploadableFile(entry.name)) {
      results.push({ file: fullPath, fileName: entry.name });
    }
  }

  return results;
};

const listUploadableInDir = (folder) => walkUploadableFiles(folder);

const assertProgramSlug = (programId, label) => {
  if (!SLUG_RE.test(programId)) {
    throw new Error(`${label}: id de programa inválido "${programId}" (usa slug tipo misterios).`);
  }
};

const fetchProgramIds = async (supabase) => {
  const { data, error } = await supabase.from('content_items').select('id');
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((row) => row.id));
};

const fetchNextSortOrders = async (supabase, programIds) => {
  const map = new Map();
  for (const programId of programIds) {
    const { data, error } = await supabase
      .from('episodes')
      .select('sort_order')
      .eq('program_id', programId)
      .order('sort_order', { ascending: false })
      .limit(1);
    if (error) throw new Error(error.message);
    map.set(programId, (data?.[0]?.sort_order ?? -1) + 1);
  }
  return map;
};

const buildJobsFromFolder = async (supabase) => {
  const root = path.resolve(dirPath);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    fail(`--dir no es una carpeta válida: ${root}`);
  }

  const knownPrograms = await fetchProgramIds(supabase);
  const jobs = [];
  const entries = fs.readdirSync(root, { withFileTypes: true });
  const subdirs = entries.filter((entry) => entry.isDirectory());
  const slugSubdirs = subdirs.filter((entry) => SLUG_RE.test(entry.name));

  const addFileEntries = (programId, fileEntries, sortCursor) => {
    assertProgramSlug(programId, programId);
    if (!knownPrograms.has(programId)) {
      throw new Error(`Programa "${programId}" no existe en Supabase. Creá el programa antes.`);
    }
    if (programFilter && programId !== programFilter) return sortCursor;

    fileEntries.forEach((entry, index) => {
      jobs.push({
        programId,
        episodeId: `${programId}-bulk-${Date.now()}-${jobs.length}-${index}`,
        date: todayIso(),
        file: entry.file,
        fileName: entry.fileName,
        mimeType: mimeForFile(entry.fileName),
        title: titleFromFileName(entry.fileName),
        duration: DEFAULT_DURATION,
        description: '',
        tags: [],
        sortOrder: sortCursor + index,
        mode: 'create',
        source: isAudacityProject(entry.fileName) ? 'audacity-project' : 'folder',
      });
    });
    return sortCursor + fileEntries.length;
  };

  if (programFilter) {
    const files = walkUploadableFiles(root);
    if (!files.length) {
      fail(`No hay archivos de audio bajo ${root} (ignorando imágenes, videos, etc.).`);
    }
    files.sort((a, b) => a.file.localeCompare(b.file, 'es'));
    log(`Encontrados ${files.length} audio(s) en subcarpetas → programa "${programFilter}"`);
    const sortMap = await fetchNextSortOrders(supabase, [programFilter]);
    addFileEntries(programFilter, files, sortMap.get(programFilter) ?? 0);
  } else if (slugSubdirs.length > 0) {
    const programIds = slugSubdirs.map((d) => d.name);
    const sortMap = await fetchNextSortOrders(supabase, programIds);

    for (const sub of slugSubdirs) {
      const programId = sub.name;
      const files = walkUploadableFiles(path.join(root, programId));
      if (!files.length) continue;
      files.sort((a, b) => a.file.localeCompare(b.file, 'es'));
      log(`Programa "${programId}": ${files.length} audio(s)`);
      let cursor = sortMap.get(programId) ?? 0;
      cursor = addFileEntries(programId, files, cursor);
      sortMap.set(programId, cursor);
    }
  } else if (subdirs.length > 0) {
    fail(
      'Carpetas anidadas sin slug de programa. Usá --program=la-otra-puerta (el script busca audio en todas las subcarpetas).'
    );
  } else {
    const files = walkUploadableFiles(root);
    if (!files.length) {
      fail(`No hay archivos de audio en ${root}`);
    }
    fail('Carpeta plana: indicá --program=slug (ej. --program=la-otra-puerta).');
  }

  if (!jobs.length) {
    log('No hay archivos listos para subir (mp3, wav, flac, .aup3 de Audacity, etc.).');
  }

  return jobs;
};

const readManifest = () => {
  if (!manifestPath) fail('Indicá --manifest=ruta.json');
  const resolved = path.resolve(manifestPath);
  if (!fs.existsSync(resolved)) fail(`No existe el manifest: ${resolved}`);
  const data = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  if (!Array.isArray(data)) fail('El manifest debe ser un array JSON.');
  return data;
};

const buildJobsFromManifest = (entries) =>
  entries.map((entry, index) => {
    const programId = String(entry.programId || '').trim();
    const episodeId = String(entry.episodeId || '').trim();
    const file = String(entry.file || '').trim();
    if (!programId || !episodeId || !file) {
      throw new Error(`Manifest índice ${index}: faltan programId, episodeId o file.`);
    }
    const fileName = String(entry.fileName || path.basename(file));
    return {
      programId,
      episodeId,
      date: String(entry.date || '').trim() || todayIso(),
      file,
      fileName,
      mimeType: mimeForFile(fileName),
      title: String(entry.title || titleFromFileName(fileName)),
      duration: String(entry.duration || DEFAULT_DURATION),
      description: String(entry.description || ''),
      tags: Array.isArray(entry.tags) ? entry.tags : [],
      sortOrder: Number(entry.sortOrder ?? 0),
      mode: entry.create ? 'create' : 'update',
      source: 'manifest',
    };
  });

const fetchSupabaseStorageEpisodes = async (supabase) => {
  let query = supabase
    .from('episodes')
    .select('id, program_id, episode_date, audio_url, archive_identifier')
    .is('deleted_at', null)
    .like('audio_url', '%supabase.co/storage%episode-audio%')
    .order('created_at', { ascending: true });

  if (programFilter) query = query.eq('program_id', programFilter);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
};

const downloadUrl = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1024) throw new Error(`Download vacío: ${url}`);
  return buf;
};

const guessFileNameFromUrl = (url) => {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop() || 'episodio.mp3');
    return name;
  } catch {
    return 'episodio.mp3';
  }
};

const buildJobsFromSupabase = async (supabase) => {
  const rows = await fetchSupabaseStorageEpisodes(supabase);
  if (!rows.length) {
    log('No hay episodios con audio en Supabase Storage (episode-audio).');
    return [];
  }
  return rows.map((row) => ({
    programId: row.program_id,
    episodeId: row.id,
    date: row.episode_date,
    file: row.audio_url,
    fileName: guessFileNameFromUrl(row.audio_url),
    mimeType: 'audio/mpeg',
    mode: 'update',
    source: 'supabase-storage',
    isUrl: true,
  }));
};

const createEpisodeInDb = async (supabase, row) => {
  const { error: episodeError } = await supabase.from('episodes').insert({
    id: row.episodeId,
    program_id: row.programId,
    episode_date: row.date,
    duration: row.duration ?? DEFAULT_DURATION,
    audio_url: row.audioUrl,
    archive_identifier: row.identifier,
    cover_image_url: null,
    collaborators: [],
    tags: row.tags ?? [],
    tracklist: [],
    sort_order: row.sortOrder ?? 0,
    deleted_at: null,
  });
  if (episodeError) throw new Error(episodeError.message);

  const { error: translationError } = await supabase.from('episode_translations').insert({
    episode_id: row.episodeId,
    lang: translationLang,
    title: row.title ?? DEFAULT_TITLE,
    description: row.description ?? '',
  });
  if (translationError) throw new Error(translationError.message);
};

const updateEpisodeInDb = async (supabase, row) => {
  const { error } = await supabase
    .from('episodes')
    .update({
      audio_url: row.audioUrl,
      archive_identifier: row.identifier,
    })
    .eq('id', row.episodeId)
    .eq('program_id', row.programId);
  if (error) throw new Error(error.message);
};

const processJob = async (job, index, total, archiveEnv, supabase) => {
  const label = `${job.programId}/${job.episodeId}`;
  log(`[${index + 1}/${total}] ${label} (${job.source})`);

  if (dryRun) {
    log(`  dry-run: ${job.mode === 'create' ? 'crearía' : 'actualizaría'} episodio`);
    log(`  archivo: ${job.isUrl ? job.file : path.resolve(job.file)}`);
    let sizeBytes = 0;
    if (!job.isUrl) {
      const resolved = path.resolve(job.file);
      if (fs.existsSync(resolved)) sizeBytes = fs.statSync(resolved).size;
    }
    log(
      isAudacityProject(job.fileName)
        ? '  proyecto Audacity (.aup3) → mezclaría con aup2wav y convertiría a MP3'
        : needsMp3Conversion(job.fileName, sizeBytes)
          ? '  convertiría a MP3 128 kbps antes de subir'
          : '  ya es MP3 → subiría directo (sin reconversión)'
    );
    if (job.mode === 'create') {
      log(`  título="${job.title ?? DEFAULT_TITLE}" duración=${job.duration ?? DEFAULT_DURATION} (editable después)`);
    }
    return { ok: true, skipped: true };
  }

  const rawBuffer = job.isUrl ? await downloadUrl(job.file) : undefined;
  let prepared;

  if (!job.isUrl && isAudacityProject(job.fileName)) {
    log('  proyecto Audacity (.aup3) → mezclando pistas a WAV…');
    const wavPath = await exportAudacityProjectToWav(path.resolve(job.file));
    try {
      log('  convirtiendo mezcla a MP3 128 kbps…');
      const mp3Buffer = await convertFileToMp3(wavPath);
      prepared = {
        buffer: mp3Buffer,
        fileName: `${path.basename(job.fileName, path.extname(job.fileName))}.mp3`,
        converted: true,
      };
    } finally {
      fs.rmSync(path.dirname(wavPath), { recursive: true, force: true });
    }
  } else {
    prepared = await prepareAudioForBulkUpload({
      filePath: job.isUrl ? undefined : path.resolve(job.file),
      buffer: rawBuffer,
      fileName: job.fileName,
    });
  }

  if (prepared.converted) {
    log('  convertido a MP3 128 kbps');
  } else {
    log('  ya era MP3 → subiendo directo');
  }
  log(`  ${(prepared.buffer.length / (1024 * 1024)).toFixed(1)} MB → ${prepared.fileName}`);

  const uploaded = await uploadBufferWithRetry(
    {
      accessKey: archiveEnv.accessKey,
      secretKey: archiveEnv.secretKey,
      collection: archiveEnv.collection,
      programId: job.programId,
      episodeId: job.episodeId,
      date: job.date,
      mimeType: 'audio/mpeg',
      fileName: prepared.fileName,
      fileBuffer: prepared.buffer,
    },
    {
      accessKey: archiveEnv.accessKey,
      onWait: (msg) => log(`  ${msg}`),
    }
  );

  log(`  Archive.org → ${uploaded.audioUrl}`);

  const dbRow = {
    programId: job.programId,
    episodeId: job.episodeId,
    date: job.date,
    audioUrl: uploaded.audioUrl,
    identifier: uploaded.identifier,
    title: job.title ?? DEFAULT_TITLE,
    duration: job.duration ?? DEFAULT_DURATION,
    description: job.description ?? '',
    tags: job.tags ?? [],
    sortOrder: job.sortOrder ?? 0,
  };

  if (job.mode === 'create' && !archiveOnly) {
    await createEpisodeInDb(supabase, dbRow);
    log(`  Supabase: episodio creado ("${job.title}", sin descripción). Editá en el editor.`);
  } else if (job.mode !== 'create' && !archiveOnly) {
    await updateEpisodeInDb(supabase, dbRow);
    log('  Supabase: audio_url actualizado.');
  } else if (archiveOnly) {
    log(`  (solo Archive.org) título="${job.title}"`);
  }

  return { ok: true, uploaded, dbRow: archiveOnly ? dbRow : undefined };
};

const importManifestPath = readArg('import-manifest');

const importEpisodesFromManifest = async () => {
  if (!importManifestPath) return false;
  const resolved = path.resolve(importManifestPath);
  if (!fs.existsSync(resolved)) fail(`No existe: ${resolved}`);
  const rows = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  if (!Array.isArray(rows)) fail('El manifest debe ser un array JSON.');

  const supabase = await createSupabase({ write: !dryRun });
  log(`Importando ${rows.length} episodio(s) a Supabase desde ${resolved}`);
  for (const row of rows) {
    if (dryRun) {
      log(`  dry-run: ${row.title} → ${row.audioUrl}`);
      continue;
    }
    await createEpisodeInDb(supabase, row);
    log(`  creado: ${row.title}`);
  }
  log('Import a Supabase completado.');
  return true;
};

const main = async () => {
  if (importManifestPath) {
    await importEpisodesFromManifest();
    return;
  }

  const archiveEnv = requireEnv();

  if (!manifestPath && !migrateSupabase && !dirPath) {
    fail('Usá --dir=C:/carpeta-audio, --manifest=archivo.json o --migrate-supabase');
  }

  let jobs = [];
  let supabase = null;
  const needsWrite = !dryRun && !archiveOnly;

  if (dirPath) {
    supabase = await createSupabase({ write: needsWrite });
    jobs = await buildJobsFromFolder(supabase);
  } else if (migrateSupabase) {
    supabase = await createSupabase({ write: needsWrite });
    jobs = await buildJobsFromSupabase(supabase);
  } else {
    jobs = buildJobsFromManifest(readManifest());
    if (needsWrite) supabase = await createSupabase({ write: true });
  }

  if (!jobs.length) return;

  const limited = jobs.slice(0, maxItems);
  const hasAup3 = limited.some((job) => isAudacityProject(job.fileName));
  if (hasAup3 && !dryRun) {
    log('Proyectos .aup3 detectados → se mezclan con aup2wav (Python) y se convierten a MP3.');
    await checkPythonAvailable();
  }
  log(`Plan: ${limited.length} archivo(s), delay ${delaySec}s, dry-run=${dryRun}`);
  if (dirPath) {
    log('Metadatos por defecto: título = nombre del archivo, duración 00:00, sin descripción.');
  }

  const results = { ok: 0, fail: 0, saved: [] };

  for (let i = 0; i < limited.length; i += 1) {
    try {
      const outcome = await processJob(limited[i], i, limited.length, archiveEnv, supabase);
      results.ok += 1;
      if (outcome?.dbRow) results.saved.push(outcome.dbRow);
    } catch (error) {
      results.fail += 1;
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[bulk-archive] ERROR ${limited[i].programId}/${limited[i].episodeId}: ${msg}`);
    }

    if (i < limited.length - 1 && !dryRun) {
      log(`Esperando ${delaySec}s…`);
      await sleep(delaySec * 1000);
    }
  }

  log(`Listo. OK=${results.ok} fallos=${results.fail}`);
  if (archiveOnly && results.saved.length) {
    const outDir = path.join(ROOT, 'scripts', 'output');
    fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, `bulk-upload-${programFilter || 'episodes'}-${Date.now()}.json`);
    fs.writeFileSync(outFile, JSON.stringify(results.saved, null, 2), 'utf8');
    log(`Manifest guardado: ${outFile}`);
    log('Agregá SUPABASE_SERVICE_ROLE_KEY o editor password en .env y re-ejecutá con --manifest=… sin --archive-only');
  }
  if (results.fail > 0) process.exit(1);
};

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
