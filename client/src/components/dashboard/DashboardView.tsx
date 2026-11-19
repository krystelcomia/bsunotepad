import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Circle,
  Copy,
  FileText,
  FlaskConical,
  GraduationCap,
  LayoutGrid,
  List as ListIcon,
  NotebookPen,
  PenTool,
  Pin,
  Plus,
  RotateCcw,
  ScrollText,
  Star,
  Trash2,
} from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Notebook, Note, StudyTask, WorkspaceSummary } from '../../types';
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
  onNotify: (type: 'success' | 'error' | 'info', text: string) => void;
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
  onNotify,
}) => {
  const { user } = useAuth();
  const [viewLayout, setViewLayout] = useState<'grid' | 'list'>('grid');
  const [typeFilter, setTypeFilter] = useState<'all' | 'document' | 'notebook' | 'drawing'>('all');

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

  const templates = [
    { id: 'blank', title: 'Word Document', desc: 'A4 rich text & tables', icon: <FileText className="w-5 h-5 text-indigo-600" />, bg: 'bg-indigo-50 dark:bg-indigo-950/50' },
    { id: 'cornell', title: 'Cornell Lecture', desc: 'Cues, notes & summary', icon: <NotebookPen className="w-5 h-5 text-rose-600" />, bg: 'bg-rose-50 dark:bg-rose-950/50' },
    { id: 'lined-notebook', title: 'Ruled + Ink', desc: 'Traditional paper + pen', icon: <BookOpen className="w-5 h-5 text-amber-600" />, bg: 'bg-amber-50 dark:bg-amber-950/50' },
    { id: 'lab-report', title: 'Lab Report', desc: 'Data tables & hypothesis', icon: <FlaskConical className="w-5 h-5 text-emerald-600" />, bg: 'bg-emerald-50 dark:bg-emerald-950/50' },
    { id: 'essay', title: 'Essay Outline', desc: 'Thesis & works cited', icon: <ScrollText className="w-5 h-5 text-violet-600" />, bg: 'bg-violet-50 dark:bg-violet-950/50' },
    { id: 'sketchpad', title: 'Drawing Pad', desc: 'Diagrams & freehand', icon: <PenTool className="w-5 h-5 text-sky-600" />, bg: 'bg-sky-50 dark:bg-sky-950/50' },
  ];

  const storagePct = Math.min(
    100,
    Math.round((summary.stats.storageUsedBytes / (summary.stats.storageQuotaBytes || 1)) * 100)
  );

  return (
    <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {mode === 'dashboard'
              ? `Welcome back, ${user?.full_name.split(' ')[0] || 'Scholar'}`
              : title}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {mode === 'dashboard'
              ? [user?.university, user?.major, user?.academic_year].filter(Boolean).join(' · ') ||
                'Your unified academic desk for documents, notebooks, and diagrams.'
              : subtitle || `${filteredNotes.length} item(s)`}
          </p>
        </div>

        {!isTrashView && (
          <button
            type="button"
            onClick={() => onCreateFromTemplate('blank')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-sm shadow-indigo-600/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Create Note
          </button>
        )}
      </div>

      {/* Dashboard Stats + Templates + Tasks */}
      {mode === 'dashboard' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 shadow-xs">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Active Notes</div>
              <div className="font-display text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
                {notes.length}
              </div>
              <div className="text-[11px] text-indigo-600 dark:text-indigo-400 mt-1 font-medium">
                Across {summary.notebooks.length} notebooks
              </div>
            </div>

            <div
              onClick={onOpenStudyHub}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 shadow-xs cursor-pointer hover:border-indigo-300 transition"
            >
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Focus This Week</div>
              <div className="font-display text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
                {summary.stats.studyMinutesWeek}m
              </div>
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
                {summary.stats.flashcardCount} flashcards ready
              </div>
            </div>

            <div
              onClick={onOpenStudyHub}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 shadow-xs cursor-pointer hover:border-indigo-300 transition"
            >
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Upcoming Tasks</div>
              <div className="font-display text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
                {summary.upcomingTasks.length}
              </div>
              <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 font-medium">
                Click to manage deadlines
              </div>
            </div>

            <div
              onClick={onOpenFiles}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 shadow-xs cursor-pointer hover:border-indigo-300 transition"
            >
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">File Vault</div>
              <div className="font-display text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
                {formatBytes(summary.stats.storageUsedBytes)}
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-stone-200 dark:bg-slate-800 overflow-hidden">
                <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${Math.max(3, storagePct)}%` }} />
              </div>
            </div>
          </div>

          {/* Quick Templates */}
          <div>
            <h2 className="font-display text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
              Start From Studio Template
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
              {templates.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => onCreateFromTemplate(tpl.id)}
                  className="text-left p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 hover:border-indigo-400 hover:shadow-md transition group cursor-pointer"
                >
                  <div className={`w-10 h-10 rounded-xl ${tpl.bg} flex items-center justify-center mb-2.5 group-hover:scale-105 transition`}>
                    {tpl.icon}
                  </div>
                  <div className="font-semibold text-xs text-slate-900 dark:text-white">{tpl.title}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{tpl.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Notebooks Shelf + Upcoming Assignments */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
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
                        <span className="font-display font-bold text-sm text-slate-900 dark:text-white truncate group-hover:text-indigo-600">
                          {nb.title}
                        </span>
                        {nb.is_pinned === 1 && <Pin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />}
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
                  className="text-xs font-semibold text-indigo-600 hover:underline cursor-pointer"
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
                                className="font-bold px-1.5 py-0.2 rounded text-white text-[10px]"
                                style={{ backgroundColor: t.subject_color || '#4F46E5' }}
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
          </div>
        </>
      )}

      {/* Notes Section */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
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
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setViewLayout('grid')}
              className={`p-1.5 rounded-lg cursor-pointer ${
                viewLayout === 'grid' ? 'bg-stone-100 dark:bg-slate-800 text-indigo-600' : 'text-slate-400'
              }`}
              title="Grid view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewLayout('list')}
              className={`p-1.5 rounded-lg cursor-pointer ${
                viewLayout === 'list' ? 'bg-stone-100 dark:bg-slate-800 text-indigo-600' : 'text-slate-400'
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
                    isTrashView ? '' : 'cursor-pointer hover:border-indigo-400 hover:shadow-lg hover:shadow-indigo-900/5'
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
                              : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                        }`}
                      >
                        {n.mode === 'drawing' ? (
                          <PenTool className="w-3 h-3" />
                        ) : n.mode === 'notebook' ? (
                          <NotebookPen className="w-3 h-3" />
                        ) : (
                          <FileText className="w-3 h-3" />
                        )}
                        {n.mode}
                      </span>

                      <div className="flex items-center gap-1">
                        {n.is_pinned === 1 && <Pin className="w-3.5 h-3.5 text-indigo-500" />}
                        {n.is_starred === 1 && <Star className="w-3.5 h-3.5 text-amber-500" fill="currentColor" />}
                      </div>
                    </div>

                    <h3 className="font-display font-bold text-base text-slate-900 dark:text-white group-hover:text-indigo-600 transition line-clamp-2">
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

                  <div className="mt-4 pt-3 border-t border-stone-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                    <div className="flex items-center gap-2 min-w-0">
                      {n.subject_code && (
                        <span
                          className="font-bold px-1.5 py-0.5 rounded text-white text-[10px]"
                          style={{ backgroundColor: n.subject_color || '#4F46E5' }}
                        >
                          {n.subject_code}
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
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-stone-100 dark:hover:bg-slate-800 cursor-pointer"
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
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-300">
                  {n.mode === 'drawing' ? (
                    <PenTool className="w-4 h-4" />
                  ) : n.mode === 'notebook' ? (
                    <NotebookPen className="w-4 h-4" />
                  ) : (
                    <FileText className="w-4 h-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                    {n.title}
                  </div>
                  <div className="text-xs text-slate-400 truncate">
                    {[n.subject_code, n.notebook_title, `${n.word_count} words`].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <span className="text-xs text-slate-400 hidden sm:inline">
                  {formatRelativeTime(n.updated_at)}
                </span>
                {isTrashView ? (
                  <button
                    type="button"
                    onClick={(e) => handleRestore(e, n.id)}
                    className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold"
                  >
                    Restore
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={(e) => handleTrashOrDelete(e, n)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
