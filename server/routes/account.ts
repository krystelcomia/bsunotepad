import fs from 'node:fs';
import path from 'node:path';
import { Router, Response } from 'express';
import { DatabaseSync } from 'node:sqlite';
import { AppConfig } from '../config.js';
import { clearSessionCookie } from '../middleware/auth.js';
import { createAvatarUploader } from '../middleware/upload.js';
import { AuthenticatedRequest, SafeUser } from '../types.js';
import { hashPassword, verifyPassword } from '../utils/crypto.js';

export function createAccountRouter(
  db: DatabaseSync,
  config: AppConfig,
  requireAuth: (req: AuthenticatedRequest, res: Response, next: () => void) => void
): Router {
  const router = Router();
  const avatarUpload = createAvatarUploader(config);

  router.get('/avatar/:userId/:filename', (req, res) => {
    const userId = path.basename(req.params.userId || '');
    const filename = path.basename(req.params.filename || '');
    const fullPath = path.join(config.avatarsDir, userId, filename);
    if (!fs.existsSync(fullPath)) {
      res.status(404).json({ error: 'Avatar not found' });
      return;
    }
    res.sendFile(fullPath);
  });

  router.get('/overview', requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.user!.id;

    const sessions = db
      .prepare(
        `SELECT id, user_agent, ip_address, expires_at, created_at, last_active_at
         FROM sessions
         WHERE user_id = ? AND expires_at > ?
         ORDER BY last_active_at DESC`
      )
      .all(userId, new Date().toISOString()) as Array<{
      id: string;
      user_agent: string;
      ip_address: string;
      expires_at: string;
      created_at: string;
      last_active_at: string;
    }>;

    const storageByCategory = db
      .prepare(
        `SELECT category, COUNT(*) as count, COALESCE(SUM(size_bytes), 0) as bytes
         FROM attachments
         WHERE user_id = ?
         GROUP BY category`
      )
      .all(userId) as Array<{ category: string; count: number; bytes: number }>;

    const totalUsedRow = db
      .prepare('SELECT COALESCE(SUM(size_bytes), 0) as total FROM attachments WHERE user_id = ?')
      .get(userId) as { total: number };

    const counts = {
      subjects: Number((db.prepare('SELECT COUNT(*) as c FROM subjects WHERE user_id = ?').get(userId) as { c: number }).c),
      notebooks: Number((db.prepare('SELECT COUNT(*) as c FROM notebooks WHERE user_id = ?').get(userId) as { c: number }).c),
      notes: Number((db.prepare('SELECT COUNT(*) as c FROM notes WHERE user_id = ? AND is_trashed = 0').get(userId) as { c: number }).c),
      files: Number((db.prepare('SELECT COUNT(*) as c FROM attachments WHERE user_id = ?').get(userId) as { c: number }).c),
    };

    res.json({
      user: req.user,
      counts,
      storage: {
        usedBytes: Number(totalUsedRow?.total || 0),
        quotaBytes: req.user!.storage_quota_bytes,
        breakdown: storageByCategory,
      },
      sessions: sessions.map((s) => ({
        ...s,
        isCurrent: s.id === req.sessionId,
      })),
    });
  });

  router.patch('/profile', requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.user!.id;
    const fullName = req.body?.full_name !== undefined ? String(req.body.full_name).trim() : req.user!.full_name;
    const email = req.body?.email !== undefined ? String(req.body.email).trim().toLowerCase() : req.user!.email;
    const university = req.body?.university !== undefined ? String(req.body.university).trim() : req.user!.university;
    const major = req.body?.major !== undefined ? String(req.body.major).trim() : req.user!.major;
    const academicYear = req.body?.academic_year !== undefined ? String(req.body.academic_year).trim() : req.user!.academic_year;
    const bio = req.body?.bio !== undefined ? String(req.body.bio).trim() : req.user!.bio;
    const theme = req.body?.theme_preference !== undefined ? String(req.body.theme_preference) : req.user!.theme_preference;

    if (fullName.length < 2) {
      res.status(400).json({ error: 'Full name must be at least 2 characters.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Please provide a valid email address.' });
      return;
    }
    if (!['system', 'light', 'dark'].includes(theme)) {
      res.status(400).json({ error: 'Invalid theme preference.' });
      return;
    }

    if (email !== req.user!.email) {
      const taken = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, userId);
      if (taken) {
        res.status(409).json({ error: 'That email address is already associated with another account.' });
        return;
      }
    }

    const now = new Date().toISOString();
    db.prepare(
      `UPDATE users
       SET email = ?, full_name = ?, university = ?, major = ?, academic_year = ?, bio = ?, theme_preference = ?, updated_at = ?
       WHERE id = ?`
    ).run(email, fullName, university, major, academicYear, bio, theme, now, userId);

    const updated = db
      .prepare(
        `SELECT id, email, full_name, university, major, academic_year, bio, avatar_file,
                theme_preference, storage_quota_bytes, is_demo, created_at, updated_at
         FROM users WHERE id = ?`
      )
      .get(userId) as unknown as SafeUser;

    res.json({ user: updated });
  });

  router.post('/avatar', requireAuth, (req: AuthenticatedRequest, res) => {
    avatarUpload.single('avatar')(req, res, (err) => {
      if (err) {
        res.status(400).json({ error: err.message || 'Avatar upload failed' });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: 'No avatar image file provided' });
        return;
      }

      const userId = req.user!.id;
      const oldAvatar = req.user!.avatar_file;
      if (oldAvatar) {
        const oldPath = path.join(config.avatarsDir, userId, path.basename(oldAvatar));
        if (fs.existsSync(oldPath)) {
          fs.rmSync(oldPath, { force: true });
        }
      }

      const now = new Date().toISOString();
      db.prepare('UPDATE users SET avatar_file = ?, updated_at = ? WHERE id = ?').run(
        req.file.filename,
        now,
        userId
      );

      const updated = db
        .prepare(
          `SELECT id, email, full_name, university, major, academic_year, bio, avatar_file,
                  theme_preference, storage_quota_bytes, is_demo, created_at, updated_at
           FROM users WHERE id = ?`
        )
        .get(userId) as unknown as SafeUser;

      res.json({ user: updated });
    });
  });

  router.post('/password', requireAuth, (req: AuthenticatedRequest, res) => {
    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '');
    const revokeOthers = Boolean(req.body?.revokeOtherSessions);

    if (newPassword.length < 8) {
      res.status(400).json({ error: 'New password must be at least 8 characters long.' });
      return;
    }

    const row = db
      .prepare('SELECT password_hash FROM users WHERE id = ?')
      .get(req.user!.id) as { password_hash: string };

    if (!verifyPassword(currentPassword, row.password_hash)) {
      res.status(401).json({ error: 'Current password is incorrect.' });
      return;
    }

    const newHash = hashPassword(newPassword);
    const now = new Date().toISOString();
    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(
      newHash,
      now,
      req.user!.id
    );

    if (revokeOthers && req.sessionId) {
      db.prepare('DELETE FROM sessions WHERE user_id = ? AND id != ?').run(req.user!.id, req.sessionId);
    }

    res.json({ ok: true });
  });

  router.delete('/sessions/:sessionId', requireAuth, (req: AuthenticatedRequest, res) => {
    const targetId = String(req.params.sessionId || '');
    const info = db
      .prepare('DELETE FROM sessions WHERE id = ? AND user_id = ?')
      .run(targetId, req.user!.id);

    if (info.changes === 0) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    res.json({ ok: true });
  });

  router.get('/export', requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.user!.id;
    const subjects = db.prepare('SELECT * FROM subjects WHERE user_id = ?').all(userId);
    const notebooks = db.prepare('SELECT * FROM notebooks WHERE user_id = ?').all(userId);
    const notes = db.prepare('SELECT * FROM notes WHERE user_id = ?').all(userId);
    const tasks = db.prepare('SELECT * FROM study_tasks WHERE user_id = ?').all(userId);
    const flashcards = db.prepare('SELECT * FROM flashcards WHERE user_id = ?').all(userId);

    const payload = {
      exportedAt: new Date().toISOString(),
      platform: 'INKORA',
      user: req.user,
      subjects,
      notebooks,
      notes,
      tasks,
      flashcards,
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="inkora-workspace-backup.json"');
    res.send(JSON.stringify(payload, null, 2));
  });

  router.delete('/', requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.user!.id;
    const password = String(req.body?.password || '');

    if (!req.user!.is_demo) {
      const row = db
        .prepare('SELECT password_hash FROM users WHERE id = ?')
        .get(userId) as { password_hash: string };
      if (!verifyPassword(password, row.password_hash)) {
        res.status(401).json({ error: 'Password confirmation failed.' });
        return;
      }
    }

    // Delete stored files and avatars on disk
    const userUploads = path.join(config.uploadsDir, userId);
    const userAvatars = path.join(config.avatarsDir, userId);
    fs.rmSync(userUploads, { recursive: true, force: true });
    fs.rmSync(userAvatars, { recursive: true, force: true });

    // Clean FTS rows explicitly before user cascade delete
    db.prepare('DELETE FROM notes_fts WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);

    clearSessionCookie(res, config);
    res.json({ ok: true });
  });

  return router;
}
