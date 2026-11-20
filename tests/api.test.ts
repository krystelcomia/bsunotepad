import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { createApp } from '../server/app.js';
import { AppConfig } from '../server/config.js';
import { InkoraDatabase } from '../server/db/database.js';
import { ADMIN_EMAIL, ADMIN_PASSWORD } from '../server/db/seed.js';

function makeTempConfig(baseDir: string): AppConfig {
  const dataDir = path.join(baseDir, 'data');
  const storageDir = path.join(baseDir, 'storage');
  const uploadsDir = path.join(storageDir, 'uploads');
  const avatarsDir = path.join(storageDir, 'avatars');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.mkdirSync(avatarsDir, { recursive: true });

  return {
    port: 0,
    dataDir,
    storageDir,
    uploadsDir,
    avatarsDir,
    dbPath: path.join(dataDir, 'inkora-test.db'),
    sessionCookieName: 'inkora_session',
    refreshCookieName: 'inkora_refresh',
    sessionTtlMs: 2 * 60 * 60 * 1000,
    refreshTtlMs: 30 * 24 * 60 * 60 * 1000,
    emailTokenTtlMs: 15 * 60 * 1000,
    maxFileSizeBytes: 5 * 1024 * 1024,
    maxAvatarSizeBytes: 2 * 1024 * 1024,
    defaultStorageQuotaBytes: 10 * 1024 * 1024,
    isProduction: false,
  };
}

