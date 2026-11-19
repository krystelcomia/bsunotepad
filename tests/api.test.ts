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

describe('INKORA Full-Stack API Integration Tests', () => {
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
  });

  it('supports demo login with seeded academic data', async () => {
    const client = new CookieClient(baseUrl);
    const demo = await client.json<{ user: { email: string; is_demo: number } }>('/api/auth/demo', {
      method: 'POST',
    });
    assert.equal(demo.status, 200);
    assert.equal(demo.data.user.email, 'alex.rivera@university.edu');
    assert.equal(demo.data.user.is_demo, 1);

    const summary = await client.json<{
      subjects: unknown[];
      notebooks: unknown[];
      recentNotes: unknown[];
    }>('/api/workspace/summary');
    assert.equal(summary.status, 200);
    assert.ok(summary.data.subjects.length >= 3);
    assert.ok(summary.data.notebooks.length >= 3);
    assert.ok(summary.data.recentNotes.length >= 4);
  });

  it('runs end-to-end user registration, workspace CRUD, search, versions, file storage, study tools & deletion', async () => {
    const client = new CookieClient(baseUrl);
    const email = 'maya.chen@bsu.edu';
    const password = 'StrongPassword123!';

    // 1. Register
    const reg = await client.json<{ user: { id: string; email: string } }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
        full_name: 'Maya Chen',
        university: 'BSU',
        major: 'Physics',
        academic_year: 'Senior',
      }),
    });
    assert.equal(reg.status, 201);
    assert.equal(reg.data.user.email, email);

    // Duplicate registration returns 409
    const dupReg = await client.json<{ error: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, full_name: 'Dup' }),
    });
    assert.equal(dupReg.status, 409);

    // 2. Profile update & password change
    const prof = await client.json<{ user: { bio: string } }>('/api/account/profile', {
      method: 'PATCH',
      body: JSON.stringify({ bio: 'Quantum optics researcher' }),
    });
    assert.equal(prof.status, 200);
    assert.equal(prof.data.user.bio, 'Quantum optics researcher');

    const newPw = 'UpdatedSecret456!';
    const pwRes = await client.json<{ ok: boolean }>('/api/account/password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword: password, newPassword: newPw, revokeOtherSessions: false }),
    });
    assert.equal(pwRes.status, 200);
    assert.equal(pwRes.data.ok, true);

    // 3. Create Subject & Notebook
    const subRes = await client.json<{ subject: { id: string } }>('/api/workspace/subjects', {
      method: 'POST',
      body: JSON.stringify({ code: 'PHYS 402', name: 'Quantum Mechanics', color: '#4F46E5' }),
    });
    assert.equal(subRes.status, 201);
    const subjectId = subRes.data.subject.id;

    const nbRes = await client.json<{ notebook: { id: string } }>('/api/notebooks', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Schrodinger Notes',
        subject_id: subjectId,
        default_paper_style: 'cornell',
      }),
    });
    assert.equal(nbRes.status, 201);
    const notebookId = nbRes.data.notebook.id;

    // 4. Create Note from template & update with rich content + drawing strokes
    const noteRes = await client.json<{ note: { id: string } }>('/api/notes', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Wavefunction Collapse Lecture',
        template: 'cornell',
        notebook_id: notebookId,
        subject_id: subjectId,
      }),
    });
    assert.equal(noteRes.status, 201);
    const noteId = noteRes.data.note.id;

    const updatedJson = JSON.stringify({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Hamiltonian Operator' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Eigenvalues of the Hermitian operator represent observables.' }] },
      ],
    });
    const drawingJson = JSON.stringify({
      version: 1,
      background: 'grid',
      strokes: [{ id: 's1', tool: 'pen', color: '#4F46E5', width: 3, opacity: 1, points: [{ x: 10, y: 10, p: 0.5 }, { x: 80, y: 80, p: 0.5 }] }],
      shapes: [],
      texts: [],
    });

    const patchRes = await client.json<{ note: { word_count: number; drawing_data: string } }>(`/api/notes/${noteId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        content_json: updatedJson,
        drawing_data: drawingJson,
        tags: ['quantum', 'eigenvalues'],
      }),
    });
    assert.equal(patchRes.status, 200);
    assert.ok(patchRes.data.note.word_count >= 7);

    // 5. Full-Text Search (FTS5)
    const searchRes = await client.json<{ notes: Array<{ id: string }> }>(
      '/api/workspace/search?q=Hermitian'
    );
    assert.equal(searchRes.status, 200);
    assert.ok(searchRes.data.notes.some((n) => n.id === noteId));

    // 6. Snapshot Version History & Restore
    const snapRes = await client.json<{ version: { id: string } }>(`/api/notes/${noteId}/versions`, {
      method: 'POST',
      body: JSON.stringify({ label: 'Before Edit' }),
    });
    assert.equal(snapRes.status, 201);

    await client.json(`/api/notes/${noteId}`, {
      method: 'PATCH',
      body: JSON.stringify({ title: 'Temporarily Renamed' }),
    });

    const restoreSnap = await client.json<{ note: { title: string } }>(
      `/api/notes/${noteId}/versions/${snapRes.data.version.id}/restore`,
      { method: 'POST' }
    );
    assert.equal(restoreSnap.status, 200);
    assert.equal(restoreSnap.data.note.title, 'Wavefunction Collapse Lecture');

    // 7. Share Link (Public Read-Only) & Revoke
    const shareEnable = await client.json<{ share_token: string }>(`/api/notes/${noteId}/share`, {
      method: 'POST',
      body: JSON.stringify({ enabled: true }),
    });
    assert.equal(shareEnable.status, 200);
    assert.ok(shareEnable.data.share_token);

    const anonClient = new CookieClient(baseUrl);
    const publicRead = await anonClient.json<{ note: { title: string; author_name: string } }>(
      `/api/shared/${shareEnable.data.share_token}`
    );
    assert.equal(publicRead.status, 200);
    assert.equal(publicRead.data.note.title, 'Wavefunction Collapse Lecture');
    assert.equal(publicRead.data.note.author_name, 'Maya Chen');

    // 8. Real File Upload, Download & Delete
    const fd = new FormData();
    fd.append('file', new Blob(['Wavefunction lab CSV data\n1,2,3\n'], { type: 'text/csv' }), 'lab-data.csv');
    fd.append('note_id', noteId);
    fd.append('subject_id', subjectId);

    const upRes = await client.request('/api/files/upload', { method: 'POST', body: fd });
    assert.equal(upRes.status, 201);
    const uploaded = (await upRes.json()) as { file: { id: string; size_bytes: number }; storage: { usedBytes: number } };
    assert.ok(uploaded.storage.usedBytes > 0);

    const dlRes = await client.request(`/api/files/${uploaded.file.id}/content`);
    assert.equal(dlRes.status, 200);
    const dlText = await dlRes.text();
    assert.ok(dlText.includes('Wavefunction lab CSV data'));

    // 9. Study Tasks, Flashcards & Sessions
    const taskRes = await client.json<{ task: { id: string } }>('/api/study/tasks', {
      method: 'POST',
      body: JSON.stringify({ title: 'Solve Problem Set 4', subject_id: subjectId, priority: 'high' }),
    });
    assert.equal(taskRes.status, 201);

    const cardRes = await client.json<{ flashcard: { id: string } }>('/api/study/flashcards', {
      method: 'POST',
      body: JSON.stringify({
        front: 'What property do Hermitian operator eigenvalues have?',
        back: 'They are always real.',
        subject_id: subjectId,
      }),
    });
    assert.equal(cardRes.status, 201);

    const reviewRes = await client.json<{ flashcard: { confidence: number; review_count: number } }>(
      `/api/study/flashcards/${cardRes.data.flashcard.id}/review`,
      { method: 'POST', body: JSON.stringify({ confidence: 5 }) }
    );
    assert.equal(reviewRes.status, 200);
    assert.equal(reviewRes.data.flashcard.confidence, 5);
    assert.equal(reviewRes.data.flashcard.review_count, 1);

    const sessRes = await client.json<{ session: { duration_minutes: number } }>('/api/study/sessions', {
      method: 'POST',
      body: JSON.stringify({ duration_minutes: 25, mode: 'focus', subject_id: subjectId }),
    });
    assert.equal(sessRes.status, 201);
    assert.equal(sessRes.data.session.duration_minutes, 25);

    // 10. Trash & Restore Note
    await client.json(`/api/notes/${noteId}/trash`, { method: 'POST' });
    await client.json(`/api/notes/${noteId}/restore`, { method: 'POST' });

    // 11. Account Delete cleans up everything
    const delRes = await client.json<{ ok: boolean }>('/api/account', {
      method: 'DELETE',
      body: JSON.stringify({ password: newPw }),
    });
    assert.equal(delRes.status, 200);
    assert.equal(delRes.data.ok, true);

    const afterDel = await client.json<{ error: string }>('/api/auth/me');
    assert.equal(afterDel.status, 401);
  });
});
