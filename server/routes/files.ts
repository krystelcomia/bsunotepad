import fs from 'node:fs';
import path from 'node:path';
import { Router, Response } from 'express';
import { DatabaseSync } from 'node:sqlite';
import { AppConfig } from '../config.js';
import { createFileUploader } from '../middleware/upload.js';
import { AuthenticatedRequest } from '../types.js';
import { generateId } from '../utils/crypto.js';
import { categorizeMime, sanitizeFilename } from '../utils/sanitize.js';

export function createFilesRouter(
  db: DatabaseSync,
  config: AppConfig,
  requireAuth: (req: AuthenticatedRequest, res: Response, next: () => void) => void
): Router {
  const router = Router();
  const upload = createFileUploader(config);

  router.use(requireAuth);

  router.get('/', (req: AuthenticatedRequest, res) => {
    const userId = req.user!.id;
    const category = req.query.category ? String(req.query.category) : null;
    const noteId = req.query.noteId ? String(req.query.noteId) : null;

    let sql = `
      SELECT a.*, n.title as note_title, s.code as subject_code, s.name as subject_name, s.color as subject_color
      FROM attachments a
      LEFT JOIN notes n ON n.id = a.note_id
      LEFT JOIN subjects s ON s.id = a.subject_id
      WHERE a.user_id = ?
    `;
    const params: string[] = [userId];

    if (category && ['image', 'pdf', 'document', 'other'].includes(category)) {
      sql += ' AND a.category = ?';
      params.push(category);
    }
    if (noteId) {
      sql += ' AND a.note_id = ?';
      params.push(noteId);
    }

    sql += ' ORDER BY a.created_at DESC';
    const files = db.prepare(sql).all(...params);

    const usedRow = db
      .prepare('SELECT COALESCE(SUM(size_bytes), 0) as used FROM attachments WHERE user_id = ?')
      .get(userId) as { used: number };

    res.json({
      files,
      storage: {
        usedBytes: Number(usedRow?.used || 0),
        quotaBytes: req.user!.storage_quota_bytes,
      },
    });
  });

  router.post('/upload', (req: AuthenticatedRequest, res) => {
    upload.single('file')(req, res, (err) => {
      if (err) {
        res.status(400).json({ error: err.message || 'File upload failed' });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: 'No file selected for upload.' });
        return;
      }

      const userId = req.user!.id;
      const usedRow = db
        .prepare('SELECT COALESCE(SUM(size_bytes), 0) as used FROM attachments WHERE user_id = ?')
        .get(userId) as { used: number };
      const currentUsed = Number(usedRow?.used || 0);

      if (currentUsed + req.file.size > req.user!.storage_quota_bytes) {
        fs.rmSync(req.file.path, { force: true });
        res.status(413).json({
          error: 'Storage quota exceeded. Please delete unused files before uploading more.',
        });
        return;
      }

      const noteId = req.body?.note_id ? String(req.body.note_id) : null;
      const subjectId = req.body?.subject_id ? String(req.body.subject_id) : null;

      let validNoteId: string | null = null;
      if (noteId) {
        const note = db.prepare('SELECT id FROM notes WHERE id = ? AND user_id = ?').get(noteId, userId);
        if (note) validNoteId = noteId;
      }

      let validSubjectId: string | null = null;
      if (subjectId) {
        const sub = db.prepare('SELECT id FROM subjects WHERE id = ? AND user_id = ?').get(subjectId, userId);
        if (sub) validSubjectId = subjectId;
      }

      const id = generateId();
      const originalName = sanitizeFilename(req.file.originalname);
      const category = categorizeMime(req.file.mimetype, originalName);
      const now = new Date().toISOString();

      db.prepare(
        `INSERT INTO attachments (id, user_id, note_id, subject_id, original_name, stored_name, mime_type, size_bytes, category, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        userId,
        validNoteId,
        validSubjectId,
        originalName,
        req.file.filename,
        req.file.mimetype || 'application/octet-stream',
        req.file.size,
        category,
        now
      );

      const fileRecord = db
        .prepare(
          `SELECT a.*, n.title as note_title, s.code as subject_code, s.name as subject_name, s.color as subject_color
           FROM attachments a
           LEFT JOIN notes n ON n.id = a.note_id
           LEFT JOIN subjects s ON s.id = a.subject_id
           WHERE a.id = ?`
        )
        .get(id);

      res.status(201).json({
        file: fileRecord,
        storage: {
          usedBytes: currentUsed + req.file.size,
          quotaBytes: req.user!.storage_quota_bytes,
        },
      });
    });
  });

  router.patch('/:id', (req: AuthenticatedRequest, res) => {
    const existing = db
      .prepare('SELECT * FROM attachments WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user!.id) as Record<string, unknown> | undefined;

    if (!existing) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    const originalName = req.body?.original_name !== undefined
      ? sanitizeFilename(String(req.body.original_name))
      : String(existing.original_name);
    const noteId = req.body?.note_id !== undefined
      ? (req.body.note_id ? String(req.body.note_id) : null)
      : (existing.note_id as string | null);
    const subjectId = req.body?.subject_id !== undefined
      ? (req.body.subject_id ? String(req.body.subject_id) : null)
      : (existing.subject_id as string | null);

    db.prepare('UPDATE attachments SET original_name = ?, note_id = ?, subject_id = ? WHERE id = ? AND user_id = ?').run(
      originalName,
      noteId,
      subjectId,
      req.params.id,
      req.user!.id
    );

    const updated = db
      .prepare(
        `SELECT a.*, n.title as note_title, s.code as subject_code, s.name as subject_name, s.color as subject_color
         FROM attachments a
         LEFT JOIN notes n ON n.id = a.note_id
         LEFT JOIN subjects s ON s.id = a.subject_id
         WHERE a.id = ?`
      )
      .get(req.params.id);

    res.json({ file: updated });
  });

  router.get('/:id/content', (req: AuthenticatedRequest, res) => {
    const record = db
      .prepare('SELECT * FROM attachments WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user!.id) as
      | {
          id: string;
          user_id: string;
          original_name: string;
          stored_name: string;
          mime_type: string;
        }
      | undefined;

    if (!record) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    const fullPath = path.join(config.uploadsDir, record.user_id, path.basename(record.stored_name));
    if (!fs.existsSync(fullPath)) {
      res.status(404).json({ error: 'Stored file missing on disk' });
      return;
    }

    const isDownload = req.query.download === '1';
    res.setHeader('Content-Type', record.mime_type || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `${isDownload ? 'attachment' : 'inline'}; filename="${encodeURIComponent(record.original_name)}"`
    );
    res.sendFile(fullPath);
  });

  router.delete('/:id', (req: AuthenticatedRequest, res) => {
    const record = db
      .prepare('SELECT id, user_id, stored_name, size_bytes FROM attachments WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user!.id) as
      | { id: string; user_id: string; stored_name: string; size_bytes: number }
      | undefined;

    if (!record) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    const fullPath = path.join(config.uploadsDir, record.user_id, path.basename(record.stored_name));
    if (fs.existsSync(fullPath)) {
      fs.rmSync(fullPath, { force: true });
    }

    db.prepare('DELETE FROM attachments WHERE id = ? AND user_id = ?').run(req.params.id, req.user!.id);

    const usedRow = db
      .prepare('SELECT COALESCE(SUM(size_bytes), 0) as used FROM attachments WHERE user_id = ?')
      .get(req.user!.id) as { used: number };

    res.json({
      ok: true,
      storage: {
        usedBytes: Number(usedRow?.used || 0),
        quotaBytes: req.user!.storage_quota_bytes,
      },
    });
  });

  return router;
}
