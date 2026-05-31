#!/usr/bin/env node

/**
 * Executes scripts/output/supabase-seed.sql against Supabase Postgres.
 *
 * Requires DATABASE_URL in .env (Supabase → Settings → Database → Connection string URI)
 *
 * Usage:
 *   npm run seed:supabase:sql:run
 *   node scripts/run-supabase-seed-sql.js --database-url=postgresql://...
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');
const SQL_FILE = path.join(__dirname, 'output', 'supabase-seed.sql');

dotenv.config({ path: path.join(ROOT, '.env') });
dotenv.config({ path: path.join(ROOT, '.env.local') });

const readArg = (name) => {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length).trim() : '';
};

const databaseUrl = process.env.DATABASE_URL?.trim() || readArg('database-url');

if (!databaseUrl) {
  console.error('[run-supabase-seed-sql] Missing DATABASE_URL in .env or --database-url=');
  process.exit(1);
}

if (!fs.existsSync(SQL_FILE)) {
  console.error('[run-supabase-seed-sql] Missing SQL file. Run: npm run seed:supabase:sql');
  process.exit(1);
}

const sql = fs.readFileSync(SQL_FILE, 'utf8');
const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  console.log('[run-supabase-seed-sql] Connected. Executing seed SQL…');
  await client.query(sql);
  console.log('[run-supabase-seed-sql] Done.');
} catch (error) {
  console.error('[run-supabase-seed-sql] Failed:', error instanceof Error ? error.message : error);
  process.exit(1);
} finally {
  await client.end();
}
