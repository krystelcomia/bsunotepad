import { NextFunction, Response } from 'express';
import { DatabaseSync } from 'node:sqlite';
import { AppConfig } from '../config.js';
import { AuthenticatedRequest, SafeUser, UserRole } from '../types.js';
import { generateId, generateToken, hashToken } from '../utils/crypto.js';

export const SAFE_USER_COLUMNS = `
  u.id, u.email, u.email_verified, u.role, u.status, u.status_reason, u.full_name, u.university,
  u.major, u.academic_year, u.bio, u.avatar_file, u.theme_preference, u.workspace_accent,
  u.storage_quota_bytes, u.is_demo, u.last_login_at, u.login_count, u.created_at, u.updated_at
`;

export function createSessionForUser(
  db: DatabaseSync,
  config: AppConfig,
  userId: string,
  userAgent: string,
  ipAddress: string
): {
  rawToken: string;
  rawRefreshToken: string;
  sessionId: string;
  expiresAt: string;
  refreshExpiresAt: string;
} {
  const sessionId = generateId();
  const rawToken = generateToken(32);
  const rawRefreshToken = generateToken(32);
  const tokenHash = hashToken(rawToken);
  const refreshHash = hashToken(rawRefreshToken);
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + config.sessionTtlMs).toISOString();
  const refreshExpiresAt = new Date(Date.now() + config.refreshTtlMs).toISOString();

  db.prepare(
    `INSERT INTO sessions (
      id, user_id, token_hash, refresh_token_hash, user_agent, ip_address,
      expires_at, refresh_expires_at, created_at, last_active_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    sessionId,
    userId,
    tokenHash,
    refreshHash,
    (userAgent || '').slice(0, 240),
    ipAddress || '',
    expiresAt,
    refreshExpiresAt,
    now,
    now
  );

  return { rawToken, rawRefreshToken, sessionId, expiresAt, refreshExpiresAt };
}

export function setSessionCookies(
  res: Response,
  config: AppConfig,
  tokens: {
    rawToken: string;
    rawRefreshToken: string;
    expiresAt: string;
    refreshExpiresAt: string;
  }
): void {
  const secureFlag = config.isProduction && process.env.INKORA_ALLOW_INSECURE_COOKIE !== '1';
  res.cookie(config.sessionCookieName, tokens.rawToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: secureFlag,
    expires: new Date(tokens.expiresAt),
    path: '/',
  });
  res.cookie(config.refreshCookieName, tokens.rawRefreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: secureFlag,
    expires: new Date(tokens.refreshExpiresAt),
    path: '/api/auth',
  });
}

export function clearSessionCookies(res: Response, config: AppConfig): void {
  const secureFlag = config.isProduction && process.env.INKORA_ALLOW_INSECURE_COOKIE !== '1';
  res.clearCookie(config.sessionCookieName, {
    httpOnly: true,
    sameSite: 'lax',
    secure: secureFlag,
    path: '/',
  });
  res.clearCookie(config.refreshCookieName, {
    httpOnly: true,
    sameSite: 'lax',
    secure: secureFlag,
    path: '/api/auth',
  });
}

export function rotateRefreshSession(
  db: DatabaseSync,
  config: AppConfig,
  rawRefreshToken: string
):
  | {
      ok: true;
      user: SafeUser;
      tokens: {
        rawToken: string;
        rawRefreshToken: string;
        expiresAt: string;
        refreshExpiresAt: string;
      };
    }
  | { ok: false; status: number; error: string; accountStatus?: string; emailVerificationRequired?: boolean } {
  const refreshHash = hashToken(rawRefreshToken);
  const row = db
    .prepare(
      `SELECT s.id as session_id, s.refresh_expires_at, ${SAFE_USER_COLUMNS}
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.refresh_token_hash = ?`
    )
    .get(refreshHash) as (SafeUser & { session_id: string; refresh_expires_at: string | null }) | undefined;

  if (!row || !row.refresh_expires_at || new Date(row.refresh_expires_at).getTime() <= Date.now()) {
    if (row?.session_id) {
      db.prepare('DELETE FROM sessions WHERE id = ?').run(row.session_id);
    }
    return { ok: false, status: 401, error: 'Nag-expire na ang refresh session. Mangyaring mag-sign in muli.' };
  }

  if (row.status !== 'active') {
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(row.id);
    const statusLabel = row.status === 'suspended' ? 'suspendido' : row.status === 'deactivated' ? 'hindi aktibo (deactivated)' : row.status;
    return {
      ok: false,
      status: 403,
      error: `Ang iyong account ay ${statusLabel}.${row.status_reason ? ` Dahilan: ${row.status_reason}` : ''}`,
      accountStatus: row.status,
    };
  }

  if (row.role === 'student' && row.email_verified !== 1) {
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(row.id);
    return {
      ok: false,
      status: 403,
      error: 'Mangyaring beripikahin muna ang iyong Gmail address bago buksan ang iyong workspace.',
      emailVerificationRequired: true,
    };
  }

  const nextToken = generateToken(32);
  const nextRefresh = generateToken(32);
  const expiresAt = new Date(Date.now() + config.sessionTtlMs).toISOString();
  const refreshExpiresAt = new Date(Date.now() + config.refreshTtlMs).toISOString();
  const now = new Date().toISOString();

  db.prepare(
    `UPDATE sessions
     SET token_hash = ?, refresh_token_hash = ?, expires_at = ?, refresh_expires_at = ?, last_active_at = ?
     WHERE id = ?`
  ).run(hashToken(nextToken), hashToken(nextRefresh), expiresAt, refreshExpiresAt, now, row.session_id);

  const { session_id: _sid, refresh_expires_at: _rex, ...safeUser } = row;
  return {
    ok: true,
    user: safeUser,
    tokens: {
      rawToken: nextToken,
      rawRefreshToken: nextRefresh,
      expiresAt,
      refreshExpiresAt,
    },
  };
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
      res.status(401).json({ error: 'Kinakailangan ang pagpapatunay (authentication).' });
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
      clearSessionCookies(res, config);
      res.status(401).json({ error: 'Hindi wasto o nag-expire na ang session.' });
      return;
    }

    if (new Date(row.expires_at).getTime() <= Date.now()) {
      res.status(401).json({ error: 'Nag-expire na ang session.', sessionExpired: true });
      return;
    }

    if (row.status !== 'active') {
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(row.id);
      clearSessionCookies(res, config);
      res.status(403).json({
        error:
          row.status === 'suspended'
            ? `Sinuspinde ang iyong account.${row.status_reason ? ` Dahilan: ${row.status_reason}` : ''}`
            : `Kasalukuyang naka-deactivate ang iyong account.${row.status_reason ? ` Dahilan: ${row.status_reason}` : ''}`,
        accountStatus: row.status,
      });
      return;
    }

    if (row.role === 'student' && row.email_verified !== 1) {
      clearSessionCookies(res, config);
      res.status(403).json({
        error: 'Kinakailangan ang pagberipika ng Gmail bago pumasok sa workspace ng mag-aaral.',
        emailVerificationRequired: true,
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
      res.status(401).json({ error: 'Kinakailangan ang pagpapatunay (authentication).' });
      return;
    }
    if (req.user.role !== allowedRole) {
      res.status(403).json({
        error:
          allowedRole === 'admin'
            ? 'Kinakailangan ang mga pribilehiyo ng Administrator.'
            : 'Ang bahaging ito ng workspace ay nakalaan lamang sa mga account ng mag-aaral.',
      });
      return;
    }
    next();
  };
}
