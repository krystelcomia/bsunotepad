import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowRight,
  ArrowUpDown,
  BookOpen,
  Check,
  Clock,
  Copy,
  Edit3,
  FileText,
  Folder as FolderIcon,
  FolderOpen,
  FolderPlus,
  LayoutGrid,
  List as ListIcon,
  Mail,
  NotebookPen,
  Paperclip,
  PenTool,
  Pin,
  Plus,
  RotateCcw,
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
import {
  Attachment,
  Folder,
  Notebook,
  Note,
  NoteSortOption,
  Subject,
  WorkspaceSummary,
} from '../../types';
import { formatBytes, formatRelativeTime, parseTags } from '../../utils/format';

interface DashboardViewProps {
  mode: 'dashboard' | 'list';
  title: string;
  subtitle?: string;
  isTrashView?: boolean;
  summary: WorkspaceSummary;
  notes: Note[];
  noteListQuery: string;
  onChangeNoteListQuery: (q: string) => void;
  noteCategoryFilter: string;
  onChangeNoteCategoryFilter: (cat: string) => void;
  noteSort: NoteSortOption;
  onChangeNoteSort: (sort: NoteSortOption) => void;
  onOpenNote: (noteId: string) => void;
  onCreateFromTemplate: (template: string) => void;
  onRefresh: () => void;
  onOpenFiles: () => void;
  onSelectNotebook: (nbId: string) => void;
  onNewFolder: () => void;
  onSelectFolder: (folderId: string) => void;
  onOpenAccount: () => void;
  onOpenAllNotes?: () => void;
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
  if (hour < 12) return 'Magandang umaga';
  if (hour < 18) return 'Magandang hapon';
  return 'Magandang gabi';
}

