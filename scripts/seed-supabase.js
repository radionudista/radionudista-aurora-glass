#!/usr/bin/env node

/**
 * Seed Supabase from backup JSON (scripts/backup-json/).
 *
 * Requires in .env (or environment):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   (recommended for seeding)
 *
 * Usage:
 *   node scripts/seed-supabase.js              # upsert all data
 *   node scripts/seed-supabase.js --dry-run      # preview only
 *   node scripts/seed-supabase.js --skip-editorial
 *
 * Exit codes: 0 success, 1 error
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

dotenv.config({ path: path.join(ROOT, '.env') });
dotenv.config({ path: path.join(ROOT, '.env.local') });

const LANGS = ['es', 'pt', 'en'];
const dryRun = process.argv.includes('--dry-run');
const skipEditorial = process.argv.includes('--skip-editorial');

const readArg = (name) => {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length).trim() : '';
};

const envOrArg = (envKey, argKey) => process.env[envKey]?.trim() || readArg(argKey);

const CONTENT_INDEX_PATH = path.join(ROOT, 'scripts', 'backup-json', 'contentIndex.json');
const EDITORIAL_PATH = path.join(ROOT, 'scripts', 'backup-json', 'editor', 'home-about-contact.json');
const EPISODES_DIR = path.join(ROOT, 'scripts', 'backup-json', 'episodes');

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

const emptyToNull = (value) => {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  return value;
};

const fail = (message) => {
  console.error(`[seed-supabase] ${message}`);
  process.exit(1);
};

const log = (message) => console.log(`[seed-supabase] ${message}`);

const createSupabaseClient = async () => {
  const url = envOrArg('SUPABASE_URL', 'supabase-url');
  const serviceKey = envOrArg('SUPABASE_SERVICE_ROLE_KEY', 'service-key');
  const anonKey = envOrArg('SUPABASE_ANON_KEY', 'anon-key');
  const editorEmail = envOrArg('SUPABASE_EDITOR_EMAIL', 'editor-email');
  const editorPassword = envOrArg('SUPABASE_EDITOR_PASSWORD', 'editor-password');

  if (!url) fail('Missing SUPABASE_URL in .env');

  if (serviceKey) {
    log('Using SUPABASE_SERVICE_ROLE_KEY');
    return createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  if (anonKey && editorEmail && editorPassword) {
    log(`Using editor login (${editorEmail})`);
    const supabase = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await supabase.auth.signInWithPassword({
      email: editorEmail,
      password: editorPassword,
    });
    if (error) fail(`Editor login failed: ${error.message}`);
    return supabase;
  }

  fail(
    'Missing credentials. Set SUPABASE_SERVICE_ROLE_KEY or (SUPABASE_ANON_KEY + SUPABASE_EDITOR_EMAIL + SUPABASE_EDITOR_PASSWORD) in .env'
  );
};

const pickCanonicalEntry = (locales) =>
  locales.es ?? locales.pt ?? locales.en ?? null;

const mapContentItem = (id, locales) => {
  const canonical = pickCanonicalEntry(locales);
  if (!canonical) return null;

  const isProgram = canonical.component === 'ProgramPage';
  const content_kind = canonical.content_kind === 'event' ? 'event' : 'program';
  const isArchivosProgram = isProgram && content_kind === 'program';

  return {
    id,
    component: canonical.component,
    content_kind,
    is_public: canonical.public ?? true,
    program_order: isArchivosProgram ? (canonical.program_order ?? 0) : null,
    schedule: emptyToNull(canonical.schedule),
    schedule_meta: canonical.schedule_meta ?? null,
    talent: Array.isArray(canonical.talent) ? canonical.talent : [],
    social: Array.isArray(canonical.social) ? canonical.social : [],
    logo_url: emptyToNull(canonical.logo),
    audio_source: emptyToNull(canonical.audio_source),
    published_at: emptyToNull(canonical.date),
  };
};

const mapContentItemTranslations = (id, locales) => {
  const rows = [];

  for (const lang of LANGS) {
    const entry = locales[lang];
    if (!entry?.title) continue;

    rows.push({
      content_item_id: id,
      lang,
      title: entry.title,
      slug: entry.slug,
      body: entry.content ?? '',
      menu_label: emptyToNull(entry.menu),
      menu_position: entry.menu_position ?? null,
    });
  }

  return rows;
};

const loadEpisodeFiles = () => {
  if (!fs.existsSync(EPISODES_DIR)) return [];

  return fs
    .readdirSync(EPISODES_DIR)
    .filter((name) => name.endsWith('.json'))
    .map((name) => path.join(EPISODES_DIR, name));
};

const mapEpisodes = (payload, sortBase = 0) => {
  const programId = payload.programId;
  if (!programId || !Array.isArray(payload.episodes)) return { episodes: [], translations: [] };

  const episodes = [];
  const translations = [];

  payload.episodes.forEach((ep, index) => {
    if (!ep?.id || !ep?.title || !ep?.date || !ep?.audioUrl) return;

    episodes.push({
      id: ep.id,
      program_id: programId,
      episode_date: ep.date,
      duration: ep.duration ?? '00:00',
      audio_url: ep.audioUrl,
      archive_identifier: emptyToNull(ep.archiveIdentifier),
      cover_image_url: emptyToNull(ep.coverImage),
      collaborators: Array.isArray(ep.collaborators) ? ep.collaborators : [],
      tags: Array.isArray(ep.tags) ? ep.tags : [],
      tracklist: Array.isArray(ep.tracklist) ? ep.tracklist : [],
      sort_order: sortBase + index,
      deleted_at: null,
    });

    translations.push({
      episode_id: ep.id,
      lang: 'es',
      title: ep.title,
      description: ep.description ?? '',
    });
  });

  return { episodes, translations };
};

const LEGACY_REMOVED_CONTENT_IDS = ['acerca-de-nosotros'];

const purgeRemovedContentItems = async (supabase) => {
  if (LEGACY_REMOVED_CONTENT_IDS.length === 0) return;

  if (dryRun) {
    log(`legacy content_items: would delete ${LEGACY_REMOVED_CONTENT_IDS.join(', ')}`);
    return;
  }

  for (const id of LEGACY_REMOVED_CONTENT_IDS) {
    await supabase.from('content_item_translations').delete().eq('content_item_id', id);
    const { error } = await supabase.from('content_items').delete().eq('id', id);
    if (error) fail(`delete content item "${id}" failed: ${error.message}`);
    log(`removed legacy content item "${id}"`);
  }
};

const upsertBatch = async (supabase, table, rows, onConflict, label) => {
  if (rows.length === 0) {
    log(`${label}: nothing to upsert`);
    return;
  }

  if (dryRun) {
    log(`${label}: would upsert ${rows.length} row(s)`);
    return;
  }

  const { error } = await supabase.from(table).upsert(rows, { onConflict });
  if (error) fail(`${label} failed: ${error.message}`);
  log(`${label}: upserted ${rows.length} row(s)`);
};

const seedContentIndex = async (supabase, contentIndex) => {
  const items = [];
  const translations = [];

  for (const [id, locales] of Object.entries(contentIndex)) {
    if (LEGACY_REMOVED_CONTENT_IDS.includes(id)) continue;
    const item = mapContentItem(id, locales);
    if (!item) {
      log(`skip content item "${id}": no locale data`);
      continue;
    }
    items.push(item);
    translations.push(...mapContentItemTranslations(id, locales));
  }

  await upsertBatch(supabase, 'content_items', items, 'id', 'content_items');
  await upsertBatch(
    supabase,
    'content_item_translations',
    translations,
    'content_item_id,lang',
    'content_item_translations'
  );
};

const seedEpisodes = async (supabase) => {
  const files = loadEpisodeFiles();
  const allEpisodes = [];
  const allTranslations = [];

  for (const filePath of files) {
    const payload = readJson(filePath);
    const { episodes, translations } = mapEpisodes(payload);
    allEpisodes.push(...episodes);
    allTranslations.push(...translations);
    log(`episodes file ${path.basename(filePath)}: ${episodes.length} episode(s)`);
  }

  await upsertBatch(supabase, 'episodes', allEpisodes, 'id', 'episodes');
  await upsertBatch(
    supabase,
    'episode_translations',
    allTranslations,
    'episode_id,lang',
    'episode_translations'
  );
};

const seedEditorial = async (supabase) => {
  if (skipEditorial) {
    log('site_editorial: skipped (--skip-editorial)');
    return;
  }

  if (!fs.existsSync(EDITORIAL_PATH)) {
    log('site_editorial: file not found, skipped');
    return;
  }

  const payload = readJson(EDITORIAL_PATH);
  const row = { id: 1, payload };

  if (dryRun) {
    log('site_editorial: would upsert 1 row');
    return;
  }

  const { error } = await supabase.from('site_editorial').upsert(row, { onConflict: 'id' });
  if (error) fail(`site_editorial failed: ${error.message}`);
  log('site_editorial: upserted 1 row');
};

const main = async () => {
  log(dryRun ? 'DRY RUN — no writes' : 'Starting seed…');

  if (!fs.existsSync(CONTENT_INDEX_PATH)) {
    fail(`Missing ${CONTENT_INDEX_PATH}`);
  }

  const contentIndex = readJson(CONTENT_INDEX_PATH);
  const itemCount = Object.keys(contentIndex).length;
  log(`contentIndex: ${itemCount} item(s)`);

  if (dryRun) {
    const items = [];
    const translations = [];
    log(`legacy content_items: would delete ${LEGACY_REMOVED_CONTENT_IDS.join(', ')}`);

    for (const [id, locales] of Object.entries(contentIndex)) {
      if (LEGACY_REMOVED_CONTENT_IDS.includes(id)) continue;
      const item = mapContentItem(id, locales);
      if (!item) continue;
      items.push(item);
      translations.push(...mapContentItemTranslations(id, locales));
    }
    log(`content_items: would upsert ${items.length} row(s)`);
    log(`content_item_translations: would upsert ${translations.length} row(s)`);

    const files = loadEpisodeFiles();
    let episodeCount = 0;
    for (const filePath of files) {
      const payload = readJson(filePath);
      const { episodes } = mapEpisodes(payload);
      episodeCount += episodes.length;
      log(`episodes file ${path.basename(filePath)}: ${episodes.length} episode(s)`);
    }
    log(`episodes: would upsert ${episodeCount} row(s)`);
    log(`episode_translations: would upsert ${episodeCount} row(s)`);

    if (!skipEditorial && fs.existsSync(EDITORIAL_PATH)) {
      log('site_editorial: would upsert 1 row');
    } else if (skipEditorial) {
      log('site_editorial: skipped (--skip-editorial)');
    }

    log('Done (dry run).');
    return;
  }

  const supabase = await createSupabaseClient();

  await purgeRemovedContentItems(supabase);
  await seedContentIndex(supabase, contentIndex);
  await seedEpisodes(supabase);
  await seedEditorial(supabase);

  log('Done.');
};

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
