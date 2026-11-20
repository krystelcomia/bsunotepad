import { Router, Response } from 'express';
import { DatabaseSync } from 'node:sqlite';
import { requireRole } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types.js';
import { generateId } from '../utils/crypto.js';

export function createFoldersRouter(
  db: DatabaseSync,
  requireAuth: (req: AuthenticatedRequest, res: Response, next: () => void) => void
): Router {
  const router = Router();
  router.use(requireAuth);
  router.use(requireRole('student'));

  router.get('/', (req: AuthenticatedRequest, res) => {
    const folders = db
      .prepare(
        `SELECT f.*,
          (SELECT COUNT(*) FROM notes n WHERE n.folder_id = f.id AND n.is_trashed = 0) as note_count
         FROM folders f
         WHERE f.user_id = ?
         ORDER BY f.name COLLATE NOCASE ASC`
      )
      .all(req.user!.id);
    res.json({ folders });
  });

  router.post('/', (req: AuthenticatedRequest, res) => {
    const name = String(req.body?.name || '').trim();
    if (!name) {
      res.status(400).json({ error: 'Folder name is required.' });
      return;
    }

    let parentId = req.body?.parent_id ? String(req.body.parent_id) : null;
    if (parentId) {
      const parent = db
        .prepare('SELECT id FROM folders WHERE id = ? AND user_id = ?')
        .get(parentId, req.user!.id);
      if (!parent) parentId = null;
    }

    const id = generateId();
    const now = new Date().toISOString();
    const color = String(req.body?.color || '#6D28D9').trim().slice(0, 20);
    const icon = String(req.body?.icon || 'Folder').trim().slice(0, 40);

    db.prepare(
      `INSERT INTO folders (id, user_id, parent_id, name, color, icon, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, req.user!.id, parentId, name.slice(0, 80), color, icon, now, now);

    const folder = db
      .prepare('SELECT *, 0 as note_count FROM folders WHERE id = ?')
      .get(id);
    res.status(201).json({ folder });
  });

  router.patch('/:id', (req: AuthenticatedRequest, res) => {
    const existing = db
      .prepare('SELECT * FROM folders WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user!.id) as Record<string, unknown> | undefined;

    if (!existing) {
      res.status(404).json({ error: 'Folder not found' });
      return;
    }

    const name = req.body?.name !== undefined ? String(req.body.name).trim() : String(existing.name);
    if (!name) {
      res.status(400).json({ error: 'Folder name cannot be empty.' });
      return;
    }

    const color = req.body?.color !== undefined ? String(req.body.color).trim() : String(existing.color);
    const now = new Date().toISOString();

    db.prepare('UPDATE folders SET name = ?, color = ?, updated_at = ? WHERE id = ? AND user_id = ?').run(
      name.slice(0, 80),
      color,
      now,
      req.params.id,
      req.user!.id
    );

    const folder = db
      .prepare(
        `SELECT f.*, (SELECT COUNT(*) FROM notes n WHERE n.folder_id = f.id AND n.is_trashed = 0) as note_count
         FROM folders f WHERE f.id = ?`
      )
      .get(req.params.id);
    res.json({ folder });
  });

  router.delete('/:id', (req: AuthenticatedRequest, res) => {
    const info = db
      .prepare('DELETE FROM folders WHERE id = ? AND user_id = ?')
      .run(req.params.id, req.user!.id);
    if (info.changes === 0) {
      res.status(404).json({ error: 'Folder not found' });
      return;
    }
    res.json({ ok: true });
  });

  return router;
}
