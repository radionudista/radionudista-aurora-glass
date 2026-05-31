#!/usr/bin/env node

/**
 * Generates scripts/output/supabase-seed.sql from local JSON files.
 * Run the output in Supabase → SQL Editor if npm run seed:supabase lacks credentials.
 *
 * Usage: node scripts/generate-supabase-seed-sql.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(__dirname, 'output');
const OUT_FILE = path.join(OUT_DIR, 'supabase-seed.sql');

const LANGS = ['es', 'pt', 'en'];
const CONTENT_INDEX_PATH = path.join(ROOT, 'scripts', 'backup-json', 'contentIndex.json');
const EDITORIAL_PATH = path.join(ROOT, 'scripts', 'backup-json', 'editor', 'home-about-contact.json');
const EPISODES_DIR = path.join(ROOT, 'scripts', 'backup-json', 'episodes');

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

const emptyToNull = (value) => {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  return value;
};

const pickCanonicalEntry = (locales) => locales.es ?? locales.pt ?? locales.en ?? null;

const sqlJson = (value) => `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;

const mapContentItems = (contentIndex) => {
  const rows = [];
  for (const [id, locales] of Object.entries(contentIndex)) {
    const canonical = pickCanonicalEntry(locales);
    if (!canonical) continue;
    const isProgram = canonical.component === 'ProgramPage';
    const content_kind = canonical.content_kind === 'event' ? 'event' : 'program';
    const isArchivosProgram = isProgram && content_kind === 'program';
    rows.push({
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
    });
  }
  return rows;
};

const mapTranslations = (contentIndex) => {
  const rows = [];
  for (const [id, locales] of Object.entries(contentIndex)) {
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
  }
  return rows;
};

const mapEpisodes = () => {
  if (!fs.existsSync(EPISODES_DIR)) return { episodes: [], translations: [] };

  const episodes = [];
  const translations = [];

  for (const name of fs.readdirSync(EPISODES_DIR).filter((f) => f.endsWith('.json'))) {
    const payload = readJson(path.join(EPISODES_DIR, name));
    const programId = payload.programId;
    if (!programId || !Array.isArray(payload.episodes)) continue;

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
        sort_order: index,
        deleted_at: null,
      });
      translations.push({
        episode_id: ep.id,
        lang: 'es',
        title: ep.title,
        description: ep.description ?? '',
      });
    });
  }

  return { episodes, translations };
};

const upsertFromJson = (table, rows, conflict, columnTypes) => {
  if (rows.length === 0) return `-- ${table}: no rows\n`;
  const columns = Object.keys(columnTypes);
  const colList = columns.join(', ');
  return `
INSERT INTO ${table} (${colList})
SELECT ${columns.map((c) => `x.${c}`).join(', ')}
FROM jsonb_to_recordset(${sqlJson(rows)}) AS x(
  ${columns.map((col) => `${col} ${columnTypes[col]}`).join(',\n  ')}
)
ON CONFLICT (${conflict}) DO UPDATE SET
  ${columns
    .filter((c) => !conflict.split(',').map((s) => s.trim()).includes(c))
    .map((c) => `${c} = EXCLUDED.${c}`)
    .join(',\n  ')};
`;
};

const main = () => {
  const contentIndex = readJson(CONTENT_INDEX_PATH);
  const editorial = readJson(EDITORIAL_PATH);
  const contentItems = mapContentItems(contentIndex);
  const translations = mapTranslations(contentIndex);
  const { episodes, translations: episodeTranslations } = mapEpisodes();

  const sql = `-- Generated by scripts/generate-supabase-seed-sql.js
-- Run in Supabase SQL Editor

BEGIN;

${upsertFromJson('content_items', contentItems, 'id', {
  id: 'text',
  component: 'text',
  content_kind: 'text',
  is_public: 'boolean',
  program_order: 'integer',
  schedule: 'text',
  schedule_meta: 'jsonb',
  talent: 'text[]',
  social: 'text[]',
  logo_url: 'text',
  audio_source: 'text',
  published_at: 'timestamptz',
})}

${upsertFromJson('content_item_translations', translations, 'content_item_id, lang', {
  content_item_id: 'text',
  lang: 'app_lang',
  title: 'text',
  slug: 'text',
  body: 'text',
  menu_label: 'text',
  menu_position: 'integer',
})}

${upsertFromJson('episodes', episodes, 'id', {
  id: 'text',
  program_id: 'text',
  episode_date: 'date',
  duration: 'text',
  audio_url: 'text',
  archive_identifier: 'text',
  cover_image_url: 'text',
  collaborators: 'text[]',
  tags: 'text[]',
  tracklist: 'text[]',
  sort_order: 'integer',
  deleted_at: 'timestamptz',
})}

${upsertFromJson('episode_translations', episodeTranslations, 'episode_id, lang', {
  episode_id: 'text',
  lang: 'app_lang',
  title: 'text',
  description: 'text',
})}

INSERT INTO site_editorial (id, payload)
VALUES (1, ${sqlJson(editorial)})
ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now();

COMMIT;
`;

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, sql, 'utf8');

  console.log(`[generate-supabase-seed-sql] Wrote ${OUT_FILE}`);
  console.log(`  content_items: ${contentItems.length}`);
  console.log(`  content_item_translations: ${translations.length}`);
  console.log(`  episodes: ${episodes.length}`);
  console.log(`  episode_translations: ${episodeTranslations.length}`);
  console.log(`  site_editorial: 1`);
};

main();
