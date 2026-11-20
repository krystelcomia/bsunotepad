import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { createApp } from '../server/app.js';
import { AppConfig } from '../server/config.js';
import { InkoraDatabase } from '../server/db/database.js';

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
    sessionTtlMs: 7 * 24 * 60 * 60 * 1000,
    maxFileSizeBytes: 5 * 1024 * 1024,
    maxAvatarSizeBytes: 2 * 1024 * 1024,
    defaultStorageQuotaBytes: 10 * 1024 * 1024,
    isProduction: false,
  };
}

class CookieClient {
  private baseUrl: string;
  private cookie = '';

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async request(urlPath: string, init?: RequestInit): Promise<Response> {
    const headers = new Headers(init?.headers || {});
    if (this.cookie) {
      headers.set('cookie', this.cookie);
    }
    const res = await fetch(`${this.baseUrl}${urlPath}`, {
      ...init,
      headers,
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      const pair = setCookie.split(';')[0];
      if (pair.startsWith('inkora_session=')) {
        const val = pair.slice('inkora_session='.length);
        this.cookie = val ? pair : '';
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

describe('INKORA Full-Stack API & RBAC Integration Tests', () => {
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

  it('responds healthy and enforces auth on protected routes', async () => {
    const client = new CookieClient(baseUrl);
    const health = await client.json<{ status: string }>('/api/health');
    assert.equal(health.status, 200);
    assert.equal(health.data.status, 'ok');

    const unauth = await client.json<{ error: string }>('/api/workspace/summary');
    assert.equal(unauth.status, 401);

    const unauthAdmin = await client.json<{ error: string }>('/api/admin/stats');
    assert.equal(unauthAdmin.status, 401);
  });

  it('supports demo student login with seeded folders, notes & subjects while blocking admin routes', async () => {
    const client = new CookieClient(baseUrl);
    const demo = await client.json<{ user: { email: string; role: string; is_demo: number } }>(
      '/api/auth/demo',
      { method: 'POST' }
    );
    assert.equal(demo.status, 200);
    assert.equal(demo.data.user.email, 'alex.rivera@university.edu');
    assert.equal(demo.data.user.role, 'student');
    assert.equal(demo.data.user.is_demo, 1);

    const summary = await client.json<{
      folders: unknown[];
      subjects: unknown[];
      notebooks: unknown[];
      recentNotes: unknown[];
    }>('/api/workspace/summary');
    assert.equal(summary.status, 200);
    assert.ok(summary.data.folders.length >= 3);
    assert.ok(summary.data.subjects.length >= 3);
    assert.ok(summary.data.notebooks.length >= 3);
    assert.ok(summary.data.recentNotes.length >= 4);

    // Student MUST be denied access to Admin APIs
    const forbiddenStats = await client.json<{ error: string }>('/api/admin/stats');
    assert.equal(forbiddenStats.status, 403);
    const forbiddenStudents = await client.json<{ error: string }>('/api/admin/students');
    assert.equal(forbiddenStudents.status, 403);
  });

  it('enforces cross-student privacy isolation, admin RBAC, suspension/appeals & deletion', async () => {
    const studentA = new CookieClient(baseUrl);
    const studentB = new CookieClient(baseUrl);
    const admin = new CookieClient(baseUrl);

    // 1. Register Student A (attempting to pass role: 'admin' must be ignored -> 'student')
    const regA = await studentA.json<{ user: { id: string; email: string; role: string } }>(
      '/api/auth/register',
      {
        method: 'POST',
        body: JSON.stringify({
          email: 'maya.chen@bsu.edu',
          password: 'StrongPassword123!',
          full_name: 'Maya Chen',
          role: 'admin',
          university: 'BSU',
          major: 'Physics',
        }),
      }
    );
    assert.equal(regA.status, 201);
    assert.equal(regA.data.user.role, 'student');

    // Register Student B
    const regB = await studentB.json<{ user: { id: string; email: string; role: string } }>(
      '/api/auth/register',
      {
        method: 'POST',
        body: JSON.stringify({
          email: 'liam.wright@bsu.edu',
          password: 'StrongPassword123!',
          full_name: 'Liam Wright',
        }),
      }
    );
    assert.equal(regB.status, 201);
    assert.equal(regB.data.user.role, 'student');

    // 2. Student A creates Folder, Subject, Notebook, Private Note & Uploaded File
    const folderA = await studentA.json<{ folder: { id: string } }>('/api/folders', {
      method: 'POST',
      body: JSON.stringify({ name: 'Private Thesis Folder', color: '#6D28D9' }),
    });
    assert.equal(folderA.status, 201);

    const subA = await studentA.json<{ subject: { id: string } }>('/api/workspace/subjects', {
      method: 'POST',
      body: JSON.stringify({ code: 'PHYS 402', name: 'Quantum Mechanics' }),
    });
    const nbA = await studentA.json<{ notebook: { id: string } }>('/api/notebooks', {
      method: 'POST',
      body: JSON.stringify({ title: 'Schrodinger Notes', subject_id: subA.data.subject.id }),
    });

    const noteA = await studentA.json<{ note: { id: string } }>('/api/notes', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Secret Thesis Derivation',
        folder_id: folderA.data.folder.id,
        notebook_id: nbA.data.notebook.id,
        subject_id: subA.data.subject.id,
      }),
    });
    assert.equal(noteA.status, 201);
    const secretNoteId = noteA.data.note.id;

    await studentA.json(`/api/notes/${secretNoteId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        content_json: JSON.stringify({
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Confidential Hermitian proof.' }] }],
        }),
      }),
    });

    const fd = new FormData();
    fd.append('file', new Blob(['Secret lab dataset'], { type: 'text/csv' }), 'maya-secret.csv');
    fd.append('note_id', secretNoteId);
    const fileA = await studentA.request('/api/files/upload', { method: 'POST', body: fd });
    assert.equal(fileA.status, 201);
    const fileData = (await fileA.json()) as { file: { id: string } };

    // 3. Student B MUST NOT access Student A's note, folder, search results, or file!
    const stealNote = await studentB.json(`/api/notes/${secretNoteId}`);
    assert.equal(stealNote.status, 404);
    const stealPatch = await studentB.json(`/api/notes/${secretNoteId}`, {
      method: 'PATCH',
      body: JSON.stringify({ title: 'Hacked' }),
    });
    assert.equal(stealPatch.status, 404);
    const stealFile = await studentB.request(`/api/files/${fileData.file.id}/content`);
    assert.equal(stealFile.status, 404);
    const stealFolder = await studentB.json(`/api/folders/${folderA.data.folder.id}`, {
      method: 'DELETE',
    });
    assert.equal(stealFolder.status, 404);
    const searchB = await studentB.json<{ notes: Array<{ id: string }>; files: Array<{ id: string }> }>(
      '/api/workspace/search?q=Hermitian'
    );
    assert.equal(searchB.data.notes.length, 0);
    assert.equal(searchB.data.files.length, 0);

    // 4. Admin Role login & verification (admin has stats + student list, ZERO private note access)
    const adminLogin = await admin.json<{ user: { role: string } }>('/api/auth/demo-admin', {
      method: 'POST',
    });
    assert.equal(adminLogin.status, 200);
    assert.equal(adminLogin.data.user.role, 'admin');

    // Admin CANNOT access student private workspace endpoints
    const adminBlockedNotes = await admin.json('/api/notes');
    assert.equal(adminBlockedNotes.status, 403);
    const adminBlockedFile = await admin.request(`/api/files/${fileData.file.id}/content`);
    assert.equal(adminBlockedFile.status, 403);

    // Admin stats & student search work cleanly without exposing note contents
    const stats = await admin.json<{
      stats: { totalStudents: number; activeAccounts: number; suspendedAccounts: number; totalNotes: number };
    }>('/api/admin/stats');
    assert.equal(stats.status, 200);
    assert.ok(stats.data.stats.totalStudents >= 3);

    const searchMaya = await admin.json<{
      students: Array<{ id: string; email: string; note_count: number; title?: string; plain_text?: string }>;
    }>('/api/admin/students?q=maya.chen');
    assert.equal(searchMaya.status, 200);
    assert.equal(searchMaya.data.students.length, 1);
    assert.equal(searchMaya.data.students[0].note_count, 2);
    assert.equal(searchMaya.data.students[0].title, undefined);
    assert.equal(searchMaya.data.students[0].plain_text, undefined);

    // 5. Admin suspends Student A -> Student A's session is revoked & login blocked -> Student A submits Appeal -> Admin resolves & reactivates
    const susp = await admin.json<{ student: { status: string } }>(
      `/api/admin/students/${regA.data.user.id}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status: 'suspended', status_reason: 'Account review required' }),
      }
    );
    assert.equal(susp.status, 200);
    assert.equal(susp.data.student.status, 'suspended');

    const meWhileSuspended = await studentA.json('/api/auth/me');
    assert.ok(meWhileSuspended.status === 401 || meWhileSuspended.status === 403);

    const loginWhileSuspended = await studentA.json('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'maya.chen@bsu.edu', password: 'StrongPassword123!' }),
    });
    assert.equal(loginWhileSuspended.status, 403);

    // Submit appeal
    const appeal = await studentA.json<{ ok: boolean }>('/api/auth/appeal', {
      method: 'POST',
      body: JSON.stringify({
        email: 'maya.chen@bsu.edu',
        password: 'StrongPassword123!',
        subject: 'Please reactivate my student account',
        message: 'Verified my BSU enrollment status.',
      }),
    });
    assert.equal(appeal.status, 201);

    const concerns = await admin.json<{ concerns: Array<{ id: string; email: string; status: string }> }>(
      '/api/admin/concerns?status=open'
    );
    const mayaConcern = concerns.data.concerns.find((c) => c.email === 'maya.chen@bsu.edu');
    assert.ok(mayaConcern);

    const resolveConcern = await admin.json<{ concern: { status: string } }>(
      `/api/admin/concerns/${mayaConcern.id}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status: 'resolved', admin_note: 'Verified and reactivated.' }),
      }
    );
    assert.equal(resolveConcern.status, 200);
    assert.equal(resolveConcern.data.concern.status, 'resolved');

    await admin.json(`/api/admin/students/${regA.data.user.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'active' }),
    });

    const loginReactivated = await studentA.json<{ user: { status: string } }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'maya.chen@bsu.edu', password: 'StrongPassword123!' }),
    });
    assert.equal(loginReactivated.status, 200);
    assert.equal(loginReactivated.data.user.status, 'active');

    // 6. Admin deletes Student B
    const delB = await admin.json<{ ok: boolean }>(`/api/admin/students/${regB.data.user.id}`, {
      method: 'DELETE',
    });
    assert.equal(delB.status, 200);

    const checkB = await studentB.json('/api/auth/me');
    assert.equal(checkB.status, 401);
  });
});
