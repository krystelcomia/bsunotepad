export type UserRole = 'student' | 'admin';
export type AccountStatus = 'active' | 'deactivated' | 'suspended';

export interface User {
  id: string;
  email: string;
  email_verified: number;
  role: UserRole;
  status: AccountStatus;
  status_reason: string;
  full_name: string;
  university: string;
  major: string;
  academic_year: string;
  bio: string;
  avatar_file: string | null;
  theme_preference: 'system' | 'light' | 'dark';
  workspace_accent: 'blue' | 'sky' | 'navy' | 'purple' | 'lavender';
  storage_quota_bytes: number;
  is_demo: number;
  last_login_at: string | null;
  login_count: number;
  created_at: string;
  updated_at: string;
}

export interface Folder {
  id: string;
  user_id: string;
  parent_id: string | null;
  name: string;
  color: string;
  icon: string;
  note_count?: number;
  last_used_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Subject {
  id: string;
  user_id: string;
  code: string;
  name: string;
  instructor: string;
  semester: string;
  color: string;
  icon: string;
  sort_order: number;
  notebook_count?: number;
  note_count?: number;
  created_at: string;
  updated_at: string;
}

export interface Notebook {
  id: string;
  user_id: string;
  subject_id: string | null;
  title: string;
  description: string;
  cover_color: string;
  accent_color: string;
  icon: string;
  default_paper_style: PaperStyle;
  is_pinned: number;
  subject_name?: string | null;
  subject_code?: string | null;
  subject_color?: string | null;
  note_count?: number;
  created_at: string;
  updated_at: string;
}

export type NoteMode = 'document' | 'notebook' | 'drawing';
export type PaperStyle = 'plain' | 'cream' | 'lined' | 'wide_ruled' | 'grid' | 'dot' | 'cornell' | 'dark_board';
export type PageSize = 'compact' | 'a4' | 'letter' | 'wide' | 'fluid';
export type NoteSortOption =
  | 'updated_desc'
  | 'updated_asc'
  | 'created_desc'
  | 'created_asc'
  | 'title_asc'
  | 'title_desc';

export interface StrokePoint {
  x: number;
  y: number;
  p: number;
}

export interface DrawingStroke {
  id: string;
  tool: 'pen' | 'calligraphy' | 'pencil' | 'marker' | 'highlighter';
  color: string;
  width: number;
  opacity: number;
  points: StrokePoint[];
}

export interface DrawingShape {
  id: string;
  kind: 'line' | 'arrow' | 'rect' | 'circle' | 'triangle';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width: number;
  opacity: number;
}

export interface DrawingText {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
}

export interface DrawingImage {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  src: string;
}

export interface DrawingData {
  version: number;
  background: string;
  strokes: DrawingStroke[];
  shapes: DrawingShape[];
  texts: DrawingText[];
  images?: DrawingImage[];
}

export interface Note {
  id: string;
  user_id?: string;
  folder_id: string | null;
  notebook_id: string | null;
  subject_id: string | null;
  title: string;
  description?: string;
  category?: string;
  mode: NoteMode;
  paper_style: PaperStyle;
  paper_bg_color?: string;
  page_size: PageSize;
  content_json: string;
  content_html: string;
  plain_text?: string;
  excerpt?: string;
  cornell_cues: string;
  cornell_summary: string;
  drawing_data: string;
  drawing_preview?: string;
  tags_json: string;
  word_count: number;
  is_pinned: number;
  is_starred: number;
  is_trashed: number;
  trashed_at?: string | null;
  share_token?: string | null;
  folder_name?: string | null;
  folder_color?: string | null;
  notebook_title?: string | null;
  subject_code?: string | null;
  subject_name?: string | null;
  subject_color?: string | null;
  last_opened_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface NoteVersion {
  id: string;
  note_id: string;
  label: string;
  title: string;
  mode: NoteMode;
  paper_style: PaperStyle;
  word_count: number;
  created_at: string;
}

export interface Attachment {
  id: string;
  user_id: string;
  note_id: string | null;
  subject_id: string | null;
  original_name: string;
  stored_name: string;
  mime_type: string;
  size_bytes: number;
  category: 'image' | 'pdf' | 'document' | 'other';
  note_title?: string | null;
  subject_code?: string | null;
  subject_name?: string | null;
  subject_color?: string | null;
  created_at: string;
}

export interface StudyTask {
  id: string;
  user_id: string;
  subject_id: string | null;
  note_id: string | null;
  title: string;
  description: string;
  due_date: string | null;
  priority: 'low' | 'medium' | 'high';
  status: 'todo' | 'in_progress' | 'done';
  subject_code?: string | null;
  subject_name?: string | null;
  subject_color?: string | null;
  note_title?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Flashcard {
  id: string;
  user_id: string;
  subject_id: string | null;
  notebook_id: string | null;
  note_id: string | null;
  front: string;
  back: string;
  confidence: number;
  review_count: number;
  last_reviewed_at: string | null;
  subject_code?: string | null;
  subject_name?: string | null;
  subject_color?: string | null;
  note_title?: string | null;
  created_at: string;
}

export interface StudySession {
  id: string;
  subject_id: string | null;
  note_id: string | null;
  duration_minutes: number;
  mode: 'focus' | 'break';
  completed_at: string;
  subject_code?: string | null;
  subject_name?: string | null;
  subject_color?: string | null;
}

export interface ActivityDay {
  date: string;
  label: string;
  notesCreated: number;
  notesEdited: number;
  studyMinutes: number;
}

export interface ActivityOverview {
  days: ActivityDay[];
  totalWords: number;
  tasksCompleted: number;
  tasksPending: number;
  notesCreatedWeek: number;
  notesEditedWeek: number;
}

export interface WorkspaceSummary {
  folders: Folder[];
  subjects: Subject[];
  notebooks: Notebook[];
  recentNotes: Note[];
  recentlyOpenedNotes: Note[];
  recentlyEditedDocuments: Note[];
  favoriteNotes: Note[];
  recentlyUsedFolders: Folder[];
  trashedCount: number;
  upcomingTasks: StudyTask[];
  activityOverview: ActivityOverview;
  stats: {
    storageUsedBytes: number;
    storageQuotaBytes: number;
    studyMinutesWeek: number;
    flashcardCount: number;
    totalNotes: number;
    totalDocuments: number;
    totalNotebookPages: number;
    totalDrawings: number;
    favoriteCount: number;
    totalFolders: number;
    totalFiles: number;
  };
}

export interface AccountConcern {
  id: string;
  user_id: string | null;
  email: string;
  subject: string;
  category: string;
  message: string;
  status: 'open' | 'in_review' | 'resolved';
  admin_note: string;
  student_name?: string | null;
  student_status?: AccountStatus | null;
  created_at: string;
  updated_at: string;
}

export interface AccountOverview {
  user: User;
  counts: {
    folders: number;
    subjects: number;
    notebooks: number;
    notes: number;
    files: number;
  };
  storage: {
    usedBytes: number;
    quotaBytes: number;
    breakdown: Array<{ category: string; count: number; bytes: number }>;
  };
  sessions: Array<{
    id: string;
    user_agent: string;
    ip_address: string;
    expires_at: string;
    created_at: string;
    last_active_at: string;
    isCurrent: boolean;
  }>;
}

export interface AdminStats {
  totalStudents: number;
  activeAccounts: number;
  suspendedAccounts: number;
  deactivatedAccounts: number;
  newRegistrations7d: number;
  activeLogins24h: number;
  totalNotes: number;
  totalNotebooks: number;
  totalFolders: number;
  totalFiles: number;
  totalStorageUsedBytes: number;
  openConcerns: number;
}

export interface AdminStudentRow {
  id: string;
  email: string;
  full_name: string;
  university: string;
  major: string;
  academic_year: string;
  status: AccountStatus;
  status_reason: string;
  is_demo: number;
  last_login_at: string | null;
  login_count: number;
  created_at: string;
  updated_at: string;
  storage_quota_bytes: number;
  note_count: number;
  file_count: number;
  storage_used_bytes: number;
  active_session_count: number;
}
