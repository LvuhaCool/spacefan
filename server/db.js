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
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT    NOT NULL,
    excerpt     TEXT    NOT NULL,
    content     TEXT    NOT NULL,
    image_url   TEXT    NOT NULL DEFAULT '',
    category    TEXT    NOT NULL DEFAULT 'Космос',
    event_date  TEXT    NOT NULL DEFAULT '',
    read_time   INTEGER NOT NULL DEFAULT 3,
    source_url  TEXT    NOT NULL DEFAULT '',
    fetched_at  INTEGER NOT NULL
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
    fetched_at    INTEGER NOT NULL
  );
`);

export default db;
