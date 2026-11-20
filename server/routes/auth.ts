import { Router, Response } from 'express';
import { DatabaseSync } from 'node:sqlite';
import { AppConfig } from '../config.js';
import { ensureAdminUser, ensureDemoUser, seedStarterWorkspaceForNewUser } from '../db/seed.js';
import {
  clearSessionCookie,
  createSessionForUser,
  SAFE_USER_COLUMNS,
  setSessionCookie,
} from '../middleware/auth.js';
import { AuthenticatedRequest, SafeUser } from '../types.js';
import { generateId, hashPassword, verifyPassword } from '../utils/crypto.js';

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getSafeUserById(db: DatabaseSync, userId: string): SafeUser | undefined {
  return db
    .prepare(`SELECT ${SAFE_USER_COLUMNS} FROM users u WHERE u.id = ?`)
    .get(userId) as unknown as SafeUser | undefined;
}

export function createAuthRouter(
  db: DatabaseSync,
  config: AppConfig,
  requireAuth: (req: AuthenticatedRequest, res: Response, next: () => void) => void
): Router {
  const router = Router();

  router.post('/register', (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const fullName = String(req.body?.full_name || '').trim();
    const university = String(req.body?.university || '').trim();
    const major = String(req.body?.major || '').trim();
    const academicYear = String(req.body?.academic_year || '').trim();

    if (!isValidEmail(email)) {
      res.status(400).json({ error: 'Please enter a valid academic or personal email address.' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters long.' });
      return;
    }
    if (fullName.length < 2) {
      res.status(400).json({ error: 'Please enter your full name.' });
      return;
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const userId = generateId();
    const now = new Date().toISOString();
    const passwordHash = hashPassword(password);

    // Public registration strictly creates 'student' accounts; role cannot be supplied by client.
    db.prepare(
      `INSERT INTO users (
        id, email, password_hash, role, status, status_reason, full_name, university, major,
        academic_year, bio, theme_preference, workspace_accent, storage_quota_bytes, is_demo,
        last_login_at, login_count, created_at, updated_at
      ) VALUES (?, ?, ?, 'student', 'active', '', ?, ?, ?, ?, '', 'system', 'purple', ?, 0, ?, 1, ?, ?)`
    ).run(
      userId,
      email,
      passwordHash,
      fullName,
      university,
      major,
      academicYear,
      config.defaultStorageQuotaBytes,
      now,
      now,
      now
    );

    seedStarterWorkspaceForNewUser(db, userId);

    const { rawToken, expiresAt } = createSessionForUser(
      db,
      config,
      userId,
      String(req.headers['user-agent'] || ''),
      req.ip || ''
    );
    setSessionCookie(res, config, rawToken, expiresAt);

    const user = getSafeUserById(db, userId);
    res.status(201).json({ user });
  });

  router.post('/login', (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const row = db
      .prepare('SELECT id, password_hash, status, status_reason FROM users WHERE email = ?')
      .get(email) as
      | { id: string; password_hash: string; status: string; status_reason: string }
      | undefined;

    if (!row || !verifyPassword(password, row.password_hash)) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    if (row.status !== 'active') {
      res.status(403).json({
        error:
          row.status === 'suspended'
            ? `This account has been suspended.${row.status_reason ? ` Reason: ${row.status_reason}` : ''}`
            : `This account is currently deactivated.${row.status_reason ? ` Reason: ${row.status_reason}` : ''}`,
        accountStatus: row.status,
        statusReason: row.status_reason,
      });
      return;
    }

    const now = new Date().toISOString();
    db.prepare('UPDATE users SET last_login_at = ?, login_count = login_count + 1, updated_at = ? WHERE id = ?').run(
      now,
      now,
      row.id
    );

    const { rawToken, expiresAt } = createSessionForUser(
      db,
      config,
      row.id,
      String(req.headers['user-agent'] || ''),
      req.ip || ''
    );
    setSessionCookie(res, config, rawToken, expiresAt);

    const user = getSafeUserById(db, row.id);
    res.json({ user });
  });

  router.post('/demo', (req, res) => {
    const userId = ensureDemoUser(db);
    const demoRow = db.prepare('SELECT status FROM users WHERE id = ?').get(userId) as { status: string };
    if (demoRow.status !== 'active') {
      db.prepare("UPDATE users SET status = 'active', status_reason = '' WHERE id = ?").run(userId);
    }

    const now = new Date().toISOString();
    db.prepare('UPDATE users SET last_login_at = ?, login_count = login_count + 1 WHERE id = ?').run(now, userId);

    const { rawToken, expiresAt } = createSessionForUser(
      db,
      config,
      userId,
      String(req.headers['user-agent'] || ''),
      req.ip || ''
    );
    setSessionCookie(res, config, rawToken, expiresAt);

    const user = getSafeUserById(db, userId);
    res.json({ user });
  });

  router.post('/demo-admin', (req, res) => {
    const adminId = ensureAdminUser(db);
    const now = new Date().toISOString();
    db.prepare('UPDATE users SET last_login_at = ?, login_count = login_count + 1 WHERE id = ?').run(now, adminId);

    const { rawToken, expiresAt } = createSessionForUser(
      db,
      config,
      adminId,
      String(req.headers['user-agent'] || ''),
      req.ip || ''
    );
    setSessionCookie(res, config, rawToken, expiresAt);

    const user = getSafeUserById(db, adminId);
    res.json({ user });
  });

  // Allows locked/deactivated/suspended users to submit an account appeal after verifying credentials
  router.post('/appeal', (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const subject = String(req.body?.subject || '').trim() || 'Account Status Review Request';
    const message = String(req.body?.message || '').trim();

    if (!email || !password || message.length < 5) {
      res.status(400).json({ error: 'Valid credentials and a brief explanation message are required.' });
      return;
    }

    const row = db
      .prepare('SELECT id, password_hash FROM users WHERE email = ?')
      .get(email) as { id: string; password_hash: string } | undefined;

    if (!row || !verifyPassword(password, row.password_hash)) {
      res.status(401).json({ error: 'Credentials could not be verified.' });
      return;
    }

    const id = generateId();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO account_concerns (id, user_id, email, subject, category, message, status, admin_note, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'account_access', ?, 'open', '', ?, ?)`
    ).run(id, row.id, email, subject.slice(0, 120), message.slice(0, 1500), now, now);

    res.status(201).json({ ok: true, id });
  });

  router.post('/logout', requireAuth, (req: AuthenticatedRequest, res) => {
    if (req.sessionId) {
      db.prepare('DELETE FROM sessions WHERE id = ?').run(req.sessionId);
    }
    clearSessionCookie(res, config);
    res.json({ ok: true });
  });

  router.post('/logout-all', requireAuth, (req: AuthenticatedRequest, res) => {
    if (req.user) {
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(req.user.id);
    }
    clearSessionCookie(res, config);
    res.json({ ok: true });
  });

  router.get('/me', requireAuth, (req: AuthenticatedRequest, res) => {
    const usedRow = db
      .prepare('SELECT COALESCE(SUM(size_bytes), 0) as used FROM attachments WHERE user_id = ?')
      .get(req.user!.id) as { used: number };
    res.json({
      user: req.user,
      storageUsedBytes: Number(usedRow?.used || 0),
    });
  });

  return router;
}
