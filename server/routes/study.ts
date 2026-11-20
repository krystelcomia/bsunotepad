import { Router, Response } from 'express';
import { DatabaseSync } from 'node:sqlite';
import { requireRole } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types.js';
import { generateId } from '../utils/crypto.js';

export function createStudyRouter(
  db: DatabaseSync,
  requireAuth: (req: AuthenticatedRequest, res: Response, next: () => void) => void
): Router {
  const router = Router();
  router.use(requireAuth);
  router.use(requireRole('student'));

  // Tasks
  router.get('/tasks', (req: AuthenticatedRequest, res) => {
    const tasks = db
      .prepare(
        `SELECT t.*, s.code as subject_code, s.name as subject_name, s.color as subject_color, n.title as note_title
         FROM study_tasks t
         LEFT JOIN subjects s ON s.id = t.subject_id
         LEFT JOIN notes n ON n.id = t.note_id
         WHERE t.user_id = ?
         ORDER BY CASE t.status WHEN 'done' THEN 2 WHEN 'in_progress' THEN 0 ELSE 1 END,
                  CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END,
                  t.due_date ASC, t.created_at DESC`
      )
      .all(req.user!.id);
    res.json({ tasks });
  });

  router.post('/tasks', (req: AuthenticatedRequest, res) => {
    const title = String(req.body?.title || '').trim();
    if (!title) {
      res.status(400).json({ error: 'Kinakailangan ang pamagat ng gawain.' });
      return;
    }

    const id = generateId();
    const now = new Date().toISOString();
    const description = String(req.body?.description || '').trim();
    const dueDate = req.body?.due_date ? String(req.body.due_date) : null;
    const priority = ['low', 'medium', 'high'].includes(String(req.body?.priority))
      ? String(req.body.priority)
      : 'medium';
    const status = ['todo', 'in_progress', 'done'].includes(String(req.body?.status))
      ? String(req.body.status)
      : 'todo';
    const subjectId = req.body?.subject_id ? String(req.body.subject_id) : null;
    const noteId = req.body?.note_id ? String(req.body.note_id) : null;

    db.prepare(
      `INSERT INTO study_tasks (id, user_id, subject_id, note_id, title, description, due_date, priority, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, req.user!.id, subjectId, noteId, title, description, dueDate, priority, status, now, now);

    const task = db
      .prepare(
        `SELECT t.*, s.code as subject_code, s.name as subject_name, s.color as subject_color, n.title as note_title
         FROM study_tasks t
         LEFT JOIN subjects s ON s.id = t.subject_id
         LEFT JOIN notes n ON n.id = t.note_id
         WHERE t.id = ?`
      )
      .get(id);

    res.status(201).json({ task });
  });

  router.patch('/tasks/:id', (req: AuthenticatedRequest, res) => {
    const existing = db
      .prepare('SELECT * FROM study_tasks WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user!.id) as Record<string, unknown> | undefined;

    if (!existing) {
      res.status(404).json({ error: 'Hindi nahanap ang gawain.' });
      return;
    }

    const title = req.body?.title !== undefined ? String(req.body.title).trim() || String(existing.title) : String(existing.title);
    const description = req.body?.description !== undefined ? String(req.body.description).trim() : String(existing.description);
    const dueDate = req.body?.due_date !== undefined ? (req.body.due_date ? String(req.body.due_date) : null) : (existing.due_date as string | null);
    const priority = req.body?.priority && ['low', 'medium', 'high'].includes(String(req.body.priority))
      ? String(req.body.priority)
      : String(existing.priority);
    const status = req.body?.status && ['todo', 'in_progress', 'done'].includes(String(req.body.status))
      ? String(req.body.status)
      : String(existing.status);
    const subjectId = req.body?.subject_id !== undefined
      ? (req.body.subject_id ? String(req.body.subject_id) : null)
      : (existing.subject_id as string | null);
    const now = new Date().toISOString();

    db.prepare(
      `UPDATE study_tasks SET title = ?, description = ?, due_date = ?, priority = ?, status = ?, subject_id = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`
    ).run(title, description, dueDate, priority, status, subjectId, now, req.params.id, req.user!.id);

    const task = db
      .prepare(
        `SELECT t.*, s.code as subject_code, s.name as subject_name, s.color as subject_color, n.title as note_title
         FROM study_tasks t
         LEFT JOIN subjects s ON s.id = t.subject_id
         LEFT JOIN notes n ON n.id = t.note_id
         WHERE t.id = ?`
      )
      .get(req.params.id);

    res.json({ task });
  });

  router.delete('/tasks/:id', (req: AuthenticatedRequest, res) => {
    const info = db
      .prepare('DELETE FROM study_tasks WHERE id = ? AND user_id = ?')
      .run(req.params.id, req.user!.id);
    if (info.changes === 0) {
      res.status(404).json({ error: 'Hindi nahanap ang gawain.' });
      return;
    }
    res.json({ ok: true });
  });

  // Flashcards
  router.get('/flashcards', (req: AuthenticatedRequest, res) => {
    const subjectId = req.query.subjectId ? String(req.query.subjectId) : null;
    let sql = `
      SELECT f.*, s.code as subject_code, s.name as subject_name, s.color as subject_color, n.title as note_title
      FROM flashcards f
      LEFT JOIN subjects s ON s.id = f.subject_id
      LEFT JOIN notes n ON n.id = f.note_id
      WHERE f.user_id = ?
    `;
    const params: string[] = [req.user!.id];
    if (subjectId) {
      sql += ' AND f.subject_id = ?';
      params.push(subjectId);
    }
    sql += ' ORDER BY f.confidence ASC, f.created_at DESC';

    const flashcards = db.prepare(sql).all(...params);
    res.json({ flashcards });
  });

  router.post('/flashcards', (req: AuthenticatedRequest, res) => {
    const front = String(req.body?.front || '').trim();
    const back = String(req.body?.back || '').trim();
    if (!front || !back) {
      res.status(400).json({ error: 'Kinakailangan ang parehong tanong (harap) at sagot (likod).' });
      return;
    }

    const id = generateId();
    const now = new Date().toISOString();
    const subjectId = req.body?.subject_id ? String(req.body.subject_id) : null;
    const notebookId = req.body?.notebook_id ? String(req.body.notebook_id) : null;
    const noteId = req.body?.note_id ? String(req.body.note_id) : null;

    db.prepare(
      `INSERT INTO flashcards (id, user_id, subject_id, notebook_id, note_id, front, back, confidence, review_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?)`
    ).run(id, req.user!.id, subjectId, notebookId, noteId, front, back, now);

    const flashcard = db
      .prepare(
        `SELECT f.*, s.code as subject_code, s.name as subject_name, s.color as subject_color, n.title as note_title
         FROM flashcards f
         LEFT JOIN subjects s ON s.id = f.subject_id
         LEFT JOIN notes n ON n.id = f.note_id
         WHERE f.id = ?`
      )
      .get(id);

    res.status(201).json({ flashcard });
  });

  router.post('/flashcards/:id/review', (req: AuthenticatedRequest, res) => {
    const existing = db
      .prepare('SELECT * FROM flashcards WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user!.id) as { confidence: number; review_count: number } | undefined;

    if (!existing) {
      res.status(404).json({ error: 'Hindi nahanap ang flashcard.' });
      return;
    }

    const rating = Math.max(0, Math.min(5, Number(req.body?.confidence ?? 3)));
    const now = new Date().toISOString();

    db.prepare(
      `UPDATE flashcards SET confidence = ?, review_count = review_count + 1, last_reviewed_at = ?
       WHERE id = ? AND user_id = ?`
    ).run(rating, now, req.params.id, req.user!.id);

    const flashcard = db.prepare('SELECT * FROM flashcards WHERE id = ?').get(req.params.id);
    res.json({ flashcard });
  });

  router.delete('/flashcards/:id', (req: AuthenticatedRequest, res) => {
    const info = db
      .prepare('DELETE FROM flashcards WHERE id = ? AND user_id = ?')
      .run(req.params.id, req.user!.id);
    if (info.changes === 0) {
      res.status(404).json({ error: 'Hindi nahanap ang flashcard.' });
      return;
    }
    res.json({ ok: true });
  });

  // Study Focus Sessions
  router.get('/sessions', (req: AuthenticatedRequest, res) => {
    const sessions = db
      .prepare(
        `SELECT ss.*, s.code as subject_code, s.name as subject_name, s.color as subject_color
         FROM study_sessions ss
         LEFT JOIN subjects s ON s.id = ss.subject_id
         WHERE ss.user_id = ?
         ORDER BY ss.completed_at DESC
         LIMIT 30`
      )
      .all(req.user!.id);
    res.json({ sessions });
  });

  router.post('/sessions', (req: AuthenticatedRequest, res) => {
    const durationMinutes = Math.max(1, Math.min(240, Math.round(Number(req.body?.duration_minutes || 25))));
    const mode = req.body?.mode === 'break' ? 'break' : 'focus';
    const subjectId = req.body?.subject_id ? String(req.body.subject_id) : null;
    const noteId = req.body?.note_id ? String(req.body.note_id) : null;
    const id = generateId();
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO study_sessions (id, user_id, subject_id, note_id, duration_minutes, mode, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, req.user!.id, subjectId, noteId, durationMinutes, mode, now);

    const session = db.prepare('SELECT * FROM study_sessions WHERE id = ?').get(id);
    res.status(201).json({ session });
  });

  return router;
}
