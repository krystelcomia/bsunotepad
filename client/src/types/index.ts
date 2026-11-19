export interface User {
  id: string;
  email: string;
  full_name: string;
  university: string;
  major: string;
  academic_year: string;
  bio: string;
  avatar_file: string | null;
  theme_preference: 'system' | 'light' | 'dark';
  storage_quota_bytes: number;
  is_demo: number;
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
export type PageSize = 'a4' | 'letter' | 'fluid';

export interface StrokePoint {
  x: number;
  y: number;
  p: number; // pressure 0..1
}

export interface DrawingStroke {
  id: string;
  tool: 'pen' | 'calligraphy' | 'pencil' | 'highlighter';
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
  notebook_id: string | null;
  subject_id: string | null;
  title: string;
  mode: NoteMode;
  paper_style: PaperStyle;
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
  notebook_title?: string | null;
  subject_code?: string | null;
  subject_name?: string | null;
  subject_color?: string | null;
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

export interface WorkspaceSummary {
  subjects: Subject[];
  notebooks: Notebook[];
  recentNotes: Note[];
  trashedCount: number;
  upcomingTasks: StudyTask[];
  stats: {
    storageUsedBytes: number;
    storageQuotaBytes: number;
    studyMinutesWeek: number;
    flashcardCount: number;
  };
}

export interface AccountOverview {
  user: User;
  counts: {
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
