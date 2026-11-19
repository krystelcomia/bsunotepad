import {
  AccountOverview,
  Attachment,
  Flashcard,
  Notebook,
  Note,
  NoteVersion,
  StudySession,
  StudyTask,
  Subject,
  User,
  WorkspaceSummary,
} from '../types';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {};
  if (!(options?.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, {
    credentials: 'include',
    ...options,
    headers: {
      ...headers,
      ...(options?.headers || {}),
    },
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data?.error) message = String(data.error);
    } catch {
      // ignore non-json error body
    }
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  // Auth
  me: () => request<{ user: User; storageUsedBytes: number }>('/api/auth/me'),
  login: (email: string, password: string) =>
    request<{ user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (payload: {
    email: string;
    password: string;
    full_name: string;
    university?: string;
    major?: string;
    academic_year?: string;
  }) =>
    request<{ user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  demoLogin: () => request<{ user: User }>('/api/auth/demo', { method: 'POST' }),
  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  logoutAll: () => request<{ ok: boolean }>('/api/auth/logout-all', { method: 'POST' }),

  // Account
  accountOverview: () => request<AccountOverview>('/api/account/overview'),
  updateProfile: (payload: Partial<User>) =>
    request<{ user: User }>('/api/account/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  uploadAvatar: (file: File) => {
    const fd = new FormData();
    fd.append('avatar', file);
    return request<{ user: User }>('/api/account/avatar', { method: 'POST', body: fd });
  },
  changePassword: (currentPassword: string, newPassword: string, revokeOtherSessions: boolean) =>
    request<{ ok: boolean }>('/api/account/password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword, revokeOtherSessions }),
    }),
  revokeSession: (sessionId: string) =>
    request<{ ok: boolean }>(`/api/account/sessions/${sessionId}`, { method: 'DELETE' }),
  deleteAccount: (password: string) =>
    request<{ ok: boolean }>('/api/account', {
      method: 'DELETE',
      body: JSON.stringify({ password }),
    }),

  // Workspace & Search
  workspaceSummary: () => request<WorkspaceSummary>('/api/workspace/summary'),
  searchWorkspace: (q: string) =>
    request<{
      notes: Note[];
      notebooks: Notebook[];
      subjects: Subject[];
      files: Attachment[];
    }>(`/api/workspace/search?q=${encodeURIComponent(q)}`),

  // Subjects
  listSubjects: () => request<{ subjects: Subject[] }>('/api/workspace/subjects'),
  createSubject: (payload: Partial<Subject>) =>
    request<{ subject: Subject }>('/api/workspace/subjects', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateSubject: (id: string, payload: Partial<Subject>) =>
    request<{ subject: Subject }>(`/api/workspace/subjects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteSubject: (id: string) =>
    request<{ ok: boolean }>(`/api/workspace/subjects/${id}`, { method: 'DELETE' }),

  // Notebooks
  listNotebooks: (subjectId?: string) =>
    request<{ notebooks: Notebook[] }>(
      subjectId ? `/api/notebooks?subjectId=${encodeURIComponent(subjectId)}` : '/api/notebooks'
    ),
  createNotebook: (payload: Partial<Notebook>) =>
    request<{ notebook: Notebook }>('/api/notebooks', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateNotebook: (id: string, payload: Partial<Notebook>) =>
    request<{ notebook: Notebook }>(`/api/notebooks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteNotebook: (id: string) =>
    request<{ ok: boolean }>(`/api/notebooks/${id}`, { method: 'DELETE' }),

  // Notes
  listNotes: (params?: {
    notebookId?: string;
    subjectId?: string;
    mode?: string;
    starred?: boolean;
    trashed?: boolean;
  }) => {
    const qs = new URLSearchParams();
    if (params?.notebookId) qs.set('notebookId', params.notebookId);
    if (params?.subjectId) qs.set('subjectId', params.subjectId);
    if (params?.mode) qs.set('mode', params.mode);
    if (params?.starred) qs.set('starred', '1');
    if (params?.trashed) qs.set('trashed', '1');
    const qStr = qs.toString();
    return request<{ notes: Note[] }>(qStr ? `/api/notes?${qStr}` : '/api/notes');
  },
  getNote: (id: string) =>
    request<{ note: Note; attachments: Attachment[]; versionCount: number }>(`/api/notes/${id}`),
  createNote: (payload: {
    title?: string;
    mode?: string;
    paper_style?: string;
    page_size?: string;
    notebook_id?: string | null;
    subject_id?: string | null;
    template?: string;
    tags?: string[];
  }) =>
    request<{ note: Note }>('/api/notes', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateNote: (id: string, payload: Partial<Note> & { tags?: string[] }) =>
    request<{ note: Note }>(`/api/notes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  trashNote: (id: string) => request<{ ok: boolean }>(`/api/notes/${id}/trash`, { method: 'POST' }),
  restoreNote: (id: string) => request<{ ok: boolean }>(`/api/notes/${id}/restore`, { method: 'POST' }),
  deleteNotePermanent: (id: string) => request<{ ok: boolean }>(`/api/notes/${id}`, { method: 'DELETE' }),
  duplicateNote: (id: string) => request<{ note: Note }>(`/api/notes/${id}/duplicate`, { method: 'POST' }),

  // Versions & Sharing
  listNoteVersions: (noteId: string) =>
    request<{ versions: NoteVersion[] }>(`/api/notes/${noteId}/versions`),
  createNoteVersion: (noteId: string, label?: string) =>
    request<{ version: NoteVersion }>(`/api/notes/${noteId}/versions`, {
      method: 'POST',
      body: JSON.stringify({ label }),
    }),
  restoreNoteVersion: (noteId: string, versionId: string) =>
    request<{ note: Note }>(`/api/notes/${noteId}/versions/${versionId}/restore`, {
      method: 'POST',
    }),
  toggleNoteShare: (noteId: string, enabled?: boolean) =>
    request<{ share_token: string | null }>(`/api/notes/${noteId}/share`, {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    }),
  getSharedNote: (token: string) =>
    request<{
      note: Note & { author_name: string; author_university: string };
    }>(`/api/shared/${encodeURIComponent(token)}`),

  // Files
  listFiles: (params?: { category?: string; noteId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.category) qs.set('category', params.category);
    if (params?.noteId) qs.set('noteId', params.noteId);
    const qStr = qs.toString();
    return request<{
      files: Attachment[];
      storage: { usedBytes: number; quotaBytes: number };
    }>(qStr ? `/api/files?${qStr}` : '/api/files');
  },
  uploadFile: (file: File, opts?: { noteId?: string | null; subjectId?: string | null }) => {
    const fd = new FormData();
    fd.append('file', file);
    if (opts?.noteId) fd.append('note_id', opts.noteId);
    if (opts?.subjectId) fd.append('subject_id', opts.subjectId);
    return request<{
      file: Attachment;
      storage: { usedBytes: number; quotaBytes: number };
    }>('/api/files/upload', { method: 'POST', body: fd });
  },
  updateFile: (id: string, payload: Partial<Attachment>) =>
    request<{ file: Attachment }>(`/api/files/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteFile: (id: string) =>
    request<{ ok: boolean; storage: { usedBytes: number; quotaBytes: number } }>(`/api/files/${id}`, {
      method: 'DELETE',
    }),

  // Study Hub
  listTasks: () => request<{ tasks: StudyTask[] }>('/api/study/tasks'),
  createTask: (payload: Partial<StudyTask>) =>
    request<{ task: StudyTask }>('/api/study/tasks', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateTask: (id: string, payload: Partial<StudyTask>) =>
    request<{ task: StudyTask }>(`/api/study/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteTask: (id: string) =>
    request<{ ok: boolean }>(`/api/study/tasks/${id}`, { method: 'DELETE' }),

  listFlashcards: (subjectId?: string) =>
    request<{ flashcards: Flashcard[] }>(
      subjectId ? `/api/study/flashcards?subjectId=${encodeURIComponent(subjectId)}` : '/api/study/flashcards'
    ),
  createFlashcard: (payload: Partial<Flashcard>) =>
    request<{ flashcard: Flashcard }>('/api/study/flashcards', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  reviewFlashcard: (id: string, confidence: number) =>
    request<{ flashcard: Flashcard }>(`/api/study/flashcards/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ confidence }),
    }),
  deleteFlashcard: (id: string) =>
    request<{ ok: boolean }>(`/api/study/flashcards/${id}`, { method: 'DELETE' }),

  listStudySessions: () => request<{ sessions: StudySession[] }>('/api/study/sessions'),
  logStudySession: (durationMinutes: number, mode: 'focus' | 'break', opts?: { subjectId?: string | null; noteId?: string | null }) =>
    request<{ session: StudySession }>('/api/study/sessions', {
      method: 'POST',
      body: JSON.stringify({
        duration_minutes: durationMinutes,
        mode,
        subject_id: opts?.subjectId || null,
        note_id: opts?.noteId || null,
      }),
    }),
};
