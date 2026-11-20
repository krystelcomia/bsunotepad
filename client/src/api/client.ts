import {
  AccountConcern,
  AccountOverview,
  AccountStatus,
  AdminStats,
  AdminStudentRow,
  Attachment,
  Flashcard,
  Folder,
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
  accountStatus?: AccountStatus;
  statusReason?: string;
  emailVerificationRequired?: boolean;
  email?: string;
  constructor(
    message: string,
    status: number,
    extra?: {
      accountStatus?: AccountStatus;
      statusReason?: string;
      emailVerificationRequired?: boolean;
      email?: string;
    }
  ) {
    super(message);
    this.status = status;
    this.accountStatus = extra?.accountStatus;
    this.statusReason = extra?.statusReason;
    this.emailVerificationRequired = extra?.emailVerificationRequired;
    this.email = extra?.email;
  }
}

export interface EmailChallengeResponse {
  requiresVerification?: boolean;
  ok?: boolean;
  email: string;
  deliveryMode: 'smtp' | 'dev_preview';
  previewOtp?: string;
  previewLink?: string;
  message?: string;
}

const NO_REFRESH_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/auth/verify-email',
  '/api/auth/resend-verification',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
]);

let inflightRefresh: Promise<boolean> | null = null;

async function tryRefreshSession(): Promise<boolean> {
  if (inflightRefresh) return inflightRefresh;
  inflightRefresh = (async () => {
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      inflightRefresh = null;
    }
  })();
  return inflightRefresh;
}

