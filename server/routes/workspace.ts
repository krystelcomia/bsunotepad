import { Router, Response } from 'express';
import { DatabaseSync } from 'node:sqlite';
import { requireRole } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types.js';
import { generateId } from '../utils/crypto.js';

export function createWorkspaceRouter(
  db: DatabaseSync,
  requireAuth: (req: AuthenticatedRequest, res: Response, next: () => void) => void
): Router {
  const router = Router();
  router.use(requireAuth);
  router.use(requireRole('student'));

  router.get('/summary', (req: AuthenticatedRequest, res) => {
    const userId = req.user!.id;

    const folders = db
      .prepare(
        `SELECT f.*,
          (SELECT COUNT(*) FROM notes n WHERE n.folder_id = f.id AND n.is_trashed = 0) as note_count
         FROM folders f
         WHERE f.user_id = ?
         ORDER BY f.name COLLATE NOCASE ASC`
      )
      .all(userId);

    const subjects = db
      .prepare(
        `SELECT s.*,
          (SELECT COUNT(*) FROM notebooks nb WHERE nb.subject_id = s.id) as notebook_count,
          (SELECT COUNT(*) FROM notes n WHERE n.subject_id = s.id AND n.is_trashed = 0) as note_count
         FROM subjects s
         WHERE s.user_id = ?
         ORDER BY s.sort_order ASC, s.created_at ASC`
      )
      .all(userId);

    const notebooks = db
      .prepare(
        `SELECT nb.*,
          s.name as subject_name, s.code as subject_code, s.color as subject_color,
          (SELECT COUNT(*) FROM notes n WHERE n.notebook_id = nb.id AND n.is_trashed = 0) as note_count
         FROM notebooks nb
         LEFT JOIN subjects s ON s.id = nb.subject_id
         WHERE nb.user_id = ?
         ORDER BY nb.is_pinned DESC, nb.updated_at DESC`
      )
      .all(userId);

    const recentNotes = db
      .prepare(
        `SELECT n.id, n.folder_id, n.notebook_id, n.subject_id, n.title, n.mode, n.paper_style, n.page_size,
                substr(n.plain_text, 1, 220) as excerpt, n.drawing_preview, n.tags_json,
                n.word_count, n.is_pinned, n.is_starred, n.share_token, n.created_at, n.updated_at,
                f.name as folder_name, f.color as folder_color,
                nb.title as notebook_title, s.code as subject_code, s.name as subject_name, s.color as subject_color
         FROM notes n
         LEFT JOIN folders f ON f.id = n.folder_id
         LEFT JOIN notebooks nb ON nb.id = n.notebook_id
         LEFT JOIN subjects s ON s.id = n.subject_id
         WHERE n.user_id = ? AND n.is_trashed = 0
         ORDER BY n.is_pinned DESC, n.updated_at DESC
         LIMIT 12`
      )
      .all(userId);

    const trashedCount = Number(
      (db.prepare('SELECT COUNT(*) as c FROM notes WHERE user_id = ? AND is_trashed = 1').get(userId) as { c: number }).c
    );

    const upcomingTasks = db
      .prepare(
        `SELECT t.*, s.code as subject_code, s.color as subject_color
         FROM study_tasks t
         LEFT JOIN subjects s ON s.id = t.subject_id
         WHERE t.user_id = ? AND t.status != 'done'
         ORDER BY CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END, t.due_date ASC, t.created_at DESC
         LIMIT 6`
      )
      .all(userId);

    const usedRow = db
      .prepare('SELECT COALESCE(SUM(size_bytes), 0) as used FROM attachments WHERE user_id = ?')
      .get(userId) as { used: number };

    const studyRow = db
      .prepare(
        `SELECT COALESCE(SUM(duration_minutes), 0) as total_minutes
         FROM study_sessions
         WHERE user_id = ? AND completed_at >= ?`
      )
      .get(userId, new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()) as { total_minutes: number };

    const flashcardRow = db
      .prepare('SELECT COUNT(*) as c FROM flashcards WHERE user_id = ?')
      .get(userId) as { c: number };

    res.json({
      folders,
      subjects,
      notebooks,
      recentNotes,
      trashedCount,
      upcomingTasks,
      stats: {
        storageUsedBytes: Number(usedRow?.used || 0),
        storageQuotaBytes: req.user!.storage_quota_bytes,
        studyMinutesWeek: Number(studyRow?.total_minutes || 0),
        flashcardCount: Number(flashcardRow?.c || 0),
      },
    });
  });

  router.get('/search', (req: AuthenticatedRequest, res) => {
    const userId = req.user!.id;
    const rawQuery = String(req.query.q || '').trim();
    if (!rawQuery) {
      res.json({ notes: [], folders: [], notebooks: [], subjects: [], files: [] });
      return;
    }

    let notes: unknown[] = [];
    // Try FTS5 query first using prefix tokens
    const tokens = rawQuery
      .replace(/["'*():]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .map((t) => `"${t}"*`);

    if (tokens.length > 0) {
      try {
        const ftsExpr = tokens.join(' AND ');
        notes = db
          .prepare(
            `SELECT n.id, n.title, n.mode, n.paper_style, n.notebook_id, n.subject_id,
                    substr(n.plain_text, 1, 180) as excerpt, n.word_count, n.updated_at,
                    nb.title as notebook_title, s.code as subject_code, s.color as subject_color
             FROM notes_fts f
             JOIN notes n ON n.id = f.note_id
             LEFT JOIN notebooks nb ON nb.id = n.notebook_id
             LEFT JOIN subjects s ON s.id = n.subject_id
             WHERE notes_fts MATCH ? AND f.user_id = ? AND n.is_trashed = 0
             ORDER BY rank
             LIMIT 20`
          )
          .all(ftsExpr, userId);
      } catch {
        notes = [];
      }
    }

    if (notes.length === 0) {
      const likePattern = `%${rawQuery}%`;
      notes = db
        .prepare(
          `SELECT n.id, n.title, n.mode, n.paper_style, n.notebook_id, n.subject_id,
                  substr(n.plain_text, 1, 180) as excerpt, n.word_count, n.updated_at,
                  nb.title as notebook_title, s.code as subject_code, s.color as subject_color
           FROM notes n
           LEFT JOIN notebooks nb ON nb.id = n.notebook_id
           LEFT JOIN subjects s ON s.id = n.subject_id
           WHERE n.user_id = ? AND n.is_trashed = 0
             AND (n.title LIKE ? OR n.plain_text LIKE ? OR n.tags_json LIKE ?)
           ORDER BY n.updated_at DESC
           LIMIT 20`
        )
        .all(userId, likePattern, likePattern, likePattern);
    }

    const like = `%${rawQuery}%`;
    const folders = db
      .prepare(
        `SELECT id, name, color
         FROM folders WHERE user_id = ? AND name LIKE ?
         LIMIT 10`
      )
      .all(userId, like);

    const notebooks = db
      .prepare(
        `SELECT id, title, description, cover_color, default_paper_style
         FROM notebooks WHERE user_id = ? AND (title LIKE ? OR description LIKE ?)
         LIMIT 10`
      )
      .all(userId, like, like);

    const subjects = db
      .prepare(
        `SELECT id, code, name, instructor, color
         FROM subjects WHERE user_id = ? AND (name LIKE ? OR code LIKE ? OR instructor LIKE ?)
         LIMIT 10`
      )
      .all(userId, like, like, like);

    const files = db
      .prepare(
        `SELECT id, original_name, mime_type, size_bytes, category, note_id, created_at
         FROM attachments WHERE user_id = ? AND original_name LIKE ?
         LIMIT 10`
      )
      .all(userId, like);

    res.json({ notes, folders, notebooks, subjects, files });
  });

  // Subjects CRUD
  router.get('/subjects', (req: AuthenticatedRequest, res) => {
    const subjects = db
      .prepare(
        `SELECT s.*,
          (SELECT COUNT(*) FROM notebooks nb WHERE nb.subject_id = s.id) as notebook_count,
          (SELECT COUNT(*) FROM notes n WHERE n.subject_id = s.id AND n.is_trashed = 0) as note_count
         FROM subjects s
         WHERE s.user_id = ?
         ORDER BY s.sort_order ASC, s.created_at ASC`
      )
      .all(req.user!.id);
    res.json({ subjects });
  });

  router.post('/subjects', (req: AuthenticatedRequest, res) => {
    const name = String(req.body?.name || '').trim();
    if (!name) {
      res.status(400).json({ error: 'Course/subject name is required.' });
      return;
    }

    const id = generateId();
    const now = new Date().toISOString();
    const code = String(req.body?.code || '').trim().slice(0, 24);
    const instructor = String(req.body?.instructor || '').trim().slice(0, 80);
    const semester = String(req.body?.semester || '').trim().slice(0, 40);
    const color = String(req.body?.color || '#4F46E5').trim().slice(0, 20);
    const icon = String(req.body?.icon || 'BookOpen').trim().slice(0, 40);

    db.prepare(
      `INSERT INTO subjects (id, user_id, code, name, instructor, semester, color, icon, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
    ).run(id, req.user!.id, code, name, instructor, semester, color, icon, now, now);

    const subject = db.prepare('SELECT * FROM subjects WHERE id = ?').get(id);
    res.status(201).json({ subject });
  });

  router.patch('/subjects/:id', (req: AuthenticatedRequest, res) => {
    const existing = db
      .prepare('SELECT * FROM subjects WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user!.id) as Record<string, unknown> | undefined;

    if (!existing) {
      res.status(404).json({ error: 'Subject not found' });
      return;
    }

    const name = req.body?.name !== undefined ? String(req.body.name).trim() : String(existing.name);
    if (!name) {
      res.status(400).json({ error: 'Course name cannot be empty.' });
      return;
    }

    const code = req.body?.code !== undefined ? String(req.body.code).trim() : String(existing.code);
    const instructor = req.body?.instructor !== undefined ? String(req.body.instructor).trim() : String(existing.instructor);
    const semester = req.body?.semester !== undefined ? String(req.body.semester).trim() : String(existing.semester);
    const color = req.body?.color !== undefined ? String(req.body.color).trim() : String(existing.color);
    const icon = req.body?.icon !== undefined ? String(req.body.icon).trim() : String(existing.icon);
    const now = new Date().toISOString();

    db.prepare(
      `UPDATE subjects SET name = ?, code = ?, instructor = ?, semester = ?, color = ?, icon = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`
    ).run(name, code, instructor, semester, color, icon, now, req.params.id, req.user!.id);

    const subject = db.prepare('SELECT * FROM subjects WHERE id = ?').get(req.params.id);
    res.json({ subject });
  });

  router.delete('/subjects/:id', (req: AuthenticatedRequest, res) => {
    const info = db
      .prepare('DELETE FROM subjects WHERE id = ? AND user_id = ?')
      .run(req.params.id, req.user!.id);
    if (info.changes === 0) {
      res.status(404).json({ error: 'Subject not found' });
      return;
    }
    res.json({ ok: true });
  });

  return router;
}