function getInitials(name?: string): string {
  if (!name) return 'IN';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function getModeLabel(noteMode: Note['mode']): string {
  if (noteMode === 'drawing') return 'Guhit';
  if (noteMode === 'notebook') return 'Kuwaderno';
  return 'Dokumento';
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  mode,
  title,
  subtitle,
  isTrashView = false,
  summary,
  notes,
  noteListQuery,
  onChangeNoteListQuery,
  noteCategoryFilter,
  onChangeNoteCategoryFilter,
  noteSort,
  onChangeNoteSort,
  onOpenNote,
  onCreateFromTemplate,
  onRefresh,
  onOpenFiles,
  onSelectNotebook,
  onNewFolder,
  onSelectFolder,
  onOpenAccount,
  onOpenAllNotes,
  onNotify,
}) => {
  const { user } = useAuth();
  const [viewLayout, setViewLayout] = useState<'grid' | 'list'>('grid');
  const [renamingNoteId, setRenamingNoteId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  // Interaktibong search bar sa Dashboard
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResultsState | null>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  // Mabilisang pag-upload ng file
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

  const categoryOptions = useMemo(() => {
    const base = new Set<string>([
      'Pangkalahatan',
      'Personal',
      'Mga Ideya',
      'Mga Tala',
      'Buod',
      'Gabay',
      'Listahan',
      'Guhit at Sketch',
      'Proyekto',
      'Pananaliksik',
    ]);
    notes.forEach((n) => {
      if (n.category) base.add(n.category);
    });
    return Array.from(base);
  }, [notes]);

  const filteredNotes = useMemo(() => {
    const q = noteListQuery.trim().toLowerCase();
    return notes
      .filter((n) => {
        if (noteCategoryFilter !== 'all' && (n.category || 'Pangkalahatan') !== noteCategoryFilter) return false;
        if (q) {
          const hay = [n.title, n.description, n.excerpt, n.tags_json, n.category, n.folder_name, n.subject_code]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (noteSort === 'title_asc') return a.title.localeCompare(b.title);
        if (noteSort === 'title_desc') return b.title.localeCompare(a.title);
        if (noteSort === 'created_desc') return b.created_at.localeCompare(a.created_at);
        if (noteSort === 'created_asc') return a.created_at.localeCompare(b.created_at);
        if (noteSort === 'updated_asc') return a.updated_at.localeCompare(b.updated_at);
        return b.updated_at.localeCompare(a.updated_at);
      });
  }, [notes, noteCategoryFilter, noteListQuery, noteSort]);

  const startRename = (e: React.MouseEvent, note: Note) => {
    e.stopPropagation();
    setRenamingNoteId(note.id);
    setRenameDraft(note.title);
  };

  const submitRename = async (e: React.SyntheticEvent, noteId: string) => {
    e.stopPropagation();
    const clean = renameDraft.trim() || 'Walang Pamagat na Tala';
    try {
      await api.updateNote(noteId, { title: clean });
      setRenamingNoteId(null);
      onNotify('success', 'Napalitan ang pamagat ng tala');
      onRefresh();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Nabigo ang pagpapalit ng pamagat');
    }
  };

  const handleToggleStar = async (e: React.MouseEvent, note: Note) => {
    e.stopPropagation();
    const nextStarred = note.is_starred === 1 ? 0 : 1;
    try {
      await api.updateNote(note.id, { is_starred: nextStarred });
      onNotify('success', nextStarred === 1 ? 'Idinagdag sa mga Paboritong Tala' : 'Tinanggal sa mga paborito');
      onRefresh();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Nabigong i-update ang paborito');
    }
  };

  const handleDuplicate = async (e: React.MouseEvent, noteId: string) => {
    e.stopPropagation();
    try {
      await api.duplicateNote(noteId);
      onNotify('success', 'Nakopya ang tala');
      onRefresh();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Nabigong kopyahin ang tala');
    }
  };

  const handleTrashOrDelete = async (e: React.MouseEvent, note: Note) => {
    e.stopPropagation();
    try {
      if (isTrashView) {
        if (!window.confirm(`Permanenteng burahin ang "${note.title}"? Hindi na ito maibabalik.`)) return;
        await api.deleteNotePermanent(note.id);
        onNotify('info', 'Permanenteng nabura ang tala');
      } else {
        await api.trashNote(note.id);
        onNotify('info', 'Inilipat sa Basurahan');
      }
      onRefresh();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Nabigo ang pagkilos');
    }
  };

  const handleRestore = async (e: React.MouseEvent, noteId: string) => {
    e.stopPropagation();
    try {
      await api.restoreNote(noteId);
      onNotify('success', 'Naibalik ang tala');
      onRefresh();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Nabigong ibalik ang tala');
    }
  };

  const handleQuickUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingFile(true);
    try {
      await api.uploadFile(file);
      onNotify('success', `Na-upload ang "${file.name}" sa Baul ng File`);
      onRefresh();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Nabigo ang pag-upload');
    } finally {
      setUploadingFile(false);
    }
  };

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

  const firstName = user?.full_name.split(' ')[0] || 'Mag-aaral';

  const renderModeIcon = (noteMode: Note['mode']) => {
    if (noteMode === 'drawing') return <PenTool className="w-3.5 h-3.5" />;
    if (noteMode === 'notebook') return <NotebookPen className="w-3.5 h-3.5" />;
    return <FileText className="w-3.5 h-3.5" />;
  };

  return (
    <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-7">
      {/* Nakatagong input para sa Mabilisang Pag-upload ng File */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleQuickUpload}
      />

      {mode === 'dashboard' ? (
        <>
          {/* Personalized Hero Welcome + Search Bar + Mabilisang Aksyon */}
          <section className="relative rounded-3xl bg-gradient-to-br from-[#0F275C] via-[#1D4ED8] to-[#0284C7] text-white p-6 sm:p-7 shadow-xl shadow-blue-900/15">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-xs text-[11px] font-semibold tracking-wide text-blue-100">
                  <Sparkles className="w-3.5 h-3.5 text-sky-200" />
                  Personal na Talaan sa INKORA
                </div>
                <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight">
                  {getTimeGreeting()}, {firstName}!
                </h1>
                <p className="text-sm text-blue-100/95 max-w-2xl">
                  Handa ka na bang isulat o iguhit ang iyong mga ideya ngayon? Mayroon kang{' '}
                  <span className="font-bold text-white">{summary.stats.totalNotes} mga tala</span> na nakaayos sa{' '}
                  <span className="font-bold text-white">{summary.stats.totalFolders} folder</span> — lahat ng teksto,
                  larawan, guhit, at pag-download ay nasa loob ng iisang dokumento.
                </p>
              </div>

              {/* Interaktibong Live Search Bar */}
              <div ref={searchBoxRef} className="relative w-full lg:w-[400px] shrink-0">
                <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-white/95 dark:bg-[#0D1930] text-slate-900 dark:text-white shadow-lg ring-1 ring-white/30">
                  <Search className="w-4 h-4 text-blue-600 dark:text-sky-400 shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onFocus={() => setSearchFocused(true)}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setSearchFocused(true);
                    }}
                    placeholder="Maghanap ng tala, dokumento, folder, o file..."
                    aria-label="Maghanap sa workspace"
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
                      aria-label="Burahin ang paghahanap"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Live Search Dropdown */}
                {searchFocused && searchQuery.trim().length > 0 && (
                  <div className="absolute left-0 right-0 mt-2 rounded-2xl bg-white dark:bg-[#0D1930] border border-blue-200 dark:border-blue-800 shadow-2xl z-30 max-h-96 overflow-y-auto p-3 text-slate-800 dark:text-slate-100">
                    {searching ? (
                      <div className="py-6 text-center text-xs text-slate-400">Hinahanap sa iyong workspace...</div>
                    ) : searchTotalMatches === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-400">
                        Walang tala, folder, o file na tumugma sa &ldquo;{searchQuery.trim()}&rdquo;.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {searchResults && searchResults.notes.length > 0 && (
                          <div>
                            <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-sky-400">
                              Mga Tala at Dokumento ({searchResults.notes.length})
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
                                  className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-950/60 text-left cursor-pointer"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <span className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-sky-300">
                                      {renderModeIcon(n.mode)}
                                    </span>
                                    <div className="min-w-0">
                                      <div className="text-xs font-semibold truncate">{n.title}</div>
                                      <div className="text-[10px] text-slate-400 truncate">
                                        {[getModeLabel(n.mode), n.folder_name, formatRelativeTime(n.updated_at)]
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
                              Mga Folder ({searchResults.folders.length})
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
                                  className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-950/60 text-left cursor-pointer"
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
                            <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                              Mga Kuwaderno ({searchResults.notebooks.length})
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
                                  className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-950/60 text-left cursor-pointer"
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
                              Mga File ({searchResults.files.length})
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

            {/* Mabilisang Aksyon sa Personal na Talaan */}
            <div className="mt-6 pt-5 border-t border-white/15">
              <div className="text-[11px] font-bold uppercase tracking-wider text-blue-100 mb-3">
                Mabilisang Aksyon
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => onCreateFromTemplate('blank')}
                  className="flex items-center gap-3 p-3.5 rounded-2xl bg-white text-blue-950 hover:bg-blue-50 shadow-md text-left transition cursor-pointer group"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                    <Plus className="w-5 h-5 text-blue-700" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold truncate">Gumawa ng Bagong Tala</div>
                    <div className="text-[11px] text-blue-700/80 truncate">Teksto, larawan, guhit at download</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={onNewFolder}
                  className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/12 hover:bg-white/22 backdrop-blur-xs border border-white/15 text-left transition cursor-pointer group"
                >
                  <div className="w-10 h-10 rounded-xl bg-cyan-300/25 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                    <FolderPlus className="w-5 h-5 text-cyan-100" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">Gumawa ng Folder</div>
                    <div className="text-[11px] text-blue-100 truncate">Ayusin ang iyong mga tala</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingFile}
                  className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/12 hover:bg-white/22 backdrop-blur-xs border border-white/15 text-left transition cursor-pointer group disabled:opacity-70"
                >
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                    <Upload className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">
                      {uploadingFile ? 'Ina-upload...' : 'Mag-upload ng File'}
                    </div>
                    <div className="text-[11px] text-blue-100 truncate">PDF, DOCX, larawan</div>
                  </div>
                </button>
              </div>
            </div>
          </section>

          {/* Impormasyon ng Profile + Kabuuang Sukatan + Pangkalahatang Aktibidad */}
          <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Kard ng Impormasyon ng Mag-aaral */}
            <div className="rounded-2xl bg-white dark:bg-[#0D1930] border border-blue-200/80 dark:border-blue-800/70 p-5 shadow-xs flex flex-col justify-between gap-5">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3.5 min-w-0">
                    {user?.avatar_file ? (
                      <img
                        src={`/api/account/avatar/${user.id}/${user.avatar_file}`}
                        alt={user.full_name}
                        className="w-14 h-14 rounded-2xl object-cover border-2 border-blue-200 dark:border-blue-800 shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-700 via-blue-600 to-sky-500 text-white font-display font-extrabold text-lg flex items-center justify-center shadow-md shrink-0">
                        {getInitials(user?.full_name)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h2 className="font-display font-bold text-base text-slate-900 dark:text-white truncate">
                        {user?.full_name || 'Profile ng Mag-aaral'}
                      </h2>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        <Mail className="w-3.5 h-3.5 text-blue-600 dark:text-sky-400 shrink-0" />
                        <span className="truncate">{user?.email}</span>
                      </div>
                      <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                        <ShieldCheck className="w-3 h-3" /> Beripikadong Gmail Account
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenAccount}
                    className="p-2 rounded-xl border border-blue-200 dark:border-blue-800 text-slate-500 hover:text-blue-700 hover:border-blue-400 dark:hover:text-sky-300 transition cursor-pointer shrink-0"
                    title="I-edit ang profile at kagustuhan"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                </div>

                {/* Detalye ng Akademikong Profile */}
                <div className="mt-4 pt-4 border-t border-blue-100 dark:border-blue-900/60 space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">Unibersidad</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200 text-right truncate">
                      {user?.university || 'Magdagdag ng unibersidad'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">Programa / Kurso</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200 text-right truncate">
                      {user?.major || 'Pangkalahatang Pag-aaral'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">Antas / Taon</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200 text-right truncate">
                      {user?.academic_year || 'Mag-aaral'}
                    </span>
                  </div>
                </div>

                {user?.bio && (
                  <p className="mt-3 text-xs text-slate-500 dark:text-blue-200/80 bg-blue-50/70 dark:bg-[#132340] rounded-xl p-3 italic line-clamp-2">
                    &ldquo;{user.bio}&rdquo;
                  </p>
                )}
              </div>

              {/* Bar ng Espasyo sa Storage */}
              <div className="pt-3 border-t border-blue-100 dark:border-blue-900/60">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-semibold text-slate-600 dark:text-slate-300">Espasyo sa Baul ng File</span>
                  <button
                    type="button"
                    onClick={onOpenFiles}
                    className="text-blue-600 dark:text-sky-400 font-semibold hover:underline cursor-pointer"
                  >
                    Pamahalaan ({summary.stats.totalFiles} file)
                  </button>
                </div>
                <div className="h-2 rounded-full bg-blue-100 dark:bg-blue-950 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-700 via-blue-600 to-sky-400 transition-all"
                    style={{ width: `${Math.max(4, storagePct)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1.5">
                  <span>{formatBytes(summary.stats.storageUsedBytes)} nagamit</span>
                  <span>{formatBytes(summary.stats.storageQuotaBytes)} limitasyon</span>
                </div>
              </div>
            </div>

            {/* Kanang 2 Kolum: Mga KPI at 7-Araw na Pangkalahatang Aktibidad */}
            <div className="xl:col-span-2 flex flex-col gap-5">
              {/* 4 Pangunahing Kard ng Sukatan */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <div className="p-4 rounded-2xl bg-white dark:bg-[#0D1930] border border-blue-200/80 dark:border-blue-800/70 shadow-xs">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <span>Kabuuang Tala</span>
                    <NotebookPen className="w-4 h-4 text-blue-600 dark:text-sky-400" />
                  </div>
                  <div className="font-display text-2xl font-extrabold text-slate-900 dark:text-white mt-1.5">
                    {summary.stats.totalNotes}
                  </div>
                  <div className="text-[11px] text-blue-600 dark:text-sky-400 mt-1 font-medium">
                    Personal na mga tala
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-[#0D1930] border border-blue-200/80 dark:border-blue-800/70 shadow-xs">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <span>Naisulat na Salita</span>
                    <FileText className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                  </div>
                  <div className="font-display text-2xl font-extrabold text-slate-900 dark:text-white mt-1.5">
                    {summary.activityOverview.totalWords.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-blue-700 dark:text-blue-400 mt-1 font-medium">
                    Sa lahat ng iyong tala
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-[#0D1930] border border-blue-200/80 dark:border-blue-800/70 shadow-xs">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <span>Paborito at Folder</span>
                    <Star className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="font-display text-2xl font-extrabold text-slate-900 dark:text-white mt-1.5">
                    {summary.stats.favoriteCount}
                  </div>
                  <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 font-medium">
                    May bituin · {summary.stats.totalFolders} folder
                  </div>
                </div>

                <div
                  onClick={onOpenFiles}
                  className="p-4 rounded-2xl bg-white dark:bg-[#0D1930] border border-blue-200/80 dark:border-blue-800/70 shadow-xs cursor-pointer hover:border-blue-400 transition"
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <span>Baul ng File</span>
                    <Paperclip className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  </div>
                  <div className="font-display text-2xl font-extrabold text-slate-900 dark:text-white mt-1.5">
                    {summary.stats.totalFiles}
                  </div>
                  <div className="text-[11px] text-sky-600 dark:text-sky-400 mt-1 font-medium">
                    {summary.notebooks.length} kuwaderno · {formatBytes(summary.stats.storageUsedBytes)}
                  </div>
                </div>
              </div>

              {/* 7-Araw na Tsart ng Aktibidad */}
              <div className="flex-1 rounded-2xl bg-white dark:bg-[#0D1930] border border-blue-200/80 dark:border-blue-800/70 p-5 shadow-xs flex flex-col justify-between">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-blue-600 dark:text-sky-400" />
                      <h2 className="font-display font-bold text-sm text-slate-900 dark:text-white">
                        Pangkalahatang Aktibidad (Huling 7 Araw)
                      </h2>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Araw-araw na ginawang tala at na-edit sa iyong personal na talaan
                    </p>
                  </div>

                  <div className="flex items-center gap-4 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-blue-700" />
                      Nalikha ({summary.activityOverview.notesCreatedWeek})
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-sky-400" />
                      Na-edit ({summary.activityOverview.notesEditedWeek})
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
                                ? 'bg-blue-700 group-hover:bg-blue-600'
                                : 'bg-blue-100 dark:bg-blue-950/60'
                            }`}
                            style={{ height: `${createdPct}%` }}
                            title={`${day.label}: ${day.notesCreated} nalikha`}
                          />
                          <div
                            className={`w-2.5 sm:w-3.5 rounded-t-md transition-all ${
                              day.notesEdited > 0
                                ? 'bg-sky-400 group-hover:bg-sky-300'
                                : 'bg-blue-50 dark:bg-blue-950/40'
                            }`}
                            style={{ height: `${editedPct}%` }}
                            title={`${day.label}: ${day.notesEdited} na-edit · ${day.studyMinutes}m pag-aaral`}
                          />
                        </div>
                        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                          {day.label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Pang-ibabang Buod ng Aktibidad */}
                <div className="mt-4 pt-3 border-t border-blue-100 dark:border-blue-900/60 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span>
                    Kabuuang salitang naisulat:{' '}
                    <strong className="text-slate-800 dark:text-slate-200">
                      {summary.activityOverview.totalWords.toLocaleString()}
                    </strong>
                  </span>
                  {onOpenAllNotes && (
                    <button
                      type="button"
                      onClick={onOpenAllNotes}
                      className="text-xs font-semibold text-blue-600 dark:text-sky-400 hover:underline cursor-pointer"
                    >
                      Tingnan ang Lahat ng Tala &rarr;
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Mga Kamakailang Binuksang Tala at Kamakailang Na-edit na Dokumento */}
          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Mga Kamakailang Binuksang Tala */}
            <div className="rounded-2xl bg-white dark:bg-[#0D1930] border border-blue-200/80 dark:border-blue-800/70 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600 dark:text-sky-400" />
                  <h2 className="font-display font-bold text-sm text-slate-900 dark:text-white">
                    Mga Kamakailang Binuksang Tala
                  </h2>
                </div>
                <span className="text-[11px] text-slate-400 font-medium">
                  {summary.recentlyOpenedNotes.length} kamakailan
                </span>
              </div>

              {summary.recentlyOpenedNotes.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400 border border-dashed border-blue-200 dark:border-blue-800 rounded-xl">
                  Magbukas o gumawa ng tala upang makita rito ang iyong kamakailang kasaysayan.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {summary.recentlyOpenedNotes.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => onOpenNote(n.id)}
                      className="flex items-center justify-between gap-3 p-3 rounded-xl border border-blue-100 dark:border-blue-900/50 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50/50 dark:hover:bg-[#132340] transition cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`p-2 rounded-xl shrink-0 ${
                            n.mode === 'drawing'
                              ? 'bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-300'
                              : n.mode === 'notebook'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                                : 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300'
                          }`}
                        >
                          {renderModeIcon(n.mode)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-sm text-slate-900 dark:text-white truncate group-hover:text-blue-700 dark:group-hover:text-sky-300">
                            {n.title}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                            <span>{getModeLabel(n.mode)}</span>
                            {n.folder_name && <span>· {n.folder_name}</span>}
                            <span>· Binuksan {formatRelativeTime(n.last_opened_at || n.updated_at)}</span>
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
                        title={n.is_starred === 1 ? 'Tanggalin sa paborito' : 'Idagdag sa mga paborito'}
                      >
                        <Star className="w-4 h-4" fill={n.is_starred === 1 ? 'currentColor' : 'none'} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Mga Kamakailang Na-edit na Dokumento */}
            <div className="rounded-2xl bg-white dark:bg-[#0D1930] border border-blue-200/80 dark:border-blue-800/70 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600 dark:text-sky-400" />
                  <h2 className="font-display font-bold text-sm text-slate-900 dark:text-white">
                    Mga Kamakailang Na-edit na Dokumento
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => onCreateFromTemplate('blank')}
                  className="text-xs font-semibold text-blue-600 dark:text-sky-400 hover:underline cursor-pointer"
                >
                  + Bagong Dokumento
                </button>
              </div>

              {summary.recentlyEditedDocuments.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400 border border-dashed border-blue-200 dark:border-blue-800 rounded-xl">
                  Wala pang dokumentong Word. Pindutin ang &ldquo;Gumawa ng Dokumento&rdquo; sa itaas upang simulan!
                </div>
              ) : (
                <div className="space-y-2.5">
                  {summary.recentlyEditedDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      onClick={() => onOpenNote(doc.id)}
                      className="flex items-center justify-between gap-3 p-3 rounded-xl border border-blue-100 dark:border-blue-900/50 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50/50 dark:hover:bg-[#132340] transition cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-sky-300 shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-sm text-slate-900 dark:text-white truncate group-hover:text-blue-700 dark:group-hover:text-sky-300">
                            {doc.title}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate mt-0.5">
                            {doc.word_count} salita · Na-edit {formatRelativeTime(doc.updated_at)}
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
                        title={doc.is_starred === 1 ? 'Tanggalin sa paborito' : 'Idagdag sa mga paborito'}
                      >
                        <Star className="w-4 h-4" fill={doc.is_starred === 1 ? 'currentColor' : 'none'} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Mga Paboritong Tala at Kamakailang Ginamit na Folder */}
          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Mga Paboritong Tala */}
            <div className="rounded-2xl bg-white dark:bg-[#0D1930] border border-blue-200/80 dark:border-blue-800/70 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-500" fill="currentColor" />
                  <h2 className="font-display font-bold text-sm text-slate-900 dark:text-white">
                    Mga Paboritong Tala
                  </h2>
                </div>
                <span className="text-[11px] text-slate-400 font-medium">
                  {summary.stats.favoriteCount} may bituin
                </span>
              </div>

              {summary.favoriteNotes.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400 border border-dashed border-blue-200 dark:border-blue-800 rounded-xl">
                  Lagyan ng bituin ang mahahalagang tala upang madali itong mahanap dito.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {summary.favoriteNotes.map((fav) => (
                    <div
                      key={fav.id}
                      onClick={() => onOpenNote(fav.id)}
                      className="p-3.5 rounded-xl border border-blue-200/70 dark:border-blue-800/60 bg-blue-50/50 dark:bg-[#132340] hover:border-blue-400 transition cursor-pointer group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-xs text-slate-900 dark:text-white line-clamp-1 group-hover:text-blue-700 dark:group-hover:text-sky-300">
                          {fav.title}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleToggleStar(e, fav)}
                          className="text-amber-500 hover:text-amber-600 cursor-pointer shrink-0"
                          title="Alisin ang bituin"
                        >
                          <Star className="w-3.5 h-3.5" fill="currentColor" />
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-1">
                        {fav.excerpt || `${getModeLabel(fav.mode)} · ${fav.word_count} salita`}
                      </p>
                      <div className="mt-2 text-[10px] text-slate-400 flex items-center justify-between">
                        <span>{getModeLabel(fav.mode)}</span>
                        <span>{formatRelativeTime(fav.updated_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Mga Kamakailang Ginamit na Folder */}
            <div className="rounded-2xl bg-white dark:bg-[#0D1930] border border-blue-200/80 dark:border-blue-800/70 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-blue-600 dark:text-sky-400" />
                  <h2 className="font-display font-bold text-sm text-slate-900 dark:text-white">
                    Mga Kamakailang Ginamit na Folder
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={onNewFolder}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-sky-400 hover:underline cursor-pointer"
                >
                  <FolderPlus className="w-3.5 h-3.5" /> Bagong Folder
                </button>
              </div>

              {summary.recentlyUsedFolders.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400 border border-dashed border-blue-200 dark:border-blue-800 rounded-xl">
                  Gumawa ng mga folder upang isaayos ang iyong mga personal na tala at ideya.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {summary.recentlyUsedFolders.map((fld) => (
                    <button
                      key={fld.id}
                      type="button"
                      onClick={() => onSelectFolder(fld.id)}
                      className="flex items-center gap-3 p-3.5 rounded-xl border border-blue-100 dark:border-blue-800/70 hover:border-blue-400 hover:shadow-xs text-left transition cursor-pointer group"
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${fld.color}20` }}
                      >
                        <FolderIcon className="w-5 h-5" style={{ color: fld.color }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-xs text-slate-900 dark:text-white truncate group-hover:text-blue-700 dark:group-hover:text-sky-300">
                          {fld.name}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                          {fld.note_count ?? 0} tala ·{' '}
                          {formatRelativeTime(fld.last_used_at || fld.updated_at)}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Iyong mga Kuwaderno */}
          {summary.notebooks.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Iyong mga Kuwaderno
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {summary.notebooks.slice(0, 6).map((nb: Notebook) => (
                  <button
                    key={nb.id}
                    type="button"
                    onClick={() => onSelectNotebook(nb.id)}
                    className="text-left rounded-2xl bg-white dark:bg-[#0D1930] border border-blue-200/80 dark:border-blue-800/70 overflow-hidden hover:shadow-md transition group cursor-pointer"
                  >
                    <div className="h-3 w-full" style={{ backgroundColor: nb.cover_color }} />
                    <div className="p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-display font-bold text-sm text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-sky-300">
                          {nb.title}
                        </span>
                        {nb.is_pinned === 1 && <Pin className="w-3.5 h-3.5 text-blue-600 dark:text-sky-400 shrink-0" />}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1 min-h-[32px]">
                        {nb.description || 'Personal na kuwaderno'}
                      </p>
                      <div className="mt-3 pt-2.5 border-t border-blue-100 dark:border-blue-900/60 flex items-center justify-between text-[11px] text-slate-400">
                        <span>Kuwaderno</span>
                        <span className="font-semibold text-slate-600 dark:text-slate-300">
                          {nb.note_count ?? 0} pahina
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        /* Naka-filter na Listahan ng mga Tala / Header ng Basurahan */
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {title}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {subtitle || `${filteredNotes.length} aytem`}
            </p>
          </div>

          {!isTrashView && (
            <button
              type="button"
              onClick={() => onCreateFromTemplate('blank')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-800 via-blue-700 to-sky-600 hover:brightness-110 text-white text-sm font-semibold shadow-md shadow-blue-700/20 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Gumawa ng Tala
            </button>
          )}
        </div>
      )}

      {/* Grid / Listahan ng mga Tala sa Workspace */}
      <section>
        <div className="flex flex-col gap-3 mb-4">
          {mode === 'dashboard' && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <h2 className="font-display text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Lahat ng Tala at Pahina
                </h2>
                {onOpenAllNotes && (
                  <button
                    type="button"
                    onClick={onOpenAllNotes}
                    className="text-xs font-semibold text-blue-600 dark:text-sky-400 hover:underline cursor-pointer"
                  >
                    Buksan ang Aklatan &rarr;
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1 bg-white dark:bg-[#0D1930] border border-blue-200/80 dark:border-blue-800/70 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setViewLayout('grid')}
                  className={`p-1.5 rounded-lg cursor-pointer ${
                    viewLayout === 'grid' ? 'bg-blue-50 dark:bg-[#132340] text-blue-600 dark:text-sky-400' : 'text-slate-400'
                  }`}
                  title="Grid view"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewLayout('list')}
                  className={`p-1.5 rounded-lg cursor-pointer ${
                    viewLayout === 'list' ? 'bg-blue-50 dark:bg-[#132340] text-blue-600 dark:text-sky-400' : 'text-slate-400'
                  }`}
                  title="List view"
                >
                  <ListIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Maghanap ayon sa Pamagat/Nilalaman + Salain sa Kategorya + Ayusin */}
          <div className="flex flex-wrap items-center gap-2.5 p-2.5 rounded-2xl bg-white dark:bg-[#0D1930] border border-blue-200/80 dark:border-blue-800/70">
            <div className="flex-1 min-w-[200px] flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-50/60 dark:bg-[#132340] border border-blue-200/80 dark:border-blue-800">
              <Search className="w-3.5 h-3.5 text-blue-600 dark:text-sky-400 shrink-0" />
              <input
                type="text"
                value={noteListQuery}
                onChange={(e) => onChangeNoteListQuery(e.target.value)}
                placeholder="Maghanap ng tala sa pamagat, nilalaman, paglalarawan, o tag..."
                className="w-full bg-transparent text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
              />
              {noteListQuery && (
                <button
                  type="button"
                  onClick={() => onChangeNoteListQuery('')}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                  aria-label="Burahin ang filter"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400 font-medium hidden sm:inline">Kategorya:</span>
              <select
                value={noteCategoryFilter}
                onChange={(e) => onChangeNoteCategoryFilter(e.target.value)}
                aria-label="Salain ang mga tala ayon sa kategorya"
                className="px-2.5 py-1.5 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-[#132340] text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                <option value="all">Lahat ng Kategorya</option>
                {categoryOptions.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <ArrowUpDown className="w-3.5 h-3.5 text-blue-600 dark:text-sky-400 shrink-0" />
              <select
                value={noteSort}
                onChange={(e) => onChangeNoteSort(e.target.value as NoteSortOption)}
                aria-label="Ayusin ang mga tala"
                className="px-2.5 py-1.5 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-[#132340] text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                <option value="updated_desc">Huling Binago (Pinakabago)</option>
                <option value="updated_asc">Huling Binago (Pinakaluma)</option>
                <option value="created_desc">Petsa ng Paggawa (Pinakabago)</option>
                <option value="created_asc">Petsa ng Paggawa (Pinakaluma)</option>
                <option value="title_asc">Alpabetikal (A → Z)</option>
                <option value="title_desc">Alpabetikal (Z → A)</option>
              </select>
            </div>

            {mode !== 'dashboard' && (
              <div className="flex items-center gap-1 bg-blue-50/50 dark:bg-[#132340] border border-blue-200/80 dark:border-blue-800/70 p-0.5 rounded-xl">
                <button
                  type="button"
                  onClick={() => setViewLayout('grid')}
                  className={`p-1.5 rounded-lg cursor-pointer ${
                    viewLayout === 'grid' ? 'bg-white dark:bg-[#0D1930] text-blue-600 dark:text-sky-400 shadow-xs' : 'text-slate-400'
                  }`}
                  title="Grid view"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewLayout('list')}
                  className={`p-1.5 rounded-lg cursor-pointer ${
                    viewLayout === 'list' ? 'bg-white dark:bg-[#0D1930] text-blue-600 dark:text-sky-400 shadow-xs' : 'text-slate-400'
                  }`}
                  title="List view"
                >
                  <ListIcon className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {filteredNotes.length === 0 ? (
          <div className="rounded-2xl bg-white dark:bg-[#0D1930] border border-dashed border-blue-300 dark:border-blue-800 p-12 text-center">
            <NotebookPen className="w-10 h-10 text-blue-300 dark:text-blue-700 mx-auto mb-3" />
            <h3 className="font-display font-bold text-slate-800 dark:text-white">
              {isTrashView ? 'Walang laman ang Basurahan' : 'Wala pang nahanap na tala'}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {isTrashView
                ? 'Lumilitaw rito ang mga binurang tala bago tuluyang mabura.'
                : noteListQuery || noteCategoryFilter !== 'all'
                  ? 'Subukang burahin ang iyong hinahanap o ang napiling kategorya.'
                  : 'Gumawa ng bagong tala upang magsulat, magsingit ng larawan, gumuhit, at mag-download ng file.'}
            </p>
          </div>
        ) : viewLayout === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredNotes.map((n) => {
              const tags = parseTags(n.tags_json);
              const isRenaming = renamingNoteId === n.id;
              return (
                <div
                  key={n.id}
                  onClick={() => !isTrashView && !isRenaming && onOpenNote(n.id)}
                  className={`group rounded-2xl bg-white dark:bg-[#0D1930] border border-blue-200/80 dark:border-blue-800/70 p-5 flex flex-col justify-between transition ${
                    isTrashView ? '' : 'cursor-pointer hover:border-blue-400 hover:shadow-lg hover:shadow-blue-900/5'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                            n.mode === 'drawing'
                              ? 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300'
                              : n.mode === 'notebook'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-200'
                                : 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-sky-300'
                          }`}
                        >
                          {renderModeIcon(n.mode)}
                          {getModeLabel(n.mode)}
                        </span>
                        {n.category && n.category !== 'Pangkalahatan' && n.category !== 'General' && (
                          <span className="px-2 py-0.5 rounded-md bg-blue-50/70 dark:bg-[#132340] text-slate-600 dark:text-slate-300 text-[10px] font-semibold">
                            {n.category}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {n.paper_bg_color && (
                          <span
                            className="w-3 h-3 rounded-full border border-blue-200 dark:border-blue-700"
                            style={{ backgroundColor: n.paper_bg_color }}
                            title="Kulay ng papel"
                          />
                        )}
                        {n.is_pinned === 1 && <Pin className="w-3.5 h-3.5 text-blue-600 dark:text-sky-400" />}
                        {!isTrashView && (
                          <button
                            type="button"
                            onClick={(e) => handleToggleStar(e, n)}
                            className={`p-1 rounded-md transition cursor-pointer ${
                              n.is_starred === 1
                                ? 'text-amber-500'
                                : 'text-slate-300 group-hover:text-amber-500'
                            }`}
                            title={n.is_starred === 1 ? 'Tanggalin sa mga paborito' : 'Lagyan ng bituin'}
                          >
                            <Star className="w-3.5 h-3.5" fill={n.is_starred === 1 ? 'currentColor' : 'none'} />
                          </button>
                        )}
                      </div>
                    </div>

                    {isRenaming ? (
                      <div
                        className="flex items-center gap-1.5 mb-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          autoFocus
                          type="text"
                          value={renameDraft}
                          onChange={(e) => setRenameDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') submitRename(e, n.id);
                            if (e.key === 'Escape') setRenamingNoteId(null);
                          }}
                          className="flex-1 px-2.5 py-1 text-sm font-bold rounded-lg border border-blue-400 bg-white dark:bg-[#132340] text-slate-900 dark:text-white focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={(e) => submitRename(e, n.id)}
                          className="p-1.5 rounded-lg bg-blue-700 text-white cursor-pointer"
                          title="I-save ang pangalan"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRenamingNoteId(null);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
                          title="Kanselahin"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <h3 className="font-display font-bold text-base text-slate-900 dark:text-white group-hover:text-blue-700 dark:group-hover:text-sky-300 transition line-clamp-2">
                        {n.title}
                      </h3>
                    )}

                    {n.drawing_preview ? (
                      <div className="mt-3 rounded-xl border border-blue-100 dark:border-blue-800 overflow-hidden bg-blue-50/40 h-28 flex items-center justify-center">
                        <img
                          src={n.drawing_preview}
                          alt={n.title}
                          className="w-full h-full object-contain"
                        />
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 line-clamp-3 leading-relaxed">
                        {n.description || n.excerpt || 'Blankong pahina — pindutin upang buksan ang studio at magsimulang magsulat o gumuhit.'}
                      </p>
                    )}

                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {tags.slice(0, 3).map((t) => (
                          <span
                            key={t}
                            className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-[#132340] text-blue-700 dark:text-blue-200"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-blue-100 dark:border-blue-900/60 flex items-center justify-between text-[11px] text-slate-400">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {n.subject_code && (
                        <span
                          className="font-bold px-1.5 py-0.5 rounded text-white text-[10px]"
                          style={{ backgroundColor: n.subject_color || '#2563EB' }}
                        >
                          {n.subject_code}
                        </span>
                      )}
                      {n.folder_name && (
                        <span className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-sky-300 text-[10px] font-medium truncate max-w-[90px]">
                          {n.folder_name}
                        </span>
                      )}
                      <span className="truncate">{formatRelativeTime(n.updated_at)}</span>
                    </div>

                    <div className="flex items-center gap-0.5">
                      {isTrashView ? (
                        <button
                          type="button"
                          onClick={(e) => handleRestore(e, n.id)}
                          className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer"
                          title="Ibalik ang tala"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={(e) => startRename(e, n)}
                            className="opacity-70 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 cursor-pointer"
                            title="Palitan ang pamagat"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDuplicate(e, n.id)}
                            className="opacity-70 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 cursor-pointer"
                            title="Kopyahin ang tala"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={(e) => handleTrashOrDelete(e, n)}
                        className="opacity-70 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                        title={isTrashView ? 'Burahin nang permanente' : 'Ilipat sa Basurahan'}
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
          <div className="rounded-2xl bg-white dark:bg-[#0D1930] border border-blue-200/80 dark:border-blue-800/70 divide-y divide-blue-100 dark:divide-blue-900/60 overflow-hidden">
            {filteredNotes.map((n) => {
              const isRenaming = renamingNoteId === n.id;
              return (
                <div
                  key={n.id}
                  onClick={() => !isTrashView && !isRenaming && onOpenNote(n.id)}
                  className="flex items-center gap-3 sm:gap-4 px-4 py-3 hover:bg-blue-50/50 dark:hover:bg-[#132340] cursor-pointer transition"
                >
                  <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-sky-300 shrink-0">
                    {renderModeIcon(n.mode)}
                  </div>
                  <div className="flex-1 min-w-0">
                    {isRenaming ? (
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          autoFocus
                          type="text"
                          value={renameDraft}
                          onChange={(e) => setRenameDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') submitRename(e, n.id);
                            if (e.key === 'Escape') setRenamingNoteId(null);
                          }}
                          className="flex-1 px-2 py-1 text-sm font-semibold rounded-lg border border-blue-400 bg-white dark:bg-[#132340] focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={(e) => submitRename(e, n.id)}
                          className="p-1 rounded-lg bg-blue-700 text-white cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="font-semibold text-sm text-slate-900 dark:text-white truncate">{n.title}</div>
                    )}
                    <div className="text-xs text-slate-400 truncate">
                      {[n.category, n.subject_code, n.folder_name, n.notebook_title, `${n.word_count} salita`]
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
                      Ibalik
                    </button>
                  ) : (
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={(e) => startRename(e, n)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 cursor-pointer"
                        title="Palitan ang pamagat"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDuplicate(e, n.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 cursor-pointer"
                        title="Kopyahin ang tala"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleToggleStar(e, n)}
                        className={`p-1.5 rounded-lg cursor-pointer ${
                          n.is_starred === 1 ? 'text-amber-500' : 'text-slate-300 hover:text-amber-500'
                        }`}
                        title="Paboritong tala"
                      >
                        <Star className="w-4 h-4" fill={n.is_starred === 1 ? 'currentColor' : 'none'} />
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={(e) => handleTrashOrDelete(e, n)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 cursor-pointer"
                    title={isTrashView ? 'Burahin nang permanente' : 'Ilipat sa Basurahan'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
