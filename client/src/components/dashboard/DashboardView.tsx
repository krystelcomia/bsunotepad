import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowRight,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Circle,
  Clock,
  Copy,
  Edit3,
  FilePlus2,
  FileText,
  FlaskConical,
  Folder as FolderIcon,
  FolderOpen,
  FolderPlus,
  GraduationCap,
  LayoutGrid,
  List as ListIcon,
  Mail,
  NotebookPen,
  Paperclip,
  PenTool,
  Pin,
  Plus,
  RotateCcw,
  ScrollText,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Attachment, Folder, Notebook, Note, StudyTask, Subject, WorkspaceSummary } from '../../types';
import { formatBytes, formatDueDate, formatRelativeTime, parseTags } from '../../utils/format';

interface DashboardViewProps {
  mode: 'dashboard' | 'list';
  title: string;
  subtitle?: string;
  isTrashView?: boolean;
  summary: WorkspaceSummary;
  notes: Note[];
  onOpenNote: (noteId: string) => void;
  onCreateFromTemplate: (template: string) => void;
  onRefresh: () => void;
  onOpenStudyHub: () => void;
  onOpenFiles: () => void;
  onSelectNotebook: (nbId: string) => void;
  onNewFolder: () => void;
  onSelectFolder: (folderId: string) => void;
  onOpenAccount: () => void;
  onNotify: (type: 'success' | 'error' | 'info', text: string) => void;
}

