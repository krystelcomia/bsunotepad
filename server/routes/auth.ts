import { Router, Response } from 'express';
import { DatabaseSync } from 'node:sqlite';
import { AppConfig } from '../config.js';
import { ensureDemoUser, seedStarterWorkspaceForNewUser } from '../db/seed.js';
import {
  clearSessionCookie,
  createSessionForUser,
  setSessionCookie,
} from '../middleware/auth.js';
import { AuthenticatedRequest, SafeUser } from '../types.js';
import { generateId, hashPassword, verifyPassword } from '../utils/crypto.js';

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getSafeUserById(db: DatabaseSync, userId: string): SafeUser | undefined {
  return db
    .prepare(
      `SELECT id, email, full_name, university, major, academic_year, bio, avatar_file,
              theme_preference, storage_quota_bytes, is_demo, created_at, updated_at
       FROM users WHERE id = ?`
    )
    .get(userId) as SafeUser | undefined;
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

    db.prepare(
      `INSERT INTO users (
        id, email, password_hash, full_name, university, major, academic_year,
        bio, theme_preference, storage_quota_bytes, is_demo, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, '', 'system', ?, 0, ?, ?)`
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
      .prepare('SELECT id, password_hash FROM users WHERE email = ?')
      .get(email) as { id: string; password_hash: string } | undefined;

    if (!row || !verifyPassword(password, row.password_hash)) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

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