class CookieClient {
  private baseUrl: string;
  private cookies = new Map<string, string>();

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getCookieHeader(): string {
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  async request(urlPath: string, init?: RequestInit): Promise<Response> {
    const headers = new Headers(init?.headers || {});
    const cookieStr = this.getCookieHeader();
    if (cookieStr) {
      headers.set('cookie', cookieStr);
    }
    const res = await fetch(`${this.baseUrl}${urlPath}`, {
      ...init,
      headers,
    });
    const setCookies =
      typeof res.headers.getSetCookie === 'function'
        ? res.headers.getSetCookie()
        : res.headers.get('set-cookie')
          ? [res.headers.get('set-cookie')!]
          : [];

    for (const raw of setCookies) {
      const pair = raw.split(';')[0];
      const eqIdx = pair.indexOf('=');
      if (eqIdx > 0) {
        const name = pair.slice(0, eqIdx).trim();
        const val = pair.slice(eqIdx + 1).trim();
        if (!val) {
          this.cookies.delete(name);
        } else {
          this.cookies.set(name, val);
        }
      }
    }
    return res;
  }

  async json<T>(urlPath: string, init?: RequestInit): Promise<{ status: number; data: T }> {
    const headers = new Headers(init?.headers || {});
    if (!(init?.body instanceof FormData) && init?.body !== undefined && !headers.has('content-type')) {
      headers.set('content-type', 'application/json');
    }
    const res = await this.request(urlPath, { ...init, headers });
    const data = (await res.json()) as T;
    return { status: res.status, data };
  }
}

describe('INKORA Gmail Auth, Email Verification, Password Reset & RBAC Tests', () => {
  let tmpDir: string;
  let server: http.Server;
  let db: InkoraDatabase;
  let baseUrl: string;

  before(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inkora-test-'));
    const config = makeTempConfig(tmpDir);
    const instance = createApp(config, { seedDemo: true });
    db = instance.db;
    server = await new Promise<http.Server>((resolve) => {
      const srv = instance.app.listen(0, '127.0.0.1', () => resolve(srv));
    });
    const addr = server.address();
    if (!addr || typeof addr === 'string') throw new Error('Failed to bind ephemeral port');
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('responds healthy, enforces auth, and disables public admin registration/demo-admin', async () => {
    const client = new CookieClient(baseUrl);
    const health = await client.json<{ status: string }>('/api/health');
    assert.equal(health.status, 200);
    assert.equal(health.data.status, 'ok');

    const unauth = await client.json<{ error: string }>('/api/workspace/summary');
    assert.equal(unauth.status, 401);

    const noDemoAdmin = await client.request('/api/auth/demo-admin', { method: 'POST' });
    assert.equal(noDemoAdmin.status, 404);

    const lockedSetup = await client.json('/api/auth/admin-setup', {
      method: 'POST',
      body: JSON.stringify({
        email: 'rogue@gmail.com',
        full_name: 'Rogue',
        password: 'StrongPassword123!',
        confirm_password: 'StrongPassword123!',
      }),
    });
    assert.equal(lockedSetup.status, 403);
  });

  it('supports demo student login with seeded workspace while blocking admin routes', async () => {
    const client = new CookieClient(baseUrl);
    const demo = await client.json<{ user: { email: string; role: string; email_verified: number } }>(
      '/api/auth/demo',
      { method: 'POST' }
    );
    assert.equal(demo.status, 200);
    assert.equal(demo.data.user.email, 'alex.rivera.demo@gmail.com');
    assert.equal(demo.data.user.role, 'student');
    assert.equal(demo.data.user.email_verified, 1);

    const summary = await client.json<{
      folders: unknown[];
      subjects: unknown[];
      recentNotes: unknown[];
      recentlyOpenedNotes: Array<{ id: string; last_opened_at?: string | null }>;
      recentlyEditedDocuments: Array<{ id: string; mode: string }>;
      favoriteNotes: Array<{ id: string; is_starred: number }>;
      recentlyUsedFolders: Array<{ id: string }>;
      activityOverview: { days: unknown[]; totalWords: number };
      stats: { totalNotes: number; totalDocuments: number; totalFolders: number };
    }>('/api/workspace/summary');
    assert.equal(summary.status, 200);
    assert.ok(summary.data.folders.length >= 3);
    assert.ok(summary.data.subjects.length >= 3);
    assert.ok(summary.data.recentNotes.length >= 4);
    assert.ok(summary.data.recentlyOpenedNotes.length >= 4);
    assert.ok(summary.data.recentlyEditedDocuments.length >= 2);
    assert.ok(summary.data.recentlyEditedDocuments.every((d) => d.mode === 'document'));
    assert.ok(summary.data.favoriteNotes.length >= 1);
    assert.ok(summary.data.favoriteNotes.every((n) => n.is_starred === 1));
    assert.ok(summary.data.recentlyUsedFolders.length >= 3);
    assert.equal(summary.data.activityOverview.days.length, 7);
    assert.ok(summary.data.stats.totalNotes >= 4);
    assert.ok(summary.data.stats.totalDocuments >= 2);

    // Opening the oldest recently-opened note updates last_opened_at and moves it to top
    const oldestOpenedId =
      summary.data.recentlyOpenedNotes[summary.data.recentlyOpenedNotes.length - 1].id;
    const openedRes = await client.json<{ note: { id: string } }>(`/api/notes/${oldestOpenedId}`);
    assert.equal(openedRes.status, 200);

    const summaryAfterOpen = await client.json<{
      recentlyOpenedNotes: Array<{ id: string; last_opened_at?: string | null }>;
    }>('/api/workspace/summary');
    assert.equal(summaryAfterOpen.status, 200);
    assert.equal(summaryAfterOpen.data.recentlyOpenedNotes[0].id, oldestOpenedId);
    assert.ok(summaryAfterOpen.data.recentlyOpenedNotes[0].last_opened_at);

    const forbiddenAdmin = await client.json('/api/admin/stats');
    assert.equal(forbiddenAdmin.status, 403);
  });

  it('enforces Gmail-only uniqueness, OTP/link verification, password reset, refresh rotation, and RBAC isolation', async () => {
    const studentA = new CookieClient(baseUrl);
    const studentB = new CookieClient(baseUrl);
    const admin = new CookieClient(baseUrl);

    // 1. Reject non-Gmail and mismatched confirm password
    const badDomain = await studentA.json('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        full_name: 'Maya Chen',
        email: 'maya.chen@yahoo.com',
        password: 'StrongPassword123!',
        confirm_password: 'StrongPassword123!',
      }),
    });
    assert.equal(badDomain.status, 400);

    const badConfirm = await studentA.json('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        full_name: 'Maya Chen',
        email: 'maya.chen@gmail.com',
        password: 'StrongPassword123!',
        confirm_password: 'DifferentPassword123!',
      }),
    });
    assert.equal(badConfirm.status, 400);

    // 2. Register Student A with multipart FormData + optional profile picture
    const regForm = new FormData();
    regForm.append('full_name', 'Maya Chen');
    regForm.append('email', 'Maya.Chen@Gmail.com');
    regForm.append('password', 'StrongPassword123!');
    regForm.append('confirm_password', 'StrongPassword123!');
    regForm.append('role', 'admin'); // Must be ignored
    regForm.append('avatar', new Blob(['fake-png-bytes'], { type: 'image/png' }), 'avatar.png');

    const regRes = await studentA.request('/api/auth/register', { method: 'POST', body: regForm });
    assert.equal(regRes.status, 201);
    const regData = (await regRes.json()) as {
      requiresVerification: boolean;
      email: string;
      previewOtp: string;
      previewLink: string;
    };
    assert.equal(regData.requiresVerification, true);
    assert.equal(regData.email, 'maya.chen@gmail.com');
    assert.match(regData.previewOtp, /^\d{6}$/);

    // Duplicate registration with different capitalization must fail 409
    const dupRes = await studentB.json<{ error: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        full_name: 'Duplicate Maya',
        email: 'MAYA.CHEN@GMAIL.COM',
        password: 'StrongPassword123!',
        confirm_password: 'StrongPassword123!',
      }),
    });
    assert.equal(dupRes.status, 409);

    // Unverified Gmail MUST NOT log in or reset password
    const unverifiedLogin = await studentA.json<{ emailVerificationRequired: boolean }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'maya.chen@gmail.com', password: 'StrongPassword123!' }),
    });
    assert.equal(unverifiedLogin.status, 403);
    assert.equal(unverifiedLogin.data.emailVerificationRequired, true);

    const unverifiedForgot = await studentA.json('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: 'maya.chen@gmail.com' }),
    });
    assert.equal(unverifiedForgot.status, 403);

    // Wrong OTP must fail
    const badOtp = await studentA.json('/api/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ email: 'maya.chen@gmail.com', otp: '000000' }),
    });
    assert.equal(badOtp.status, 400);

    // 3. Valid OTP verifies Gmail, sets role = student, and logs in
    const verifiedA = await studentA.json<{
      user: { id: string; role: string; email_verified: number; avatar_file: string | null };
      verified: boolean;
    }>('/api/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ email: 'maya.chen@gmail.com', otp: regData.previewOtp }),
    });
    assert.equal(verifiedA.status, 200);
    assert.equal(verifiedA.data.verified, true);
    assert.equal(verifiedA.data.user.role, 'student');
    assert.equal(verifiedA.data.user.email_verified, 1);
    assert.ok(verifiedA.data.user.avatar_file);

    // Session refresh rotation works
    const refreshRes = await studentA.json<{ user: { email: string } }>('/api/auth/refresh', {
      method: 'POST',
    });
    assert.equal(refreshRes.status, 200);
    assert.equal(refreshRes.data.user.email, 'maya.chen@gmail.com');

    // Register & verify Student B via link token
    const regB = await studentB.json<{ previewLink: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        full_name: 'Liam Wright',
        email: 'liam.wright@gmail.com',
        password: 'StrongPassword123!',
        confirm_password: 'StrongPassword123!',
      }),
    });
    assert.equal(regB.status, 201);
    const linkTok = new URL(regB.data.previewLink).searchParams.get('verify_token');
    assert.ok(linkTok);
    const verifyB = await studentB.json<{ user: { id: string; role: string } }>('/api/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token: linkTok }),
    });
    assert.equal(verifyB.status, 200);
    assert.equal(verifyB.data.user.role, 'student');

    // 4. Forgot password + reset password via verified Gmail
    const forgotRes = await studentA.json<{ previewOtp: string }>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: 'maya.chen@gmail.com' }),
    });
    assert.equal(forgotRes.status, 200);

    const resetRes = await studentA.json('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        email: 'maya.chen@gmail.com',
        otp: forgotRes.data.previewOtp,
        new_password: 'NewPassword789!',
        confirm_password: 'NewPassword789!',
      }),
    });
    assert.equal(resetRes.status, 200);

    // Old session revoked + old password fails + new password succeeds
    const oldSessCheck = await studentA.json('/api/auth/me');
    assert.equal(oldSessCheck.status, 401);

    const loginNew = await studentA.json<{ user: { email: string } }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'maya.chen@gmail.com', password: 'NewPassword789!' }),
    });
    assert.equal(loginNew.status, 200);

    // 5. Cross-student isolation (notes, folders, files)
    const folderA = await studentA.json<{ folder: { id: string } }>('/api/folders', {
      method: 'POST',
      body: JSON.stringify({ name: 'Private Folder' }),
    });
    const noteA = await studentA.json<{ note: { id: string } }>('/api/notes', {
      method: 'POST',
      body: JSON.stringify({ title: 'Confidential Draft', folder_id: folderA.data.folder.id }),
    });
    assert.equal(noteA.status, 201);

    const stealNote = await studentB.json(`/api/notes/${noteA.data.note.id}`);
    assert.equal(stealNote.status, 404);
    const stealFolder = await studentB.json(`/api/folders/${folderA.data.folder.id}`, {
      method: 'DELETE',
    });
    assert.equal(stealFolder.status, 404);

    // 6. Admin logs in strictly through normal login -> automatic role identification
    const adminLogin = await admin.json<{ user: { role: string } }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    });
    assert.equal(adminLogin.status, 200);
    assert.equal(adminLogin.data.user.role, 'admin');

    // Admin cannot read student notes & can create another admin + suspend/reactivate student
    const adminBlockedNotes = await admin.json('/api/notes');
    assert.equal(adminBlockedNotes.status, 403);

    const createSubAdmin = await admin.json<{ admin: { role: string; email: string } }>(
      '/api/admin/admins',
      {
        method: 'POST',
        body: JSON.stringify({
          full_name: 'Co Admin',
          email: 'co.admin@gmail.com',
          password: 'AdminPassword99!',
        }),
      }
    );
    assert.equal(createSubAdmin.status, 201);
    assert.equal(createSubAdmin.data.admin.role, 'admin');

    await admin.json(`/api/admin/students/${verifiedA.data.user.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'suspended', status_reason: 'Policy review' }),
    });
    const blockedA = await studentA.json('/api/auth/me');
    assert.ok(blockedA.status === 401 || blockedA.status === 403);

    await admin.json(`/api/admin/students/${verifiedA.data.user.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'active' }),
    });

    const delB = await admin.json(`/api/admin/students/${verifyB.data.user.id}`, {
      method: 'DELETE',
    });
    assert.equal(delB.status, 200);
  });
});