interface SearchResultsState {
  notes: Note[];
  folders: Folder[];
  notebooks: Notebook[];
  subjects: Subject[];
  files: Attachment[];
}

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function getInitials(name?: string): string {
  if (!name) return 'IN';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  mode,
  title,
  subtitle,
  isTrashView = false,
  summary,
  notes,
  onOpenNote,
  onCreateFromTemplate,
  onRefresh,
  onOpenStudyHub,
  onOpenFiles,
  onSelectNotebook,
  onNewFolder,
  onSelectFolder,
  onOpenAccount,
  onNotify,
}) => {
  const { user } = useAuth();
  const [viewLayout, setViewLayout] = useState<'grid' | 'list'>('grid');
  const [typeFilter, setTypeFilter] = useState<'all' | 'document' | 'notebook' | 'drawing'>('all');

  // Dashboard interactive search bar
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResultsState | null>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  // Quick Upload File action
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults(null);
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await api.searchWorkspace(trimmed);
        if (!cancelled) {
          setSearchResults(res);
        }
      } catch {
        if (!cancelled) {
          setSearchResults(null);
        }
      } finally {
        if (!cancelled) {
          setSearching(false);
        }
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchQuery]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const filteredNotes = useMemo(() => {
    if (typeFilter === 'all') return notes;
    return notes.filter((n) => n.mode === typeFilter);
  }, [notes, typeFilter]);

  const toggleTaskDone = async (task: StudyTask) => {
    try {
      await api.updateTask(task.id, { status: task.status === 'done' ? 'todo' : 'done' });
      onRefresh();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Failed to update task');
    }
  };

  const handleToggleStar = async (e: React.MouseEvent, note: Note) => {
    e.stopPropagation();
    const nextStarred = note.is_starred === 1 ? 0 : 1;
    try {
      await api.updateNote(note.id, { is_starred: nextStarred });
      onNotify('success', nextStarred === 1 ? 'Added to Favorite Notes' : 'Removed from favorites');
      onRefresh();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Failed to update favorite');
    }
  };

  const handleDuplicate = async (e: React.MouseEvent, noteId: string) => {
    e.stopPropagation();
    try {
      await api.duplicateNote(noteId);
      onNotify('success', 'Note duplicated');
      onRefresh();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Failed to duplicate');
    }
  };

  const handleTrashOrDelete = async (e: React.MouseEvent, note: Note) => {
    e.stopPropagation();
    try {
      if (isTrashView) {
        if (!window.confirm(`Permanently delete "${note.title}"? This cannot be undone.`)) return;
        await api.deleteNotePermanent(note.id);
        onNotify('info', 'Note permanently deleted');
      } else {
        await api.trashNote(note.id);
        onNotify('info', 'Moved to Trash');
      }
      onRefresh();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Action failed');
    }
  };

  const handleRestore = async (e: React.MouseEvent, noteId: string) => {
    e.stopPropagation();
    try {
      await api.restoreNote(noteId);
      onNotify('success', 'Note restored');
      onRefresh();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Restore failed');
    }
  };

  const handleQuickUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingFile(true);
    try {
      await api.uploadFile(file);
      onNotify('success', `Uploaded "${file.name}" to File Vault`);
      onRefresh();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadingFile(false);
    }
  };

  const templates = [
    {
      id: 'blank',
      title: 'Word Document',
      desc: 'A4 rich text & tables',
      icon: <FileText className="w-5 h-5 text-indigo-600" />,
      bg: 'bg-indigo-50 dark:bg-indigo-950/50',
    },
    {
      id: 'cornell',
      title: 'Cornell Lecture',
      desc: 'Cues, notes & summary',
      icon: <NotebookPen className="w-5 h-5 text-rose-600" />,
      bg: 'bg-rose-50 dark:bg-rose-950/50',
    },
    {
      id: 'lined-notebook',
      title: 'Ruled + Ink',
      desc: 'Traditional paper + pen',
      icon: <BookOpen className="w-5 h-5 text-amber-600" />,
      bg: 'bg-amber-50 dark:bg-amber-950/50',
    },
    {
      id: 'lab-report',
      title: 'Lab Report',
      desc: 'Data tables & hypothesis',
      icon: <FlaskConical className="w-5 h-5 text-emerald-600" />,
      bg: 'bg-emerald-50 dark:bg-emerald-950/50',
    },
    {
      id: 'essay',
      title: 'Essay Outline',
      desc: 'Thesis & works cited',
      icon: <ScrollText className="w-5 h-5 text-violet-600" />,
      bg: 'bg-violet-50 dark:bg-violet-950/50',
    },
    {
      id: 'sketchpad',
      title: 'Drawing Pad',
      desc: 'Diagrams & freehand',
      icon: <PenTool className="w-5 h-5 text-sky-600" />,
      bg: 'bg-sky-50 dark:bg-sky-950/50',
    },
  ];

  const storagePct = Math.min(
    100,
    Math.round((summary.stats.storageUsedBytes / (summary.stats.storageQuotaBytes || 1)) * 100)
  );

  const activityDays = summary.activityOverview?.days || [];
  const maxDayActivity = Math.max(
    1,
    ...activityDays.map((d) => Math.max(d.notesCreated, d.notesEdited))
  );

  const searchTotalMatches = searchResults
    ? searchResults.notes.length +
      searchResults.folders.length +
      searchResults.notebooks.length +
      searchResults.subjects.length +
      searchResults.files.length
    : 0;

  const firstName = user?.full_name.split(' ')[0] || 'Scholar';

  const renderModeIcon = (noteMode: Note['mode']) => {
    if (noteMode === 'drawing') return <PenTool className="w-3.5 h-3.5" />;
    if (noteMode === 'notebook') return <NotebookPen className="w-3.5 h-3.5" />;
    return <FileText className="w-3.5 h-3.5" />;
  };

  return (
    <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-7">
      {/* Hidden input for Quick Upload File */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleQuickUpload}
      />

      {mode === 'dashboard' ? (
        <>
          {/* Personalized Hero Welcome + Search Bar + Quick Actions */}
          <section className="relative rounded-3xl bg-gradient-to-br from-violet-900 via-purple-800 to-blue-700 text-white p-6 sm:p-7 shadow-xl shadow-violet-900/15">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-xs text-[11px] font-semibold tracking-wide text-violet-100">
                  <Sparkles className="w-3.5 h-3.5 text-purple-200" />
                  INKORA Student Workspace
                </div>
                <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight">
                  {getTimeGreeting()}, {firstName}!
                </h1>
                <p className="text-sm text-violet-100/90 max-w-2xl">
                  Ready to capture today&apos;s ideas? You have{' '}
                  <span className="font-bold text-white">{summary.stats.totalNotes} notes</span> and{' '}
                  <span className="font-bold text-white">{summary.stats.totalDocuments} documents</span> organized
                  across{' '}
                  <span className="font-bold text-white">{summary.stats.totalFolders} folders</span>.
                </p>
              </div>

              {/* Interactive Live Search Bar */}
              <div ref={searchBoxRef} className="relative w-full lg:w-[400px] shrink-0">
                <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-white/95 dark:bg-slate-900 text-slate-900 dark:text-white shadow-lg ring-1 ring-white/30">
                  <Search className="w-4 h-4 text-violet-600 shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onFocus={() => setSearchFocused(true)}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setSearchFocused(true);
                    }}
                    placeholder="Search notes, documents, folders, or files..."
                    aria-label="Search workspace"
                    className="w-full bg-transparent text-sm placeholder:text-slate-400 focus:outline-none"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setSearchResults(null);
                      }}
                      className="p-0.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                      aria-label="Clear search"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Live Search Dropdown */}
                {searchFocused && searchQuery.trim().length > 0 && (
                  <div className="absolute left-0 right-0 mt-2 rounded-2xl bg-white dark:bg-slate-900 border border-violet-200 dark:border-slate-700 shadow-2xl z-30 max-h-96 overflow-y-auto p-3 text-slate-800 dark:text-slate-100">
                    {searching ? (
                      <div className="py-6 text-center text-xs text-slate-400">Searching your workspace...</div>
                    ) : searchTotalMatches === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-400">
                        No notes, folders, or files matched &ldquo;{searchQuery.trim()}&rdquo;.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {searchResults && searchResults.notes.length > 0 && (
                          <div>
                            <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">
                              Notes & Documents ({searchResults.notes.length})
                            </div>
                            <div className="space-y-1">
                              {searchResults.notes.slice(0, 5).map((n) => (
                                <button
                                  key={n.id}
                                  type="button"
                                  onClick={() => {
                                    setSearchFocused(false);
                                    onOpenNote(n.id);
                                  }}
                                  className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl hover:bg-violet-50 dark:hover:bg-slate-800 text-left cursor-pointer"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <span className="p-1.5 rounded-lg bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300">
                                      {renderModeIcon(n.mode)}
                                    </span>
                                    <div className="min-w-0">
                                      <div className="text-xs font-semibold truncate">{n.title}</div>
                                      <div className="text-[10px] text-slate-400 truncate">
                                        {[n.mode, n.folder_name, formatRelativeTime(n.updated_at)]
                                          .filter(Boolean)
                                          .join(' · ')}
                                      </div>
                                    </div>
                                  </div>
                                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {searchResults && searchResults.folders.length > 0 && (
                          <div>
                            <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                              Folders ({searchResults.folders.length})
                            </div>
                            <div className="space-y-1">
                              {searchResults.folders.slice(0, 4).map((f) => (
                                <button
                                  key={f.id}
                                  type="button"
                                  onClick={() => {
                                    setSearchFocused(false);
                                    onSelectFolder(f.id);
                                  }}
                                  className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl hover:bg-blue-50 dark:hover:bg-slate-800 text-left cursor-pointer"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <FolderIcon className="w-4 h-4 shrink-0" style={{ color: f.color }} />
                                    <span className="text-xs font-medium truncate">{f.name}</span>
                                  </div>
                                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {searchResults && searchResults.notebooks.length > 0 && (
                          <div>
                            <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                              Notebooks ({searchResults.notebooks.length})
                            </div>
                            <div className="space-y-1">
                              {searchResults.notebooks.slice(0, 3).map((nb) => (
                                <button
                                  key={nb.id}
                                  type="button"
                                  onClick={() => {
                                    setSearchFocused(false);
                                    onSelectNotebook(nb.id);
                                  }}
                                  className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl hover:bg-indigo-50 dark:hover:bg-slate-800 text-left cursor-pointer"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <BookOpen className="w-4 h-4 shrink-0" style={{ color: nb.cover_color }} />
                                    <span className="text-xs font-medium truncate">{nb.title}</span>
                                  </div>
                                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {searchResults && searchResults.files.length > 0 && (
                          <div>
                            <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                              Files ({searchResults.files.length})
                            </div>
                            <div className="space-y-1">
                              {searchResults.files.slice(0, 3).map((file) => (
                                <button
                                  key={file.id}
                                  type="button"
                                  onClick={() => {
                                    setSearchFocused(false);
                                    onOpenFiles();
                                  }}
                                  className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl hover:bg-emerald-50 dark:hover:bg-slate-800 text-left cursor-pointer"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <Paperclip className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                    <span className="text-xs font-medium truncate">{file.original_name}</span>
                                  </div>
                                  <span className="text-[10px] text-slate-400">{formatBytes(file.size_bytes)}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 5 Quick Actions Strip */}
            <div className="mt-6 pt-5 border-t border-white/15">
              <div className="text-[11px] font-bold uppercase tracking-wider text-violet-200 mb-3">
                Quick Actions & Create
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
                <button
                  type="button"
                  onClick={() => onCreateFromTemplate('lined-notebook')}
                  className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/12 hover:bg-white/22 backdrop-blur-xs border border-white/15 text-left transition cursor-pointer group"
                >
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                    <Plus className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">Create New Note</div>
                    <div className="text-[11px] text-violet-200 truncate">Notebook + keyboard</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => onCreateFromTemplate('sketchpad')}
                  className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/12 hover:bg-white/22 backdrop-blur-xs border border-white/15 text-left transition cursor-pointer group"
                >
                  <div className="w-10 h-10 rounded-xl bg-sky-400/25 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                    <PenTool className="w-5 h-5 text-sky-100" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">Open Drawing Notebook</div>
                    <div className="text-[11px] text-violet-200 truncate">Pens, shapes & ink</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => onCreateFromTemplate('blank')}
                  className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/12 hover:bg-white/22 backdrop-blur-xs border border-white/15 text-left transition cursor-pointer group"
                >
                  <div className="w-10 h-10 rounded-xl bg-indigo-400/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                    <FilePlus2 className="w-5 h-5 text-indigo-100" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">Create Word Document</div>
                    <div className="text-[11px] text-violet-200 truncate">Rich text & tables</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={onNewFolder}
                  className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/12 hover:bg-white/22 backdrop-blur-xs border border-white/15 text-left transition cursor-pointer group"
                >
                  <div className="w-10 h-10 rounded-xl bg-purple-300/25 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                    <FolderPlus className="w-5 h-5 text-purple-100" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">Create New Folder</div>
                    <div className="text-[11px] text-violet-200 truncate">Organize by topic</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingFile}
                  className="col-span-2 sm:col-span-1 flex items-center gap-3 p-3.5 rounded-2xl bg-white text-violet-950 hover:bg-violet-50 shadow-md text-left transition cursor-pointer group disabled:opacity-70"
                >
                  <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                    <Upload className="w-5 h-5 text-violet-700" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold truncate">
                      {uploadingFile ? 'Uploading...' : 'Upload File'}
                    </div>
                    <div className="text-[11px] text-violet-700/80 truncate">PDF, DOCX, images</div>
                  </div>
                </button>
              </div>
            </div>
          </section>

          {/* Profile Info Card + Workspace Totals + Activity Overview */}
          <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Student Profile Information Card */}
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between gap-5">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3.5 min-w-0">
                    {user?.avatar_file ? (
                      <img
                        src={`/uploads/avatars/${user.avatar_file}`}
                        alt={user.full_name}
                        className="w-14 h-14 rounded-2xl object-cover border-2 border-violet-200 dark:border-violet-800 shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-700 via-purple-600 to-blue-500 text-white font-display font-extrabold text-lg flex items-center justify-center shadow-md shrink-0">
                        {getInitials(user?.full_name)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h2 className="font-display font-bold text-base text-slate-900 dark:text-white truncate">
                        {user?.full_name || 'Student Profile'}
                      </h2>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        <Mail className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                        <span className="truncate">{user?.email}</span>
                      </div>
                      <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                        <ShieldCheck className="w-3 h-3" /> Verified Gmail Account
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenAccount}
                    className="p-2 rounded-xl border border-stone-200 dark:border-slate-700 text-slate-500 hover:text-violet-700 hover:border-violet-300 dark:hover:text-violet-300 transition cursor-pointer shrink-0"
                    title="Edit profile & preferences"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                </div>

                {/* Academic Profile Metadata */}
                <div className="mt-4 pt-4 border-t border-stone-100 dark:border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">University</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200 text-right truncate">
                      {user?.university || 'Add your university'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">Program / Major</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200 text-right truncate">
                      {user?.major || 'General Studies'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">Year Level</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200 text-right truncate">
                      {user?.academic_year || 'Student'}
                    </span>
                  </div>
                </div>

                {user?.bio && (
                  <p className="mt-3 text-xs text-slate-500 dark:text-slate-400 bg-violet-50/60 dark:bg-slate-800/60 rounded-xl p-3 italic line-clamp-2">
                    &ldquo;{user.bio}&rdquo;
                  </p>
                )}
              </div>

              {/* Storage Quota Bar */}
              <div className="pt-3 border-t border-stone-100 dark:border-slate-800">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-semibold text-slate-600 dark:text-slate-300">File Vault Storage</span>
                  <button
                    type="button"
                    onClick={onOpenFiles}
                    className="text-violet-600 dark:text-violet-400 font-semibold hover:underline cursor-pointer"
                  >
                    Manage ({summary.stats.totalFiles} files)
                  </button>
                </div>
                <div className="h-2 rounded-full bg-stone-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-700 via-purple-500 to-blue-500 transition-all"
                    style={{ width: `${Math.max(4, storagePct)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1.5">
                  <span>{formatBytes(summary.stats.storageUsedBytes)} used</span>
                  <span>{formatBytes(summary.stats.storageQuotaBytes)} quota</span>
                </div>
              </div>
            </div>

            {/* Right 2 Columns: Metrics + 7-Day Activity Overview */}
            <div className="xl:col-span-2 flex flex-col gap-5">
              {/* 4 Key KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 shadow-xs">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <span>Total Notes Created</span>
                    <NotebookPen className="w-4 h-4 text-violet-600" />
                  </div>
                  <div className="font-display text-2xl font-extrabold text-slate-900 dark:text-white mt-1.5">
                    {summary.stats.totalNotes}
                  </div>
                  <div className="text-[11px] text-violet-600 dark:text-violet-400 mt-1 font-medium">
                    {summary.stats.totalNotebookPages} notebooks · {summary.stats.totalDrawings} drawings
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 shadow-xs">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <span>Total Documents</span>
                    <FileText className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="font-display text-2xl font-extrabold text-slate-900 dark:text-white mt-1.5">
                    {summary.stats.totalDocuments}
                  </div>
                  <div className="text-[11px] text-blue-600 dark:text-blue-400 mt-1 font-medium">
                    {summary.activityOverview.totalWords.toLocaleString()} words written
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 shadow-xs">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <span>Favorites & Folders</span>
                    <Star className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="font-display text-2xl font-extrabold text-slate-900 dark:text-white mt-1.5">
                    {summary.stats.favoriteCount}
                  </div>
                  <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 font-medium">
                    Starred · {summary.stats.totalFolders} folders
                  </div>
                </div>

                <div
                  onClick={onOpenStudyHub}
                  className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 shadow-xs cursor-pointer hover:border-violet-300 transition"
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <span>Study Focus (7d)</span>
                    <GraduationCap className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="font-display text-2xl font-extrabold text-slate-900 dark:text-white mt-1.5">
                    {summary.stats.studyMinutesWeek}m
                  </div>
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
                    {summary.stats.flashcardCount} flashcards · {summary.upcomingTasks.length} due
                  </div>
                </div>
              </div>

              {/* 7-Day Activity Overview Chart */}
              <div className="flex-1 rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-violet-600" />
                      <h2 className="font-display font-bold text-sm text-slate-900 dark:text-white">
                        Activity Overview (Last 7 Days)
                      </h2>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Daily notes created, edited, and study focus progress
                    </p>
                  </div>

                  <div className="flex items-center gap-4 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-violet-600" />
                      Created ({summary.activityOverview.notesCreatedWeek})
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-blue-400" />
                      Edited ({summary.activityOverview.notesEditedWeek})
                    </span>
                  </div>
                </div>

                {/* Bar Chart */}
                <div className="grid grid-cols-7 gap-2 sm:gap-3 items-end h-32 pt-2">
                  {activityDays.map((day) => {
                    const createdPct =
                      day.notesCreated > 0
                        ? Math.max(16, Math.round((day.notesCreated / maxDayActivity) * 100))
                        : 4;
                    const editedPct =
                      day.notesEdited > 0
                        ? Math.max(16, Math.round((day.notesEdited / maxDayActivity) * 100))
                        : 4;
                    return (
                      <div key={day.date} className="flex flex-col items-center gap-1.5 h-full justify-end group">
                        <div className="w-full flex items-end justify-center gap-1 h-24">
                          <div
                            className={`w-2.5 sm:w-3.5 rounded-t-md transition-all ${
                              day.notesCreated > 0
                                ? 'bg-violet-600 group-hover:bg-violet-500'
                                : 'bg-stone-200 dark:bg-slate-800'
                            }`}
                            style={{ height: `${createdPct}%` }}
                            title={`${day.label}: ${day.notesCreated} created`}
                          />
                          <div
                            className={`w-2.5 sm:w-3.5 rounded-t-md transition-all ${
                              day.notesEdited > 0
                                ? 'bg-blue-400 group-hover:bg-blue-300'
                                : 'bg-stone-100 dark:bg-slate-800/70'
                            }`}
                            style={{ height: `${editedPct}%` }}
                            title={`${day.label}: ${day.notesEdited} edited · ${day.studyMinutes}m study`}
                          />
                        </div>
                        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                          {day.label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Activity Footer Strip */}
                <div className="mt-4 pt-3 border-t border-stone-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span>
                    Tasks Progress:{' '}
                    <strong className="text-slate-800 dark:text-slate-200">
                      {summary.activityOverview.tasksCompleted} completed
                    </strong>{' '}
                    · {summary.activityOverview.tasksPending} pending
                  </span>
                  <button
                    type="button"
                    onClick={onOpenStudyHub}
                    className="text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline cursor-pointer"
                  >
                    Open Study Hub & Timer &rarr;
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Recently Opened Notes & Recently Edited Documents */}
          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Recently Opened Notes */}
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-violet-600" />
                  <h2 className="font-display font-bold text-sm text-slate-900 dark:text-white">
                    Recently Opened Notes
                  </h2>
                </div>
                <span className="text-[11px] text-slate-400 font-medium">
                  {summary.recentlyOpenedNotes.length} recent
                </span>
              </div>

              {summary.recentlyOpenedNotes.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400 border border-dashed border-stone-200 dark:border-slate-800 rounded-xl">
                  Open or create a note to see your recent history here.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {summary.recentlyOpenedNotes.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => onOpenNote(n.id)}
                      className="flex items-center justify-between gap-3 p-3 rounded-xl border border-stone-100 dark:border-slate-800 hover:border-violet-300 dark:hover:border-violet-700 hover:bg-violet-50/40 dark:hover:bg-slate-800/60 transition cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`p-2 rounded-xl shrink-0 ${
                            n.mode === 'drawing'
                              ? 'bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-300'
                              : n.mode === 'notebook'
                                ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-300'
                                : 'bg-violet-50 text-violet-600 dark:bg-violet-950/60 dark:text-violet-300'
                          }`}
                        >
                          {renderModeIcon(n.mode)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-sm text-slate-900 dark:text-white truncate group-hover:text-violet-700 dark:group-hover:text-violet-300">
                            {n.title}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                            <span className="capitalize">{n.mode}</span>
                            {n.folder_name && <span>· {n.folder_name}</span>}
                            <span>· Opened {formatRelativeTime(n.last_opened_at || n.updated_at)}</span>
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handleToggleStar(e, n)}
                        className={`p-1.5 rounded-lg transition cursor-pointer shrink-0 ${
                          n.is_starred === 1
                            ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                            : 'text-slate-300 hover:text-amber-500'
                        }`}
                        title={n.is_starred === 1 ? 'Remove favorite' : 'Add to favorite notes'}
                      >
                        <Star className="w-4 h-4" fill={n.is_starred === 1 ? 'currentColor' : 'none'} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recently Edited Documents */}
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <h2 className="font-display font-bold text-sm text-slate-900 dark:text-white">
                    Recently Edited Documents
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => onCreateFromTemplate('blank')}
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  + New Word Doc
                </button>
              </div>

              {summary.recentlyEditedDocuments.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400 border border-dashed border-stone-200 dark:border-slate-800 rounded-xl">
                  No Word documents yet. Click &ldquo;Create Word Document&rdquo; above to write your first paper!
                </div>
              ) : (
                <div className="space-y-2.5">
                  {summary.recentlyEditedDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      onClick={() => onOpenNote(doc.id)}
                      className="flex items-center justify-between gap-3 p-3 rounded-xl border border-stone-100 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50/40 dark:hover:bg-slate-800/60 transition cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300 shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-sm text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-300">
                            {doc.title}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate mt-0.5">
                            {doc.word_count} words · Edited {formatRelativeTime(doc.updated_at)}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handleToggleStar(e, doc)}
                        className={`p-1.5 rounded-lg transition cursor-pointer shrink-0 ${
                          doc.is_starred === 1
                            ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                            : 'text-slate-300 hover:text-amber-500'
                        }`}
                        title={doc.is_starred === 1 ? 'Remove favorite' : 'Favorite document'}
                      >
                        <Star className="w-4 h-4" fill={doc.is_starred === 1 ? 'currentColor' : 'none'} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Favorite Notes & Recently Used Folders */}
          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Favorite Notes */}
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-500" fill="currentColor" />
                  <h2 className="font-display font-bold text-sm text-slate-900 dark:text-white">
                    Favorite Notes
                  </h2>
                </div>
                <span className="text-[11px] text-slate-400 font-medium">
                  {summary.stats.favoriteCount} starred
                </span>
              </div>

              {summary.favoriteNotes.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400 border border-dashed border-stone-200 dark:border-slate-800 rounded-xl">
                  Star important notes and study sheets for instant pinning here.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {summary.favoriteNotes.map((fav) => (
                    <div
                      key={fav.id}
                      onClick={() => onOpenNote(fav.id)}
                      className="p-3.5 rounded-xl border border-amber-200/70 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/15 hover:border-amber-400 transition cursor-pointer group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-xs text-slate-900 dark:text-white line-clamp-1 group-hover:text-violet-700 dark:group-hover:text-violet-300">
                          {fav.title}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleToggleStar(e, fav)}
                          className="text-amber-500 hover:text-amber-600 cursor-pointer shrink-0"
                          title="Unstar favorite"
                        >
                          <Star className="w-3.5 h-3.5" fill="currentColor" />
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-1">
                        {fav.excerpt || `${fav.mode} · ${fav.word_count} words`}
                      </p>
                      <div className="mt-2 text-[10px] text-slate-400 flex items-center justify-between">
                        <span className="capitalize">{fav.mode}</span>
                        <span>{formatRelativeTime(fav.updated_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recently Used Folders */}
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-violet-600" />
                  <h2 className="font-display font-bold text-sm text-slate-900 dark:text-white">
                    Recently Used Folders
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={onNewFolder}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline cursor-pointer"
                >
                  <FolderPlus className="w-3.5 h-3.5" /> New Folder
                </button>
              </div>

              {summary.recentlyUsedFolders.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400 border border-dashed border-stone-200 dark:border-slate-800 rounded-xl">
                  Create folders to organize lecture notes, assignments, and study guides.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {summary.recentlyUsedFolders.map((fld) => (
                    <button
                      key={fld.id}
                      type="button"
                      onClick={() => onSelectFolder(fld.id)}
                      className="flex items-center gap-3 p-3.5 rounded-xl border border-stone-200 dark:border-slate-800 hover:border-violet-400 hover:shadow-xs text-left transition cursor-pointer group"
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${fld.color}20` }}
                      >
                        <FolderIcon className="w-5 h-5" style={{ color: fld.color }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-xs text-slate-900 dark:text-white truncate group-hover:text-violet-700 dark:group-hover:text-violet-300">
                          {fld.name}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                          {fld.note_count ?? 0} {(fld.note_count ?? 0) === 1 ? 'note' : 'notes'} ·{' '}
                          {formatRelativeTime(fld.last_used_at || fld.updated_at)}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Studio Templates */}
          <section>
            <h2 className="font-display text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
              Start From Studio Template
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
              {templates.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => onCreateFromTemplate(tpl.id)}
                  className="text-left p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 hover:border-violet-400 hover:shadow-md transition group cursor-pointer"
                >
                  <div
                    className={`w-10 h-10 rounded-xl ${tpl.bg} flex items-center justify-center mb-2.5 group-hover:scale-105 transition`}
                  >
                    {tpl.icon}
                  </div>
                  <div className="font-semibold text-xs text-slate-900 dark:text-white">{tpl.title}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{tpl.desc}</div>
                </button>
              ))}
            </div>
          </section>

          {/* Notebooks Shelf + Upcoming Assignments */}
          <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Your Notebooks
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {summary.notebooks.slice(0, 6).map((nb: Notebook) => (
                  <button
                    key={nb.id}
                    type="button"
                    onClick={() => onSelectNotebook(nb.id)}
                    className="text-left rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 overflow-hidden hover:shadow-md transition group cursor-pointer"
                  >
                    <div className="h-3 w-full" style={{ backgroundColor: nb.cover_color }} />
                    <div className="p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-display font-bold text-sm text-slate-900 dark:text-white truncate group-hover:text-violet-600">
                          {nb.title}
                        </span>
                        {nb.is_pinned === 1 && <Pin className="w-3.5 h-3.5 text-violet-500 shrink-0" />}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1 min-h-[32px]">
                        {nb.description || 'Academic notebook'}
                      </p>
                      <div className="mt-3 pt-2.5 border-t border-stone-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                        <span>{nb.subject_code || 'General'}</span>
                        <span className="font-semibold text-slate-600 dark:text-slate-300">
                          {nb.note_count ?? 0} pages
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Upcoming Deadlines
                </h2>
                <button
                  type="button"
                  onClick={onOpenStudyHub}
                  className="text-xs font-semibold text-violet-600 hover:underline cursor-pointer"
                >
                  View all
                </button>
              </div>
              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 p-3 space-y-2">
                {summary.upcomingTasks.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-8">
                    All caught up! Add assignments in Study Hub.
                  </p>
                ) : (
                  summary.upcomingTasks.map((t) => {
                    const due = formatDueDate(t.due_date);
                    return (
                      <div
                        key={t.id}
                        className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-stone-50 dark:hover:bg-slate-800/70 transition"
                      >
                        <button
                          type="button"
                          onClick={() => toggleTaskDone(t)}
                          className="mt-0.5 text-slate-400 hover:text-emerald-600 cursor-pointer"
                        >
                          {t.status === 'done' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Circle className="w-4 h-4" />
                          )}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                            {t.title}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px]">
                            {t.subject_code && (
                              <span
                                className="font-bold px-1.5 py-0.5 rounded text-white text-[10px]"
                                style={{ backgroundColor: t.subject_color || '#6D28D9' }}
                              >
                                {t.subject_code}
                              </span>
                            )}
                            <span
                              className={`flex items-center gap-1 ${
                                due.urgent ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-slate-400'
                              }`}
                            >
                              <CalendarClock className="w-3 h-3" /> {due.label}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </section>
        </>
      ) : (
        /* Filtered Notes List / Trash Header */
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {title}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {subtitle || `${filteredNotes.length} item(s)`}
            </p>
          </div>

          {!isTrashView && (
            <button
              type="button"
              onClick={() => onCreateFromTemplate('blank')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-800 via-purple-700 to-blue-600 hover:brightness-110 text-white text-sm font-semibold shadow-md shadow-violet-700/20 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Create Note
            </button>
          )}
        </div>
      )}

      {/* Workspace Notes Grid / List */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            {mode === 'dashboard' && (
              <h2 className="font-display text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                All Notes & Pages
              </h2>
            )}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800">
              {(
                [
                  { id: 'all', label: 'All Types' },
                  { id: 'document', label: 'Documents' },
                  { id: 'notebook', label: 'Notebooks' },
                  { id: 'drawing', label: 'Drawings' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setTypeFilter(f.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    typeFilter === f.id
                      ? 'bg-violet-700 text-white'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setViewLayout('grid')}
              className={`p-1.5 rounded-lg cursor-pointer ${
                viewLayout === 'grid' ? 'bg-stone-100 dark:bg-slate-800 text-violet-600' : 'text-slate-400'
              }`}
              title="Grid view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewLayout('list')}
              className={`p-1.5 rounded-lg cursor-pointer ${
                viewLayout === 'list' ? 'bg-stone-100 dark:bg-slate-800 text-violet-600' : 'text-slate-400'
              }`}
              title="List view"
            >
              <ListIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {filteredNotes.length === 0 ? (
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-dashed border-stone-300 dark:border-slate-700 p-12 text-center">
            <GraduationCap className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <h3 className="font-display font-bold text-slate-800 dark:text-white">
              {isTrashView ? 'Trash is empty' : 'No notes here yet'}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {isTrashView
                ? 'Deleted notes appear here before permanent removal.'
                : 'Create a new Word document, Cornell lecture note, or drawing sketch to get started.'}
            </p>
          </div>
        ) : viewLayout === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredNotes.map((n) => {
              const tags = parseTags(n.tags_json);
              return (
                <div
                  key={n.id}
                  onClick={() => !isTrashView && onOpenNote(n.id)}
                  className={`group rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 p-5 flex flex-col justify-between transition ${
                    isTrashView ? '' : 'cursor-pointer hover:border-violet-400 hover:shadow-lg hover:shadow-violet-900/5'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                          n.mode === 'drawing'
                            ? 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300'
                            : n.mode === 'notebook'
                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                              : 'bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300'
                        }`}
                      >
                        {renderModeIcon(n.mode)}
                        {n.mode}
                      </span>

                      <div className="flex items-center gap-1">
                        {n.is_pinned === 1 && <Pin className="w-3.5 h-3.5 text-violet-500" />}
                        {!isTrashView && (
                          <button
                            type="button"
                            onClick={(e) => handleToggleStar(e, n)}
                            className={`p-1 rounded-md transition cursor-pointer ${
                              n.is_starred === 1
                                ? 'text-amber-500'
                                : 'text-slate-300 opacity-0 group-hover:opacity-100 hover:text-amber-500'
                            }`}
                            title={n.is_starred === 1 ? 'Remove from favorites' : 'Star note'}
                          >
                            <Star className="w-3.5 h-3.5" fill={n.is_starred === 1 ? 'currentColor' : 'none'} />
                          </button>
                        )}
                      </div>
                    </div>

                    <h3 className="font-display font-bold text-base text-slate-900 dark:text-white group-hover:text-violet-600 transition line-clamp-2">
                      {n.title}
                    </h3>

                    {n.drawing_preview ? (
                      <div className="mt-3 rounded-xl border border-stone-200 dark:border-slate-800 overflow-hidden bg-stone-50 h-28 flex items-center justify-center">
                        <img
                          src={n.drawing_preview}
                          alt={n.title}
                          className="w-full h-full object-contain"
                        />
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 line-clamp-3 leading-relaxed">
                        {n.excerpt || 'Empty page — click to open studio and start writing or drawing.'}
                      </p>
                    )}

                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {tags.slice(0, 3).map((t) => (
                          <span
                            key={t}
                            className="text-[10px] px-2 py-0.5 rounded-full bg-stone-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-violet-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {n.subject_code && (
                        <span
                          className="font-bold px-1.5 py-0.5 rounded text-white text-[10px]"
                          style={{ backgroundColor: n.subject_color || '#6D28D9' }}
                        >
                          {n.subject_code}
                        </span>
                      )}
                      {n.folder_name && (
                        <span className="px-1.5 py-0.5 rounded bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 text-[10px] font-medium truncate max-w-[90px]">
                          {n.folder_name}
                        </span>
                      )}
                      <span className="truncate">{formatRelativeTime(n.updated_at)}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      {isTrashView ? (
                        <button
                          type="button"
                          onClick={(e) => handleRestore(e, n.id)}
                          className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer"
                          title="Restore note"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => handleDuplicate(e, n.id)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-stone-100 dark:hover:bg-slate-800 cursor-pointer"
                          title="Duplicate note"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => handleTrashOrDelete(e, n)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                        title={isTrashView ? 'Delete permanently' : 'Move to Trash'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 divide-y divide-stone-100 dark:divide-slate-800 overflow-hidden">
            {filteredNotes.map((n) => (
              <div
                key={n.id}
                onClick={() => !isTrashView && onOpenNote(n.id)}
                className="flex items-center gap-4 px-4 py-3 hover:bg-stone-50 dark:hover:bg-slate-800/60 cursor-pointer transition"
              >
                <div className="p-2 rounded-xl bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-300">
                  {renderModeIcon(n.mode)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-slate-900 dark:text-white truncate">{n.title}</div>
                  <div className="text-xs text-slate-400 truncate">
                    {[n.subject_code, n.folder_name, n.notebook_title, `${n.word_count} words`]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </div>
                <span className="text-xs text-slate-400 hidden sm:inline">{formatRelativeTime(n.updated_at)}</span>
                {isTrashView ? (
                  <button
                    type="button"
                    onClick={(e) => handleRestore(e, n.id)}
                    className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold cursor-pointer"
                  >
                    Restore
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => handleToggleStar(e, n)}
                    className={`p-1.5 rounded-lg cursor-pointer ${
                      n.is_starred === 1 ? 'text-amber-500' : 'text-slate-300 hover:text-amber-500'
                    }`}
                  >
                    <Star className="w-4 h-4" fill={n.is_starred === 1 ? 'currentColor' : 'none'} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => handleTrashOrDelete(e, n)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
