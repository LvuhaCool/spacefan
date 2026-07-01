import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DATA_DIR
  ? join(process.env.DATA_DIR, 'data.db')
  : join(__dirname, 'data.db');

const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id         TEXT    PRIMARY KEY,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS otp_codes (
    code       TEXT    NOT NULL,
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS login_attempts (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    ip           TEXT,
    attempted_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS news_feed (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    sfn_id     INTEGER NOT NULL UNIQUE,
    title      TEXT    NOT NULL,
    excerpt    TEXT    NOT NULL,
    content    TEXT    NOT NULL,
    image_url  TEXT    NOT NULL DEFAULT '',
    category   TEXT    NOT NULL DEFAULT '',
    event_date TEXT    NOT NULL DEFAULT '',
    read_time  INTEGER NOT NULL DEFAULT 2,
    source_url TEXT    NOT NULL DEFAULT '',
    fetched_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS launches (
    id            TEXT    PRIMARY KEY,
    name          TEXT    NOT NULL DEFAULT '',
    rocket        TEXT    NOT NULL DEFAULT '',
    provider      TEXT    NOT NULL DEFAULT '',
    pad           TEXT    NOT NULL DEFAULT '',
    location      TEXT    NOT NULL DEFAULT '',
    net           TEXT    NOT NULL DEFAULT '',
    net_formatted TEXT    NOT NULL DEFAULT '',
    status_name   TEXT    NOT NULL DEFAULT '',
    status_abbrev TEXT    NOT NULL DEFAULT 'TBD',
    landing_info  TEXT    NOT NULL DEFAULT '[]',
    fetched_at    INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS space_events (
    id             INTEGER PRIMARY KEY,
    name           TEXT    NOT NULL DEFAULT '',
    type_name      TEXT    NOT NULL DEFAULT '',
    description    TEXT    NOT NULL DEFAULT '',
    date           TEXT    NOT NULL DEFAULT '',
    date_formatted TEXT    NOT NULL DEFAULT '',
    location       TEXT    NOT NULL DEFAULT '',
    image_url      TEXT    NOT NULL DEFAULT '',
    fetched_at     INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS drafts (
    id         TEXT    PRIMARY KEY,
    title      TEXT    NOT NULL DEFAULT '',
    content    TEXT    NOT NULL DEFAULT '',
    updated_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS dzen_published (
    id           TEXT    PRIMARY KEY,
    title        TEXT    NOT NULL DEFAULT '',
    body_html    TEXT    NOT NULL DEFAULT '',
    published_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS notes (
    id         TEXT    PRIMARY KEY,
    text       TEXT    NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
`);

// ── Migrations for existing installs ──────────────────────────────────
// Add failed_attempts to otp_codes if missing (security hardening)
const otpColumns = db.prepare('PRAGMA table_info(otp_codes)').all().map(c => c.name);
if (!otpColumns.includes('failed_attempts')) {
  db.exec('ALTER TABLE otp_codes ADD COLUMN failed_attempts INTEGER NOT NULL DEFAULT 0');
}

const newsColumns = db.prepare('PRAGMA table_info(news_feed)').all().map(c => c.name);
if (!newsColumns.includes('sfn_id')) {
  // Old schema — drop and let the job repopulate from SFN
  db.exec('DROP TABLE news_feed');
  db.exec(`
    CREATE TABLE news_feed (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      sfn_id     INTEGER NOT NULL UNIQUE,
      title      TEXT    NOT NULL,
      excerpt    TEXT    NOT NULL,
      content    TEXT    NOT NULL,
      image_url  TEXT    NOT NULL DEFAULT '',
      category   TEXT    NOT NULL DEFAULT '',
      event_date TEXT    NOT NULL DEFAULT '',
      read_time  INTEGER NOT NULL DEFAULT 2,
      source_url TEXT    NOT NULL DEFAULT '',
      fetched_at INTEGER NOT NULL,
      deleted    INTEGER NOT NULL DEFAULT 0
    )
  `);
}

const launchColumns = db.prepare('PRAGMA table_info(launches)').all().map(c => c.name);
if (!launchColumns.includes('landing_info')) {
  db.exec('ALTER TABLE launches ADD COLUMN landing_info TEXT NOT NULL DEFAULT "[]"');
}
if (!launchColumns.includes('mission_description')) {
  db.exec('ALTER TABLE launches ADD COLUMN mission_description TEXT NOT NULL DEFAULT ""');
}

export default db;
