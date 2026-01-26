/**
 * Database Schema - SQLite schema definitions and migrations.
 *
 * Uses better-sqlite3 for synchronous, fast database operations.
 */

import Database from 'better-sqlite3'
import * as path from 'path'
import * as fs from 'fs'
import { app } from 'electron'

// Schema version for migrations
const SCHEMA_VERSION = 1

// SQL statements for schema creation
const CREATE_TABLES = `
-- Meetings table - core meeting metadata
CREATE TABLE IF NOT EXISTS meetings (
  id TEXT PRIMARY KEY,
  title TEXT,
  date_time TEXT NOT NULL,
  duration INTEGER DEFAULT 0,
  transcript_path TEXT,
  audio_path TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Speakers table - speaker information per meeting
CREATE TABLE IF NOT EXISTS speakers (
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL,
  name TEXT NOT NULL,
  word_count INTEGER DEFAULT 0,
  FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
);

-- Summaries table - original and enhanced notes
CREATE TABLE IF NOT EXISTS summaries (
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('original', 'enhanced')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
);

-- Full-text search virtual table
CREATE VIRTUAL TABLE IF NOT EXISTS meetings_fts USING fts5(
  meeting_id,
  title,
  transcript_content,
  summary_content,
  content='',
  tokenize='porter unicode61'
);

-- Schema version tracking
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings(date_time DESC);
CREATE INDEX IF NOT EXISTS idx_speakers_meeting ON speakers(meeting_id);
CREATE INDEX IF NOT EXISTS idx_summaries_meeting ON summaries(meeting_id);
`

// Triggers for updated_at
const CREATE_TRIGGERS = `
CREATE TRIGGER IF NOT EXISTS meetings_updated_at
AFTER UPDATE ON meetings
BEGIN
  UPDATE meetings SET updated_at = datetime('now') WHERE id = NEW.id;
END;
`

export interface DatabaseConfig {
  path: string
}

export function getDefaultDatabasePath(): string {
  const userDataPath = app.getPath('userData')
  return path.join(userDataPath, 'meetings.db')
}

export function getSessionsDirectory(): string {
  const userDataPath = app.getPath('userData')
  return path.join(userDataPath, 'sessions')
}

export function initializeDatabase(dbPath?: string): Database.Database {
  const databasePath = dbPath || getDefaultDatabasePath()

  // Ensure directory exists
  const dbDir = path.dirname(databasePath)
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }

  // Ensure sessions directory exists
  const sessionsDir = getSessionsDirectory()
  if (!fs.existsSync(sessionsDir)) {
    fs.mkdirSync(sessionsDir, { recursive: true })
  }

  console.log(`[Database] Initializing database at ${databasePath}`)

  // Open database with WAL mode for better concurrency
  const db = new Database(databasePath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  // Run schema creation
  db.exec(CREATE_TABLES)
  db.exec(CREATE_TRIGGERS)

  // Check and run migrations
  runMigrations(db)

  console.log(`[Database] Database initialized successfully`)
  return db
}

function runMigrations(db: Database.Database): void {
  // Get current schema version
  const versionRow = db.prepare(
    'SELECT version FROM schema_version ORDER BY version DESC LIMIT 1'
  ).get() as { version: number } | undefined

  const currentVersion = versionRow?.version || 0

  if (currentVersion < SCHEMA_VERSION) {
    console.log(`[Database] Running migrations from v${currentVersion} to v${SCHEMA_VERSION}`)

    // Run migrations in order
    for (let v = currentVersion + 1; v <= SCHEMA_VERSION; v++) {
      const migration = MIGRATIONS[v]
      if (migration) {
        console.log(`[Database] Applying migration v${v}`)
        db.exec(migration)
      }
    }

    // Update schema version
    db.prepare('INSERT OR REPLACE INTO schema_version (version) VALUES (?)').run(SCHEMA_VERSION)
  }
}

// Migration scripts by version
const MIGRATIONS: Record<number, string> = {
  1: `
    -- Initial schema - nothing to migrate
    SELECT 1;
  `,
  // Add future migrations here:
  // 2: `ALTER TABLE meetings ADD COLUMN new_column TEXT;`,
}

export function closeDatabase(db: Database.Database): void {
  db.close()
  console.log('[Database] Database connection closed')
}
