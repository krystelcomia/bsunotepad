import fs from 'node:fs';
import path from 'node:path';
import { Router, Response } from 'express';
import { DatabaseSync } from 'node:sqlite';
import { AppConfig } from '../config.js';
import { requireRole } from '../middleware/auth.js';
import { AccountStatus, AuthenticatedRequest } from '../types.js';

export function createAdminRouter(
  db: DatabaseSync,
  config: AppConfig,
  requireAuth: (req: AuthenticatedRequest, res: Response, next: () => void) => void
): Router {
  const router = Router();
  router.use(requireAuth);
  router.use(requireRole('admin'));

  // Aggregate usage & account statistics ONLY (no private note contents or personal files)
  router.get('/stats', (_req: AuthenticatedRequest, res) => {
    const nowMs = Date.now();
    const sevenDaysAgo = new Date(nowMs - 7 * 24 * 3600 * 1000).toISOString();
    const oneDayAgo = new Date(nowMs - 24 * 3600 * 1000).toISOString();

    const userCounts = db
      .prepare(
        `SELECT
          COUNT(*) as totalStudents,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as activeAccounts,
          SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END) as suspendedAccounts,
          SUM(CASE WHEN status = 'deactivated' THEN 1 ELSE 0 END) as deactivatedAccounts,
          SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) as newRegistrations7d,
          SUM(CASE WHEN last_login_at >= ? THEN 1 ELSE 0 END) as activeLogins24h
         FROM users
         WHERE role = 'student'`
      )
      .get(sevenDaysAgo, oneDayAgo) as Record<string, number | null>;

    const contentAgg = db
      .prepare(
        `SELECT
          (SELECT COUNT(*) FROM notes WHERE is_trashed = 0) as totalNotes,
          (SELECT COUNT(*) FROM notebooks) as totalNotebooks,
          (SELECT COUNT(*) FROM folders) as totalFolders,
          (SELECT COUNT(*) FROM attachments) as totalFiles,
          (SELECT COALESCE(SUM(size_bytes), 0) FROM attachments) as totalStorageUsedBytes,
          (SELECT COUNT(*) FROM account_concerns WHERE status != 'resolved') as openConcerns`
      )
      .get() as Record<string, number | null>;

    res.json({
      stats: {
        totalStudents: Number(userCounts?.totalStudents || 0),
        activeAccounts: Number(userCounts?.activeAccounts || 0),
        suspendedAccounts: Number(userCounts?.suspendedAccounts || 0),
        deactivatedAccounts: Number(userCounts?.deactivatedAccounts || 0),
        newRegistrations7d: Number(userCounts?.newRegistrations7d || 0),
        activeLogins24h: Number(userCounts?.activeLogins24h || 0),
        totalNotes: Number(contentAgg?.totalNotes || 0),
        totalNotebooks: Number(contentAgg?.totalNotebooks || 0),
        totalFolders: Number(contentAgg?.totalFolders || 0),
        totalFiles: Number(contentAgg?.totalFiles || 0),
        totalStorageUsedBytes: Number(contentAgg?.totalStorageUsedBytes || 0),
        openConcerns: Number(contentAgg?.openConcerns || 0),
      },
    });
  });

  // List & search registered student accounts (metadata & activity only — zero note/file content)
  router.get('/students', (req: AuthenticatedRequest, res) => {
    const q = String(req.query.q || '').trim();
    const status = req.query.status ? String(req.query.status) : 'all';

    let sql = `
      SELECT
        u.id, u.email, u.full_name, u.university, u.major, u.academic_year,
        u.status, u.status_reason, u.is_demo, u.last_login_at, u.login_count,
        u.created_at, u.updated_at, u.storage_quota_bytes,
        (SELECT COUNT(*) FROM notes n WHERE n.user_id = u.id AND n.is_trashed = 0) as note_count,
        (SELECT COUNT(*) FROM attachments a WHERE a.user_id = u.id) as file_count,
        (SELECT COALESCE(SUM(a.size_bytes), 0) FROM attachments a WHERE a.user_id = u.id) as storage_used_bytes,
        (SELECT COUNT(*) FROM sessions s WHERE s.user_id = u.id AND s.expires_at > ?) as active_session_count
      FROM users u
      WHERE u.role = 'student'
    `;
    const params: string[] = [new Date().toISOString()];

    if (['active', 'deactivated', 'suspended'].includes(status)) {
      sql += ' AND u.status = ?';
      params.push(status);
    }

    if (q) {
      sql += ' AND (u.full_name LIKE ? OR u.email LIKE ? OR u.university LIKE ?)';
      const like = `%${q}%`;
      params.push(like, like, like);
    }

    sql += ' ORDER BY u.created_at DESC';
    const students = db.prepare(sql).all(...params);
    res.json({ students });
  });

  // Activate, deactivate, or suspend a student account
  router.patch('/students/:id/status', (req: AuthenticatedRequest, res) => {
    const targetId = String(req.params.id || '');
    const status = String(req.body?.status || '') as AccountStatus;
    const reason = String(req.body?.status_reason || '').trim().slice(0, 300);

    if (!['active', 'deactivated', 'suspended'].includes(status)) {
      res.status(400).json({ error: 'Invalid status. Must be active, deactivated, or suspended.' });
      return;
    }

    const target = db
      .prepare('SELECT id, role FROM users WHERE id = ?')
      .get(targetId) as { id: string; role: string } | undefined;

    if (!target || target.role !== 'student') {
      res.status(404).json({ error: 'Student account not found.' });
      return;
    }

    const now = new Date().toISOString();
    db.prepare('UPDATE users SET status = ?, status_reason = ?, updated_at = ? WHERE id = ?').run(
      status,
      status === 'active' ? '' : reason,
      now,
      targetId
    );

    if (status !== 'active') {
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(targetId);
    }

    const updated = db
      .prepare(
        `SELECT id, email, full_name, university, major, academic_year, status, status_reason,
                is_demo, last_login_at, login_count, created_at, updated_at
         FROM users WHERE id = ?`
      )
      .get(targetId);

    res.json({ student: updated });
  });

  // Delete a student account when necessary
  router.delete('/students/:id', (req: AuthenticatedRequest, res) => {
    const targetId = String(req.params.id || '');
    const target = db
      .prepare('SELECT id, role FROM users WHERE id = ?')
      .get(targetId) as { id: string; role: string } | undefined;

    if (!target || target.role !== 'student') {
      res.status(404).json({ error: 'Student account not found.' });
      return;
    }

    const userUploads = path.join(config.uploadsDir, targetId);
    const userAvatars = path.join(config.avatarsDir, targetId);
    fs.rmSync(userUploads, { recursive: true, force: true });
    fs.rmSync(userAvatars, { recursive: true, force: true });

    db.prepare('DELETE FROM notes_fts WHERE user_id = ?').run(targetId);
    db.prepare('DELETE FROM users WHERE id = ?').run(targetId);

    res.json({ ok: true });
  });

  // Manage account-related concerns
  router.get('/concerns', (req: AuthenticatedRequest, res) => {
    const status = req.query.status ? String(req.query.status) : 'all';
    let sql = `
      SELECT c.*, u.full_name as student_name, u.status as student_status
      FROM account_concerns c
      LEFT JOIN users u ON u.id = c.user_id
    `;
    const params: string[] = [];
    if (['open', 'in_review', 'resolved'].includes(status)) {
      sql += ' WHERE c.status = ?';
      params.push(status);
    }
    sql += " ORDER BY CASE c.status WHEN 'open' THEN 0 WHEN 'in_review' THEN 1 ELSE 2 END, c.created_at DESC";
    const concerns = db.prepare(sql).all(...params);
    res.json({ concerns });
  });

  router.patch('/concerns/:id', (req: AuthenticatedRequest, res) => {
    const existing = db
      .prepare('SELECT * FROM account_concerns WHERE id = ?')
      .get(req.params.id) as Record<string, unknown> | undefined;

    if (!existing) {
      res.status(404).json({ error: 'Concern ticket not found.' });
      return;
    }

    const status = req.body?.status && ['open', 'in_review', 'resolved'].includes(String(req.body.status))
      ? String(req.body.status)
      : String(existing.status);
    const adminNote = req.body?.admin_note !== undefined
      ? String(req.body.admin_note).trim().slice(0, 1000)
      : String(existing.admin_note);
    const now = new Date().toISOString();

    db.prepare(
      `UPDATE account_concerns
       SET status = ?, admin_note = ?, resolved_by = ?, updated_at = ?
       WHERE id = ?`
    ).run(status, adminNote, req.user!.id, now, req.params.id);

    const concern = db
      .prepare(
        `SELECT c.*, u.full_name as student_name, u.status as student_status
         FROM account_concerns c
         LEFT JOIN users u ON u.id = c.user_id
         WHERE c.id = ?`
      )
      .get(req.params.id);

    res.json({ concern });
  });

  return router;
}
