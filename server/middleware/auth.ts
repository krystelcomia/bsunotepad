import { NextFunction, Response } from 'express';
import { DatabaseSync } from 'node:sqlite';
import { AppConfig } from '../config.js';
import { AuthenticatedRequest, SafeUser, UserRole } from '../types.js';
import { generateId, generateToken, hashToken } from '../utils/crypto.js';

export const SAFE_USER_COLUMNS = `
  u.id, u.email, u.role, u.status, u.status_reason, u.full_name, u.university,
  u.major, u.academic_year, u.bio, u.avatar_file, u.theme_preference, u.workspace_accent,
  u.storage_quota_bytes, u.is_demo, u.last_login_at, u.login_count, u.created_at, u.updated_at
`;

export function createSessionForUser(
  db: DatabaseSync,
  config: AppConfig,
  userId: string,
  userAgent: string,
  ipAddress: string
): { rawToken: string; sessionId: string; expiresAt: string } {
  const sessionId = generateId();
  const rawToken = generateToken(32);
  const tokenHash = hashToken(rawToken);
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + config.sessionTtlMs).toISOString();

  db.prepare(
    `INSERT INTO sessions (id, user_id, token_hash, user_agent, ip_address, expires_at, created_at, last_active_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(sessionId, userId, tokenHash, (userAgent || '').slice(0, 240), ipAddress || '', expiresAt, now, now);

  return { rawToken, sessionId, expiresAt };
}

export function setSessionCookie(res: Response, config: AppConfig, rawToken: string, expiresAt: string): void {
  res.cookie(config.sessionCookieName, rawToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProduction && process.env.INKORA_ALLOW_INSECURE_COOKIE !== '1',
    expires: new Date(expiresAt),
    path: '/',
  });
}

export function clearSessionCookie(res: Response, config: AppConfig): void {
  res.clearCookie(config.sessionCookieName, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });
}

export function extractTokenFromRequest(req: AuthenticatedRequest, config: AppConfig): string | null {
  const cookieToken = req.cookies?.[config.sessionCookieName];
  if (typeof cookieToken === 'string' && cookieToken.length > 0) {
    return cookieToken;
  }
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }
  return null;
}

export function createAuthMiddleware(db: DatabaseSync, config: AppConfig) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const rawToken = extractTokenFromRequest(req, config);
    if (!rawToken) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const tokenHash = hashToken(rawToken);
    const row = db
      .prepare(
        `SELECT s.id as session_id, s.expires_at, ${SAFE_USER_COLUMNS}
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = ?`
      )
      .get(tokenHash) as (SafeUser & { session_id: string; expires_at: string }) | undefined;

    if (!row) {
      clearSessionCookie(res, config);
      res.status(401).json({ error: 'Invalid or expired session' });
      return;
    }

    if (new Date(row.expires_at).getTime() <= Date.now()) {
      db.prepare('DELETE FROM sessions WHERE id = ?').run(row.session_id);
      clearSessionCookie(res, config);
      res.status(401).json({ error: 'Session expired' });
      return;
    }

    if (row.status !== 'active') {
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(row.id);
      clearSessionCookie(res, config);
      res.status(403).json({
        error:
          row.status === 'suspended'
            ? `Your account has been suspended.${row.status_reason ? ` Reason: ${row.status_reason}` : ''}`
            : `Your account is currently deactivated.${row.status_reason ? ` Reason: ${row.status_reason}` : ''}`,
        accountStatus: row.status,
      });
      return;
    }

    const now = new Date().toISOString();
    db.prepare('UPDATE sessions SET last_active_at = ? WHERE id = ?').run(now, row.session_id);

    const { session_id, expires_at: _expires, ...safeUser } = row;
    req.user = safeUser;
    req.sessionId = session_id;
    next();
  };
}

export function requireRole(allowedRole: UserRole) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (req.user.role !== allowedRole) {
      res.status(403).json({
        error:
          allowedRole === 'admin'
            ? 'Administrator privileges required.'
            : 'This workspace resource is restricted to student accounts.',
      });
      return;
    }
    next();
  };
}
