import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { NextFunction, Request, Response, Router } from 'express';
import { DatabaseSync } from 'node:sqlite';
import { AppConfig } from '../config.js';
import { ensureDemoUser, seedStarterWorkspaceForNewUser } from '../db/seed.js';
import {
  clearSessionCookies,
  createSessionForUser,
  rotateRefreshSession,
  SAFE_USER_COLUMNS,
  setSessionCookies,
} from '../middleware/auth.js';
import { createAvatarUploader } from '../middleware/upload.js';
import { AuthenticatedRequest, SafeUser } from '../types.js';
import { generateId, generateToken, hashPassword, hashToken, verifyPassword } from '../utils/crypto.js';
import { isValidGmailAddress, normalizeGmail, validatePasswordStrength } from '../utils/gmail.js';
import { sendPasswordResetEmail, sendVerificationEmail } from '../utils/mailer.js';

function getSafeUserById(db: DatabaseSync, userId: string): SafeUser | undefined {
  return db
    .prepare(`SELECT ${SAFE_USER_COLUMNS} FROM users u WHERE u.id = ?`)
    .get(userId) as unknown as SafeUser | undefined;
}

function getRequestOrigin(req: Request): string {
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:5173';
  return `${String(proto).split(',')[0]}://${String(host).split(',')[0]}`;
}

function issueEmailToken(
  db: DatabaseSync,
  config: AppConfig,
  userId: string,
  email: string,
  purpose: 'verify_email' | 'reset_password'
): { otp: string; linkToken: string } {
  // Invalidate prior unused tokens for this user + purpose
  db.prepare(
    'UPDATE email_tokens SET used_at = ? WHERE user_id = ? AND purpose = ? AND used_at IS NULL'
  ).run(new Date().toISOString(), userId, purpose);

  const otp = String(crypto.randomInt(100000, 1000000));
  const linkToken = generateToken(32);
  const otpHash = hashToken(`${userId}:${purpose}:${otp}`);
  const linkTokenHash = hashToken(linkToken);
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + config.emailTokenTtlMs).toISOString();

  db.prepare(
    `INSERT INTO email_tokens (id, user_id, email, purpose, otp_hash, link_token_hash, expires_at, attempts, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`
  ).run(generateId(), userId, email, purpose, otpHash, linkTokenHash, expiresAt, now);

  return { otp, linkToken };
}

function verifyEmailTokenRecord(
  db: DatabaseSync,
  params: { purpose: 'verify_email' | 'reset_password'; email?: string; otp?: string; token?: string }
):
  | { ok: true; recordId: string; userId: string; email: string }
  | { ok: false; status: number; error: string } {
  const nowIso = new Date().toISOString();

  if (params.token) {
    const linkHash = hashToken(params.token.trim());
    const row = db
      .prepare(
        `SELECT id, user_id, email, expires_at, used_at
         FROM email_tokens
         WHERE link_token_hash = ? AND purpose = ?`
      )
      .get(linkHash, params.purpose) as
      | { id: string; user_id: string; email: string; expires_at: string; used_at: string | null }
      | undefined;

    if (!row || row.used_at) {
      return { ok: false, status: 400, error: 'Verification link is invalid or has already been used.' };
    }
    if (new Date(row.expires_at).getTime() <= Date.now()) {
      return { ok: false, status: 400, error: 'Verification link has expired. Please request a new one.' };
    }
    return { ok: true, recordId: row.id, userId: row.user_id, email: row.email };
  }

  const email = normalizeGmail(params.email || '');
  const otp = String(params.otp || '').trim();
  if (!isValidGmailAddress(email) || !/^\d{6}$/.test(otp)) {
    return { ok: false, status: 400, error: 'Please enter a valid @gmail.com address and 6-digit code.' };
  }

  const row = db
    .prepare(
      `SELECT id, user_id, email, otp_hash, expires_at, attempts
       FROM email_tokens
       WHERE LOWER(email) = ? AND purpose = ? AND used_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`
    )
    .get(email, params.purpose) as
    | {
        id: string;
        user_id: string;
        email: string;
        otp_hash: string;
        expires_at: string;
        attempts: number;
      }
    | undefined;

  if (!row) {
    return { ok: false, status: 400, error: 'No active code found for this Gmail. Please request a new code.' };
  }

  if (new Date(row.expires_at).getTime() <= Date.now()) {
    db.prepare('UPDATE email_tokens SET used_at = ? WHERE id = ?').run(nowIso, row.id);
    return { ok: false, status: 400, error: 'This 6-digit code has expired. Please request a new one.' };
  }

  if (row.attempts >= 5) {
    db.prepare('UPDATE email_tokens SET used_at = ? WHERE id = ?').run(nowIso, row.id);
    return { ok: false, status: 429, error: 'Too many incorrect code attempts. Please request a new code.' };
  }

  const candidateHash = hashToken(`${row.user_id}:${params.purpose}:${otp}`);
  if (candidateHash !== row.otp_hash) {
    db.prepare('UPDATE email_tokens SET attempts = attempts + 1 WHERE id = ?').run(row.id);
    return { ok: false, status: 400, error: 'Incorrect verification code. Please check and try again.' };
  }

  return { ok: true, recordId: row.id, userId: row.user_id, email: row.email };
}