async function request<T>(url: string, options?: RequestInit, allowRetry = true): Promise<T> {
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

  if (res.status === 401 && allowRetry && !NO_REFRESH_PATHS.has(url)) {
    const refreshed = await tryRefreshSession();
    if (refreshed) {
      return request<T>(url, options, false);
    }
  }

  if (!res.ok) {
    let message = `Nabigo ang kahilingan (${res.status})`;
    let extra:
      | {
          accountStatus?: AccountStatus;
          statusReason?: string;
          emailVerificationRequired?: boolean;
          email?: string;
        }
      | undefined;
    try {
      const data = await res.json();
      if (data?.error) message = String(data.error);
      if (
        data?.accountStatus ||
        data?.emailVerificationRequired ||
        data?.email
      ) {
        extra = {
          accountStatus: data.accountStatus,
          statusReason: data.statusReason,
          emailVerificationRequired: Boolean(data.emailVerificationRequired),
          email: data.email,
        };
      }
    } catch {
      // ignore non-json error body
    }
    throw new ApiError(message, res.status, extra);
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
    confirm_password: string;
    full_name: string;
    university?: string;
    major?: string;
    academic_year?: string;
    avatar?: File | null;
  }) => {
    if (payload.avatar) {
      const fd = new FormData();
      fd.append('full_name', payload.full_name);
      fd.append('email', payload.email);
      fd.append('password', payload.password);
      fd.append('confirm_password', payload.confirm_password);
      if (payload.university) fd.append('university', payload.university);
      if (payload.major) fd.append('major', payload.major);
      if (payload.academic_year) fd.append('academic_year', payload.academic_year);
      fd.append('avatar', payload.avatar);
      return request<EmailChallengeResponse>('/api/auth/register', {
        method: 'POST',
        body: fd,
      });
    }
    return request<EmailChallengeResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        full_name: payload.full_name,
        email: payload.email,
        password: payload.password,
        confirm_password: payload.confirm_password,
        university: payload.university,
        major: payload.major,
        academic_year: payload.academic_year,
      }),
    });
  },
  verifyEmail: (payload: { email?: string; otp?: string; token?: string }) =>
    request<{ user: User; verified: boolean }>('/api/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  resendVerification: (email: string) =>
    request<EmailChallengeResponse>('/api/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  forgotPassword: (email: string) =>
    request<EmailChallengeResponse>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  resetPassword: (payload: {
    email?: string;
    otp?: string;
    token?: string;
    new_password: string;
    confirm_password: string;
  }) =>
    request<{ ok: boolean; message: string }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  demoLogin: () => request<{ user: User }>('/api/auth/demo', { method: 'POST' }),
  submitAppeal: (payload: { email: string; password: string; subject: string; message: string }) =>
    request<{ ok: boolean; id: string }>('/api/auth/appeal', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
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
  listAccountConcerns: () => request<{ concerns: AccountConcern[] }>('/api/account/concerns'),
  createAccountConcern: (payload: { subject: string; category: string; message: string }) =>
    request<{ concern: AccountConcern }>('/api/account/concerns', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  deleteAccount: (password: string) =>
    request<{ ok: boolean }>('/api/account', {
      method: 'DELETE',
      body: JSON.stringify({ password }),
    }),

  // Admin Console (Admin Role Only)
  adminStats: () => request<{ stats: AdminStats }>('/api/admin/stats'),
  adminListStudents: (params?: { q?: string; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set('q', params.q);
    if (params?.status) qs.set('status', params.status);
    const qStr = qs.toString();
    return request<{ students: AdminStudentRow[] }>(
      qStr ? `/api/admin/students?${qStr}` : '/api/admin/students'
    );
  },
  adminUpdateStudentStatus: (studentId: string, status: AccountStatus, status_reason?: string) =>
    request<{ student: AdminStudentRow }>(`/api/admin/students/${studentId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, status_reason }),
    }),
  adminDeleteStudent: (studentId: string) =>
    request<{ ok: boolean }>(`/api/admin/students/${studentId}`, { method: 'DELETE' }),
  adminListConcerns: (status?: string) =>
    request<{ concerns: AccountConcern[] }>(
      status ? `/api/admin/concerns?status=${encodeURIComponent(status)}` : '/api/admin/concerns'
    ),
  adminUpdateConcern: (concernId: string, payload: { status?: string; admin_note?: string }) =>
    request<{ concern: AccountConcern }>(`/api/admin/concerns/${concernId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  adminListAdmins: () => request<{ admins: User[] }>('/api/admin/admins'),
  adminCreateAdmin: (payload: { full_name: string; email: string; password: string }) =>
    request<{ admin: User }>('/api/admin/admins', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  adminPromoteStudent: (studentId: string) =>
    request<{ admin: User }>(`/api/admin/students/${studentId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role: 'admin' }),
    }),

  // Workspace & Search
  workspaceSummary: () => request<WorkspaceSummary>('/api/workspace/summary'),
  searchWorkspace: (q: string) =>
    request<{
      notes: Note[];
      folders: Folder[];
      notebooks: Notebook[];
      subjects: Subject[];
      files: Attachment[];
    }>(`/api/workspace/search?q=${encodeURIComponent(q)}`),

  // Folders
  listFolders: () => request<{ folders: Folder[] }>('/api/folders'),
  createFolder: (payload: Partial<Folder>) =>
    request<{ folder: Folder }>('/api/folders', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateFolder: (id: string, payload: Partial<Folder>) =>
    request<{ folder: Folder }>(`/api/folders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteFolder: (id: string) =>
    request<{ ok: boolean }>(`/api/folders/${id}`, { method: 'DELETE' }),

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
    folderId?: string;
    notebookId?: string;
    subjectId?: string;
    mode?: string;
    category?: string;
    q?: string;
    sort?: string;
    starred?: boolean;
    trashed?: boolean;
  }) => {
    const qs = new URLSearchParams();
    if (params?.folderId) qs.set('folderId', params.folderId);
    if (params?.notebookId) qs.set('notebookId', params.notebookId);
    if (params?.subjectId) qs.set('subjectId', params.subjectId);
    if (params?.mode) qs.set('mode', params.mode);
    if (params?.category) qs.set('category', params.category);
    if (params?.q) qs.set('q', params.q);
    if (params?.sort) qs.set('sort', params.sort);
    if (params?.starred) qs.set('starred', '1');
    if (params?.trashed) qs.set('trashed', '1');
    const qStr = qs.toString();
    return request<{ notes: Note[] }>(qStr ? `/api/notes?${qStr}` : '/api/notes');
  },
  getNote: (id: string) =>
    request<{ note: Note; attachments: Attachment[]; versionCount: number }>(`/api/notes/${id}`),
  createNote: (payload: {
    title?: string;
    description?: string;
    category?: string;
    mode?: string;
    paper_style?: string;
    paper_bg_color?: string;
    page_size?: string;
    folder_id?: string | null;
    notebook_id?: string | null;
    subject_id?: string | null;
    template?: string;
    tags?: string[];
    is_starred?: number;
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
