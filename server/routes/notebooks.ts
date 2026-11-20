import { Router, Response } from 'express';
import { DatabaseSync } from 'node:sqlite';
import { requireRole } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types.js';
import { generateId } from '../utils/crypto.js';

export function createNotebooksRouter(
  db: DatabaseSync,
  requireAuth: (req: AuthenticatedRequest, res: Response, next: () => void) => void
): Router {
  const router = Router();
  router.use(requireAuth);
  router.use(requireRole('student'));

  router.get('/', (req: AuthenticatedRequest, res) => {
    const subjectId = req.query.subjectId ? String(req.query.subjectId) : null;
    let query = `
      SELECT nb.*,
        s.name as subject_name, s.code as subject_code, s.color as subject_color,
        (SELECT COUNT(*) FROM notes n WHERE n.notebook_id = nb.id AND n.is_trashed = 0) as note_count
      FROM notebooks nb
      LEFT JOIN subjects s ON s.id = nb.subject_id
      WHERE nb.user_id = ?
    `;
    const params: string[] = [req.user!.id];
    if (subjectId) {
      query += ' AND nb.subject_id = ?';
      params.push(subjectId);
    }
    query += ' ORDER BY nb.is_pinned DESC, nb.updated_at DESC';

    const notebooks = db.prepare(query).all(...params);
    res.json({ notebooks });
  });

  router.post('/', (req: AuthenticatedRequest, res) => {
    const title = String(req.body?.title || '').trim();
    if (!title) {
      res.status(400).json({ error: 'Notebook title is required.' });
      return;
    }

    const subjectId = req.body?.subject_id ? String(req.body.subject_id) : null;
    if (subjectId) {
      const sub = db
        .prepare('SELECT id FROM subjects WHERE id = ? AND user_id = ?')
        .get(subjectId, req.user!.id);
      if (!sub) {
        res.status(400).json({ error: 'Invalid course selected.' });
        return;
      }
    }

    const id = generateId();
    const now = new Date().toISOString();
    const description = String(req.body?.description || '').trim();
    const coverColor = String(req.body?.cover_color || '#312E81').trim();
    const accentColor = String(req.body?.accent_color || '#F59E0B').trim();
    const icon = String(req.body?.icon || 'NotebookPen').trim();
    const defaultPaperStyle = String(req.body?.default_paper_style || 'lined').trim();
    const isPinned = req.body?.is_pinned ? 1 : 0;

    db.prepare(
      `INSERT INTO notebooks (id, user_id, subject_id, title, description, cover_color, accent_color, icon, default_paper_style, is_pinned, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      req.user!.id,
      subjectId,
      title,
      description,
      coverColor,
      accentColor,
      icon,
      defaultPaperStyle,
      isPinned,
      now,
      now
    );

    const notebook = db
      .prepare(
        `SELECT nb.*, s.name as subject_name, s.code as subject_code, s.color as subject_color, 0 as note_count
         FROM notebooks nb LEFT JOIN subjects s ON s.id = nb.subject_id WHERE nb.id = ?`
      )
      .get(id);

    res.status(201).json({ notebook });
  });

  router.patch('/:id', (req: AuthenticatedRequest, res) => {
    const existing = db
      .prepare('SELECT * FROM notebooks WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user!.id) as Record<string, unknown> | undefined;

    if (!existing) {
      res.status(404).json({ error: 'Notebook not found' });
      return;
    }

    const title = req.body?.title !== undefined ? String(req.body.title).trim() : String(existing.title);
    if (!title) {
      res.status(400).json({ error: 'Notebook title cannot be empty.' });
      return;
    }

    const subjectId = req.body?.subject_id !== undefined
      ? (req.body.subject_id ? String(req.body.subject_id) : null)
      : (existing.subject_id as string | null);

    const description = req.body?.description !== undefined ? String(req.body.description).trim() : String(existing.description);
    const coverColor = req.body?.cover_color !== undefined ? String(req.body.cover_color).trim() : String(existing.cover_color);
    const accentColor = req.body?.accent_color !== undefined ? String(req.body.accent_color).trim() : String(existing.accent_color);
    const defaultPaperStyle = req.body?.default_paper_style !== undefined ? String(req.body.default_paper_style).trim() : String(existing.default_paper_style);
    const isPinned = req.body?.is_pinned !== undefined ? (req.body.is_pinned ? 1 : 0) : Number(existing.is_pinned);
    const now = new Date().toISOString();

    db.prepare(
      `UPDATE notebooks
       SET subject_id = ?, title = ?, description = ?, cover_color = ?, accent_color = ?, default_paper_style = ?, is_pinned = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`
    ).run(subjectId, title, description, coverColor, accentColor, defaultPaperStyle, isPinned, now, req.params.id, req.user!.id);

    const notebook = db
      .prepare(
        `SELECT nb.*, s.name as subject_name, s.code as subject_code, s.color as subject_color,
          (SELECT COUNT(*) FROM notes n WHERE n.notebook_id = nb.id AND n.is_trashed = 0) as note_count
         FROM notebooks nb LEFT JOIN subjects s ON s.id = nb.subject_id WHERE nb.id = ?`
      )
      .get(req.params.id);

    res.json({ notebook });
  });

  router.delete('/:id', (req: AuthenticatedRequest, res) => {
    const info = db
      .prepare('DELETE FROM notebooks WHERE id = ? AND user_id = ?')
      .run(req.params.id, req.user!.id);
    if (info.changes === 0) {
      res.status(404).json({ error: 'Notebook not found' });
      return;
    }
    res.json({ ok: true });
  });

  return router;
}