export function createAuthRouter(
  db: DatabaseSync,
  config: AppConfig,
  requireAuth: (req: AuthenticatedRequest, res: Response, next: () => void) => void
): Router {
  const router = Router();
  const avatarUpload = createAvatarUploader(config);

  const maybeUploadAvatar = (req: Request, res: Response, next: NextFunction) => {
    const contentType = String(req.headers['content-type'] || '');
    if (contentType.includes('multipart/form-data')) {
      avatarUpload.single('avatar')(req, res, (err) => {
        if (err) {
          res.status(400).json({ error: err.message || 'Invalid profile picture upload.' });
          return;
        }
        next();
      });
    } else {
      next();
    }
  };

  router.post('/register', maybeUploadAvatar, async (req, res) => {
    const cleanupUploadedAvatar = () => {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.rmSync(req.file.path, { force: true });
      }
    };

    try {
      const email = normalizeGmail(String(req.body?.email || ''));
      const password = String(req.body?.password || '');
      const confirmPassword = String(req.body?.confirm_password ?? req.body?.confirmPassword ?? '');
      const fullName = String(req.body?.full_name || '').trim();
      const university = String(req.body?.university || '').trim();
      const major = String(req.body?.major || '').trim();
      const academicYear = String(req.body?.academic_year || '').trim();

      if (fullName.length < 2) {
        cleanupUploadedAvatar();
        res.status(400).json({ error: 'Please enter your full name (at least 2 characters).' });
        return;
      }

      if (!isValidGmailAddress(email)) {
        cleanupUploadedAvatar();
        res.status(400).json({
          error: 'Only valid Gmail addresses ending in @gmail.com are accepted for registration.',
        });
        return;
      }

      const pwError = validatePasswordStrength(password);
      if (pwError) {
        cleanupUploadedAvatar();
        res.status(400).json({ error: pwError });
        return;
      }

      if (password !== confirmPassword) {
        cleanupUploadedAvatar();
        res.status(400).json({ error: 'Password and Confirm Password do not match.' });
        return;
      }

      const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(email);
      if (existing) {
        cleanupUploadedAvatar();
        res.status(409).json({
          error: 'This Gmail address is already registered. Each Gmail address can only register one account.',
        });
        return;
      }

      const userId = generateId();
      const now = new Date().toISOString();
      const passwordHash = hashPassword(password);

      let avatarFile: string | null = null;
      if (req.file) {
        const userAvatarDir = path.join(config.avatarsDir, userId);
        fs.mkdirSync(userAvatarDir, { recursive: true });
        const destPath = path.join(userAvatarDir, req.file.filename);
        fs.renameSync(req.file.path, destPath);
        avatarFile = req.file.filename;
      }

      // Public registration strictly creates unverified 'student' accounts.
      // Student workspace access remains blocked until Gmail verification completes.
      db.prepare(
        `INSERT INTO users (
          id, email, email_verified, password_hash, role, status, status_reason, full_name,
          university, major, academic_year, bio, avatar_file, theme_preference, workspace_accent,
          storage_quota_bytes, is_demo, last_login_at, login_count, created_at, updated_at
        ) VALUES (?, ?, 0, ?, 'student', 'active', '', ?, ?, ?, ?, '', ?, 'system', 'purple', ?, 0, NULL, 0, ?, ?)`
      ).run(
        userId,
        email,
        passwordHash,
        fullName,
        university,
        major,
        academicYear,
        avatarFile,
        config.defaultStorageQuotaBytes,
        now,
        now
      );

      seedStarterWorkspaceForNewUser(db, userId);

      const { otp, linkToken } = issueEmailToken(db, config, userId, email, 'verify_email');
      const verifyUrl = `${getRequestOrigin(req)}/?verify_token=${encodeURIComponent(linkToken)}`;
      const delivery = await sendVerificationEmail({
        to: email,
        fullName,
        otp,
        verifyUrl,
      });

      res.status(201).json({
        requiresVerification: true,
        email,
        deliveryMode: delivery.deliveryMode,
        previewOtp: delivery.previewOtp,
        previewLink: delivery.previewLink,
        message: 'Account created! Please verify your Gmail address before accessing your student workspace.',
      });
    } catch (err) {
      cleanupUploadedAvatar();
      const message = err instanceof Error ? err.message : 'Registration failed';
      if (message.includes('UNIQUE constraint')) {
        res.status(409).json({
          error: 'This Gmail address is already registered. Each Gmail address can only register one account.',
        });
        return;
      }
      res.status(500).json({ error: message });
    }
  });

  router.post('/verify-email', (req, res) => {
    const check = verifyEmailTokenRecord(db, {
      purpose: 'verify_email',
      email: req.body?.email ? String(req.body.email) : undefined,
      otp: req.body?.otp ? String(req.body.otp) : undefined,
      token: req.body?.token ? String(req.body.token) : undefined,
    });

    if (!check.ok) {
      res.status(check.status).json({ error: check.error });
      return;
    }

    const userRow = db
      .prepare('SELECT id, status, status_reason FROM users WHERE id = ?')
      .get(check.userId) as { id: string; status: string; status_reason: string } | undefined;

    if (!userRow) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }

    if (userRow.status !== 'active') {
      res.status(403).json({
        error: `This account is ${userRow.status}.${userRow.status_reason ? ` Reason: ${userRow.status_reason}` : ''}`,
      });
      return;
    }

    const now = new Date().toISOString();
    db.prepare('UPDATE email_tokens SET used_at = ? WHERE id = ?').run(now, check.recordId);
    db.prepare(
      'UPDATE users SET email_verified = 1, last_login_at = ?, login_count = login_count + 1, updated_at = ? WHERE id = ?'
    ).run(now, now, userRow.id);

    const tokens = createSessionForUser(
      db,
      config,
      userRow.id,
      String(req.headers['user-agent'] || ''),
      req.ip || ''
    );
    setSessionCookies(res, config, tokens);

    const user = getSafeUserById(db, userRow.id);
    res.json({ user, verified: true });
  });

  router.post('/resend-verification', async (req, res) => {
    const email = normalizeGmail(String(req.body?.email || ''));
    if (!isValidGmailAddress(email)) {
      res.status(400).json({ error: 'Please provide a valid @gmail.com address.' });
      return;
    }

    const row = db
      .prepare('SELECT id, full_name, email_verified, status FROM users WHERE LOWER(email) = ?')
      .get(email) as { id: string; full_name: string; email_verified: number; status: string } | undefined;

    if (!row) {
      res.status(404).json({ error: 'No account found for that Gmail address.' });
      return;
    }

    if (row.email_verified === 1) {
      res.status(400).json({ error: 'This Gmail address is already verified. You can sign in.' });
      return;
    }

    if (row.status !== 'active') {
      res.status(403).json({ error: `This account is currently ${row.status}.` });
      return;
    }

    const { otp, linkToken } = issueEmailToken(db, config, row.id, email, 'verify_email');
    const verifyUrl = `${getRequestOrigin(req)}/?verify_token=${encodeURIComponent(linkToken)}`;
    const delivery = await sendVerificationEmail({
      to: email,
      fullName: row.full_name,
      otp,
      verifyUrl,
    });

    res.json({
      ok: true,
      email,
      deliveryMode: delivery.deliveryMode,
      previewOtp: delivery.previewOtp,
      previewLink: delivery.previewLink,
    });
  });

  router.post('/login', (req, res) => {
    const email = normalizeGmail(String(req.body?.email || ''));
    const password = String(req.body?.password || '');

    if (!email || !password) {
      res.status(400).json({ error: 'Gmail address and password are required.' });
      return;
    }

    if (!isValidGmailAddress(email)) {
      res.status(400).json({ error: 'Please sign in using a valid @gmail.com address.' });
      return;
    }

    const row = db
      .prepare('SELECT id, password_hash, role, status, status_reason, email_verified FROM users WHERE LOWER(email) = ?')
      .get(email) as
      | {
          id: string;
          password_hash: string;
          role: string;
          status: string;
          status_reason: string;
          email_verified: number;
        }
      | undefined;

    if (!row || !verifyPassword(password, row.password_hash)) {
      res.status(401).json({ error: 'Invalid Gmail address or password.' });
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

    if (row.role === 'student' && row.email_verified !== 1) {
      res.status(403).json({
        error: 'Your Gmail address is not verified yet. Please verify your email before accessing the student workspace.',
        emailVerificationRequired: true,
        email,
      });
      return;
    }

    const now = new Date().toISOString();
    db.prepare('UPDATE users SET last_login_at = ?, login_count = login_count + 1, updated_at = ? WHERE id = ?').run(
      now,
      now,
      row.id
    );

    const tokens = createSessionForUser(
      db,
      config,
      row.id,
      String(req.headers['user-agent'] || ''),
      req.ip || ''
    );
    setSessionCookies(res, config, tokens);

    const user = getSafeUserById(db, row.id);
    res.json({ user });
  });

  router.post('/refresh', (req, res) => {
    const rawRefresh = req.cookies?.[config.refreshCookieName];
    if (typeof rawRefresh !== 'string' || !rawRefresh) {
      clearSessionCookies(res, config);
      res.status(401).json({ error: 'No refresh session found.' });
      return;
    }

    const result = rotateRefreshSession(db, config, rawRefresh);
    if (!result.ok) {
      clearSessionCookies(res, config);
      res.status(result.status).json({
        error: result.error,
        accountStatus: result.accountStatus,
        emailVerificationRequired: result.emailVerificationRequired,
      });
      return;
    }

    setSessionCookies(res, config, result.tokens);
    res.json({ user: result.user });
  });

  router.post('/forgot-password', async (req, res) => {
    const email = normalizeGmail(String(req.body?.email || ''));
    if (!isValidGmailAddress(email)) {
      res.status(400).json({ error: 'Please enter a valid @gmail.com address.' });
      return;
    }

    const row = db
      .prepare('SELECT id, full_name, email_verified, status FROM users WHERE LOWER(email) = ?')
      .get(email) as { id: string; full_name: string; email_verified: number; status: string } | undefined;

    if (!row) {
      res.status(404).json({ error: 'No account found with that Gmail address.' });
      return;
    }

    if (row.email_verified !== 1) {
      res.status(403).json({
        error: 'Only verified Gmail accounts can reset their password. Please verify your Gmail address first.',
        emailVerificationRequired: true,
      });
      return;
    }

    if (row.status !== 'active') {
      res.status(403).json({
        error: `Password reset is unavailable while this account is ${row.status}. Please submit an account review request.`,
      });
      return;
    }

    const { otp, linkToken } = issueEmailToken(db, config, row.id, email, 'reset_password');
    const resetUrl = `${getRequestOrigin(req)}/?reset_token=${encodeURIComponent(linkToken)}`;
    const delivery = await sendPasswordResetEmail({
      to: email,
      fullName: row.full_name,
      otp,
      resetUrl,
    });

    res.json({
      ok: true,
      email,
      deliveryMode: delivery.deliveryMode,
      previewOtp: delivery.previewOtp,
      previewLink: delivery.previewLink,
    });
  });

  router.post('/reset-password', (req, res) => {
    const newPassword = String(req.body?.new_password ?? req.body?.newPassword ?? '');
    const confirmPassword = String(req.body?.confirm_password ?? req.body?.confirmPassword ?? '');

    const pwError = validatePasswordStrength(newPassword);
    if (pwError) {
      res.status(400).json({ error: pwError });
      return;
    }

    if (newPassword !== confirmPassword) {
      res.status(400).json({ error: 'New password and confirmation do not match.' });
      return;
    }

    const check = verifyEmailTokenRecord(db, {
      purpose: 'reset_password',
      email: req.body?.email ? String(req.body.email) : undefined,
      otp: req.body?.otp ? String(req.body.otp) : undefined,
      token: req.body?.token ? String(req.body.token) : undefined,
    });

    if (!check.ok) {
      res.status(check.status).json({ error: check.error });
      return;
    }

    const userRow = db
      .prepare('SELECT id, email_verified, status FROM users WHERE id = ?')
      .get(check.userId) as { id: string; email_verified: number; status: string } | undefined;

    if (!userRow || userRow.email_verified !== 1) {
      res.status(403).json({ error: 'Only verified Gmail accounts can reset passwords.' });
      return;
    }

    if (userRow.status !== 'active') {
      res.status(403).json({ error: `Account is currently ${userRow.status}.` });
      return;
    }

    const now = new Date().toISOString();
    const newHash = hashPassword(newPassword);

    db.prepare('UPDATE email_tokens SET used_at = ? WHERE id = ?').run(now, check.recordId);
    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(
      newHash,
      now,
      userRow.id
    );
    // Revoke all existing sessions after password reset
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userRow.id);
    clearSessionCookies(res, config);

    res.json({ ok: true, message: 'Password reset successful. Please sign in with your new password.' });
  });

  // Demo Student Workspace preview login (verified demo student only; never admin)
  router.post('/demo', (req, res) => {
    const userId = ensureDemoUser(db);
    db.prepare("UPDATE users SET status = 'active', status_reason = '', email_verified = 1 WHERE id = ?").run(userId);

    const now = new Date().toISOString();
    db.prepare('UPDATE users SET last_login_at = ?, login_count = login_count + 1 WHERE id = ?').run(now, userId);

    const tokens = createSessionForUser(
      db,
      config,
      userId,
      String(req.headers['user-agent'] || ''),
      req.ip || ''
    );
    setSessionCookies(res, config, tokens);

    const user = getSafeUserById(db, userId);
    res.json({ user });
  });

  // Secure initial admin setup (ONLY when no admin exists yet AND setup secret matches if configured)
  router.post('/admin-setup', (req, res) => {
    const adminCountRow = db
      .prepare("SELECT COUNT(*) as c FROM users WHERE role = 'admin'")
      .get() as { c: number };

    if (Number(adminCountRow.c) > 0) {
      res.status(403).json({
        error: 'Administrator account already exists. Additional admins can only be created by an authorized administrator.',
      });
      return;
    }

    const expectedSecret = process.env.INKORA_ADMIN_SETUP_SECRET || '';
    const providedSecret = String(req.body?.setup_secret || '');
    if (!expectedSecret || providedSecret.length !== expectedSecret.length) {
      res.status(403).json({ error: 'Valid initial setup secret is required to initialize the admin account.' });
      return;
    }
    if (!crypto.timingSafeEqual(Buffer.from(providedSecret), Buffer.from(expectedSecret))) {
      res.status(403).json({ error: 'Invalid setup secret.' });
      return;
    }

    const email = normalizeGmail(String(req.body?.email || ''));
    const fullName = String(req.body?.full_name || '').trim();
    const password = String(req.body?.password || '');
    const confirmPassword = String(req.body?.confirm_password ?? '');

    if (!isValidGmailAddress(email)) {
      res.status(400).json({ error: 'Admin account must use a valid @gmail.com address.' });
      return;
    }
    if (fullName.length < 2) {
      res.status(400).json({ error: 'Full name is required.' });
      return;
    }
    const pwErr = validatePasswordStrength(password);
    if (pwErr) {
      res.status(400).json({ error: pwErr });
      return;
    }
    if (password !== confirmPassword) {
      res.status(400).json({ error: 'Passwords do not match.' });
      return;
    }

    const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(email);
    if (existing) {
      res.status(409).json({ error: 'This Gmail address is already registered.' });
      return;
    }

    const adminId = generateId();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO users (
        id, email, email_verified, password_hash, role, status, status_reason, full_name,
        university, major, academic_year, bio, theme_preference, workspace_accent,
        storage_quota_bytes, is_demo, last_login_at, login_count, created_at, updated_at
      ) VALUES (?, ?, 1, ?, 'admin', 'active', '', ?, 'INKORA Administration', 'System Admin', 'Staff', '', 'light', 'purple', ?, 0, ?, 1, ?, ?)`
    ).run(adminId, email, hashPassword(password), fullName, config.defaultStorageQuotaBytes, now, now, now);

    const tokens = createSessionForUser(
      db,
      config,
      adminId,
      String(req.headers['user-agent'] || ''),
      req.ip || ''
    );
    setSessionCookies(res, config, tokens);

    res.status(201).json({ user: getSafeUserById(db, adminId) });
  });

  // Locked/suspended user appeal endpoint (credential-verified)
  router.post('/appeal', (req, res) => {
    const email = normalizeGmail(String(req.body?.email || ''));
    const password = String(req.body?.password || '');
    const subject = String(req.body?.subject || '').trim() || 'Account Status Review Request';
    const message = String(req.body?.message || '').trim();

    if (!isValidGmailAddress(email) || !password || message.length < 5) {
      res.status(400).json({ error: 'Valid Gmail credentials and a brief explanation message are required.' });
      return;
    }

    const row = db
      .prepare('SELECT id, password_hash FROM users WHERE LOWER(email) = ?')
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
    clearSessionCookies(res, config);
    res.json({ ok: true });
  });

  router.post('/logout-all', requireAuth, (req: AuthenticatedRequest, res) => {
    if (req.user) {
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(req.user.id);
    }
    clearSessionCookies(res, config);
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
