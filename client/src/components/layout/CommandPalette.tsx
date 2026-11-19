import React, { useEffect, useState } from 'react';
import { BookOpen, File, FileText, NotebookPen, PenTool, Search, X } from 'lucide-react';
import { api } from '../../api/client';
import { Attachment, Notebook, Note, Subject } from '../../types';
import { formatBytes, formatRelativeTime } from '../../utils/format';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onSelectNote: (noteId: string) => void;
  onSelectNotebook: (notebookId: string) => void;
  onSelectSubject: (subjectId: string) => void;
  onOpenFiles: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onClose,
  onSelectNote,
  onSelectNotebook,
  onSelectSubject,
  onOpenFiles,
}) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{
    notes: Note[];
    notebooks: Notebook[];
    subjects: Subject[];
    files: Attachment[];
  }>({ notes: [], notebooks: [], subjects: [], files: [] });

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    const timer = window.setTimeout(async () => {
      if (!query.trim()) {
        setResults({ notes: [], notebooks: [], subjects: [], files: [] });
        return;
      }
      setLoading(true);
      try {
        const res = await api.searchWorkspace(query);
        setResults(res);
      } catch {
        // ignore search errors
      } finally {
        setLoading(false);
      }
    }, 180);

    return () => window.clearTimeout(timer);
  }, [query, open]);

  if (!open) return null;

  const hasAny =
    results.notes.length > 0 ||
    results.notebooks.length > 0 ||
    results.subjects.length > 0 ||
    results.files.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] bg-slate-950/55 backdrop-blur-xs p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-stone-200 dark:border-slate-800">
          <Search className="w-5 h-5 text-indigo-500 shrink-0" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes, formulas, Cornell cues, courses, notebooks, or uploaded files..."
            className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
          />
          {loading && <span className="text-xs text-slate-400">Searching...</span>}
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:bg-stone-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-3 space-y-4">
          {!query.trim() ? (
            <div className="py-10 text-center text-sm text-slate-400">
              Type keywords to search across full-text notes, tags, notebooks, and files.
            </div>
          ) : !hasAny && !loading ? (
            <div className="py-10 text-center text-sm text-slate-400">
              No matching academic items found for "{query}".
            </div>
          ) : (
            <>
              {results.notes.length > 0 && (
                <div>
                  <div className="px-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Notes & Documents
                  </div>
                  <div className="space-y-1">
                    {results.notes.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => {
                          onSelectNote(n.id);
                          onClose();
                        }}
                        className="w-full text-left flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-indigo-50/70 dark:hover:bg-indigo-950/40 transition"
                      >
                        <div className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 mt-0.5">
                          {n.mode === 'drawing' ? (
                            <PenTool className="w-4 h-4" />
                          ) : n.mode === 'notebook' ? (
                            <NotebookPen className="w-4 h-4" />
                          ) : (
                            <FileText className="w-4 h-4" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                              {n.title}
                            </span>
                            {n.subject_code && (
                              <span
                                className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white shrink-0"
                                style={{ backgroundColor: n.subject_color || '#4F46E5' }}
                              >
                                {n.subject_code}
                              </span>
                            )}
                          </div>
                          {n.excerpt && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                              {n.excerpt}
                            </p>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400 shrink-0">
                          {formatRelativeTime(n.updated_at)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {results.notebooks.length > 0 && (
                <div>
                  <div className="px-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Notebooks
                  </div>
                  <div className="space-y-1">
                    {results.notebooks.map((nb) => (
                      <button
                        key={nb.id}
                        type="button"
                        onClick={() => {
                          onSelectNotebook(nb.id);
                          onClose();
                        }}
                        className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-stone-100 dark:hover:bg-slate-800 transition"
                      >
                        <span
                          className="w-3 h-7 rounded-sm shrink-0"
                          style={{ backgroundColor: nb.cover_color }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                            {nb.title}
                          </div>
                          {nb.description && (
                            <div className="text-xs text-slate-400 truncate">{nb.description}</div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {results.subjects.length > 0 && (
                <div>
                  <div className="px-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Courses
                  </div>
                  <div className="space-y-1">
                    {results.subjects.map((sub) => (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => {
                          onSelectSubject(sub.id);
                          onClose();
                        }}
                        className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-stone-100 dark:hover:bg-slate-800 transition"
                      >
                        <BookOpen className="w-4 h-4 shrink-0" style={{ color: sub.color }} />
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">
                          {sub.code ? `${sub.code} — ${sub.name}` : sub.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {results.files.length > 0 && (
                <div>
                  <div className="px-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Uploaded Files
                  </div>
                  <div className="space-y-1">
                    {results.files.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => {
                          onOpenFiles();
                          onClose();
                        }}
                        className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-stone-100 dark:hover:bg-slate-800 transition"
                      >
                        <File className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="flex-1 text-sm text-slate-800 dark:text-slate-200 truncate">
                          {f.original_name}
                        </span>
                        <span className="text-xs text-slate-400">{formatBytes(f.size_bytes)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
