import * as sqlite from 'node:sqlite';
import type { DatabaseSync } from 'node:sqlite';
import { AppConfig } from '../config.js';

export type InkoraDatabase = DatabaseSync;

const SqliteDatabaseCtor =
  (sqlite as unknown as { Database?: typeof DatabaseSync; DatabaseSync: typeof DatabaseSync })
    .Database ?? sqlite.DatabaseSync;

function ensureColumn(db: DatabaseSync, table: string, column: string, definition: string): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function createDatabase(config: AppConfig): DatabaseSync {
  const db = new SqliteDatabaseCtor(config.dbPath);

  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      email_verified INTEGER NOT NULL DEFAULT 0,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deactivated', 'suspended')),
      status_reason TEXT NOT NULL DEFAULT '',
      full_name TEXT NOT NULL,
      university TEXT NOT NULL DEFAULT '',
      major TEXT NOT NULL DEFAULT '',
      academic_year TEXT NOT NULL DEFAULT '',
      bio TEXT NOT NULL DEFAULT '',
      avatar_file TEXT DEFAULT NULL,
      theme_preference TEXT NOT NULL DEFAULT 'system',
      workspace_accent TEXT NOT NULL DEFAULT 'purple',
      storage_quota_bytes INTEGER NOT NULL DEFAULT 262144000,
      is_demo INTEGER NOT NULL DEFAULT 0,
      last_login_at TEXT DEFAULT NULL,
      login_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users(LOWER(email));

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      refresh_token_hash TEXT UNIQUE,
      user_agent TEXT NOT NULL DEFAULT '',
      ip_address TEXT NOT NULL DEFAULT '',
      expires_at TEXT NOT NULL,
      refresh_expires_at TEXT DEFAULT NULL,
      created_at TEXT NOT NULL,
      last_active_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_sessions_refresh ON sessions(refresh_token_hash);

    CREATE TABLE IF NOT EXISTS email_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      email TEXT NOT NULL,
      purpose TEXT NOT NULL CHECK (purpose IN ('verify_email', 'reset_password')),
      otp_hash TEXT NOT NULL,
      link_token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      used_at TEXT DEFAULT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_email_tokens_lookup ON email_tokens(email, purpose, used_at);

    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      parent_id TEXT DEFAULT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#6D28D9',
      icon TEXT NOT NULL DEFAULT 'Folder',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_folders_user ON folders(user_id);

    CREATE TABLE IF NOT EXISTS subjects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      code TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL,
      instructor TEXT NOT NULL DEFAULT '',
      semester TEXT NOT NULL DEFAULT '',
      color TEXT NOT NULL DEFAULT '#6D28D9',
      icon TEXT NOT NULL DEFAULT 'BookOpen',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_subjects_user ON subjects(user_id);

    CREATE TABLE IF NOT EXISTS notebooks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      subject_id TEXT DEFAULT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      cover_color TEXT NOT NULL DEFAULT '#4C1D95',
      accent_color TEXT NOT NULL DEFAULT '#A78BFA',
      icon TEXT NOT NULL DEFAULT 'NotebookPen',
      default_paper_style TEXT NOT NULL DEFAULT 'lined',
      is_pinned INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_notebooks_user ON notebooks(user_id);
    CREATE INDEX IF NOT EXISTS idx_notebooks_subject ON notebooks(subject_id);

    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      folder_id TEXT DEFAULT NULL,
      notebook_id TEXT DEFAULT NULL,
      subject_id TEXT DEFAULT NULL,
      title TEXT NOT NULL DEFAULT 'Untitled Note',
      description TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'General',
      mode TEXT NOT NULL DEFAULT 'document',
      paper_style TEXT NOT NULL DEFAULT 'plain',
      paper_bg_color TEXT NOT NULL DEFAULT '',
      page_size TEXT NOT NULL DEFAULT 'a4',
      content_json TEXT NOT NULL DEFAULT '{"type":"doc","content":[{"type":"paragraph"}]}',
      content_html TEXT NOT NULL DEFAULT '',
      plain_text TEXT NOT NULL DEFAULT '',
      cornell_cues TEXT NOT NULL DEFAULT '',
      cornell_summary TEXT NOT NULL DEFAULT '',
      drawing_data TEXT NOT NULL DEFAULT '{"version":1,"strokes":[],"shapes":[],"texts":[],"background":"transparent"}',
      drawing_preview TEXT NOT NULL DEFAULT '',
      tags_json TEXT NOT NULL DEFAULT '[]',
      word_count INTEGER NOT NULL DEFAULT 0,
      is_pinned INTEGER NOT NULL DEFAULT 0,
      is_starred INTEGER NOT NULL DEFAULT 0,
      is_trashed INTEGER NOT NULL DEFAULT 0,
      trashed_at TEXT DEFAULT NULL,
      last_opened_at TEXT DEFAULT NULL,
      share_token TEXT DEFAULT NULL UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL,
      FOREIGN KEY (notebook_id) REFERENCES notebooks(id) ON DELETE SET NULL,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id, is_trashed, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_notes_notebook ON notes(notebook_id);
    CREATE INDEX IF NOT EXISTS idx_notes_subject ON notes(subject_id);
    CREATE INDEX IF NOT EXISTS idx_notes_share ON notes(share_token);

    CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
      note_id UNINDEXED,
      user_id UNINDEXED,
      title,
      plain_text,
      cornell_cues,
      cornell_summary,
      tags
    );

    CREATE TABLE IF NOT EXISTS note_versions (
      id TEXT PRIMARY KEY,
      note_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      label TEXT NOT NULL DEFAULT 'Snapshot',
      title TEXT NOT NULL,
      mode TEXT NOT NULL,
      paper_style TEXT NOT NULL,
      content_json TEXT NOT NULL,
      content_html TEXT NOT NULL,
      cornell_cues TEXT NOT NULL DEFAULT '',
      cornell_summary TEXT NOT NULL DEFAULT '',
      drawing_data TEXT NOT NULL,
      word_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_note_versions_note ON note_versions(note_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      note_id TEXT DEFAULT NULL,
      subject_id TEXT DEFAULT NULL,
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      category TEXT NOT NULL DEFAULT 'other',
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE SET NULL,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_attachments_user ON attachments(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_attachments_note ON attachments(note_id);

    CREATE TABLE IF NOT EXISTS study_tasks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      subject_id TEXT DEFAULT NULL,
      note_id TEXT DEFAULT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      due_date TEXT DEFAULT NULL,
      priority TEXT NOT NULL DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'todo',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL,
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_user ON study_tasks(user_id, status, due_date);

    CREATE TABLE IF NOT EXISTS flashcards (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      subject_id TEXT DEFAULT NULL,
      notebook_id TEXT DEFAULT NULL,
      note_id TEXT DEFAULT NULL,
      front TEXT NOT NULL,
      back TEXT NOT NULL,
      confidence INTEGER NOT NULL DEFAULT 0,
      review_count INTEGER NOT NULL DEFAULT 0,
      last_reviewed_at TEXT DEFAULT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL,
      FOREIGN KEY (notebook_id) REFERENCES notebooks(id) ON DELETE SET NULL,
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_flashcards_user ON flashcards(user_id);

    CREATE TABLE IF NOT EXISTS study_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      subject_id TEXT DEFAULT NULL,
      note_id TEXT DEFAULT NULL,
      duration_minutes INTEGER NOT NULL,
      mode TEXT NOT NULL DEFAULT 'focus',
      completed_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL,
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_study_sessions_user ON study_sessions(user_id, completed_at DESC);

    CREATE TABLE IF NOT EXISTS account_concerns (
      id TEXT PRIMARY KEY,
      user_id TEXT DEFAULT NULL,
      email TEXT NOT NULL,
      subject TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'account_access',
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_review', 'resolved')),
      admin_note TEXT NOT NULL DEFAULT '',
      resolved_by TEXT DEFAULT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_concerns_status ON account_concerns(status, created_at DESC);
  `);

  // Safe migrations if an older inkora.db exists
  ensureColumn(db, 'users', 'email_verified', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db, 'users', 'role', "TEXT NOT NULL DEFAULT 'student'");
  ensureColumn(db, 'users', 'status', "TEXT NOT NULL DEFAULT 'active'");
  ensureColumn(db, 'users', 'status_reason', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'users', 'workspace_accent', "TEXT NOT NULL DEFAULT 'purple'");
  ensureColumn(db, 'users', 'last_login_at', 'TEXT DEFAULT NULL');
  ensureColumn(db, 'users', 'login_count', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db, 'sessions', 'refresh_token_hash', 'TEXT');
  ensureColumn(db, 'sessions', 'refresh_expires_at', 'TEXT DEFAULT NULL');
  ensureColumn(db, 'notes', 'folder_id', 'TEXT DEFAULT NULL');
  ensureColumn(db, 'notes', 'last_opened_at', 'TEXT DEFAULT NULL');
  ensureColumn(db, 'notes', 'description', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'notes', 'category', "TEXT NOT NULL DEFAULT 'General'");
  ensureColumn(db, 'notes', 'paper_bg_color', "TEXT NOT NULL DEFAULT ''");
  db.exec('CREATE INDEX IF NOT EXISTS idx_notes_folder ON notes(folder_id)');

  return db;
}

export function syncNoteFts(
  db: DatabaseSync,
  note: {
    id: string;
    user_id: string;
    title: string;
    description?: string;
    category?: string;
    plain_text: string;
    cornell_cues: string;
    cornell_summary: string;
    tags_json: string;
    is_trashed: number;
  }
): void {
  db.prepare('DELETE FROM notes_fts WHERE note_id = ?').run(note.id);
  if (note.is_trashed) return;

  let tagsText = '';
  try {
    const arr = JSON.parse(note.tags_json);
    if (Array.isArray(arr)) tagsText = arr.join(' ');
  } catch {
    tagsText = '';
  }

  const combinedText = [note.description, note.plain_text].filter(Boolean).join('\n');
  const combinedTags = [tagsText, note.category].filter(Boolean).join(' ');

  db.prepare(
    `INSERT INTO notes_fts (note_id, user_id, title, plain_text, cornell_cues, cornell_summary, tags)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    note.id,
    note.user_id,
    note.title || '',
    combinedText,
    note.cornell_cues || '',
    note.cornell_summary || '',
    combinedTags
  );
}

export function removeNoteFts(db: DatabaseSync, noteId: string): void {
  db.prepare('DELETE FROM notes_fts WHERE note_id = ?').run(noteId);
}
