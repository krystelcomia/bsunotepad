import React, { useEffect, useState } from 'react';
import { History, RotateCcw, Save, X } from 'lucide-react';
import { api } from '../../api/client';
import { Note, NoteVersion } from '../../types';
import { formatRelativeTime } from '../../utils/format';

interface VersionHistoryDrawerProps {
  open: boolean;
  noteId: string;
  onClose: () => void;
  onRestored: (note: Note) => void;
  onNotify: (type: 'success' | 'error' | 'info', text: string) => void;
}

export const VersionHistoryDrawer: React.FC<VersionHistoryDrawerProps> = ({
  open,
  noteId,
  onClose,
  onRestored,
  onNotify,
}) => {
  const [versions, setVersions] = useState<NoteVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [label, setLabel] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.listNoteVersions(noteId);
      setVersions(res.versions);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load();
  }, [open, noteId]);

  if (!open) return null;

  const createSnapshot = async () => {
    try {
      await api.createNoteVersion(noteId, label.trim() || undefined);
      setLabel('');
      onNotify('success', 'Snapshot saved to version history.');
      await load();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Failed to save snapshot');
    }
  };

  const handleRestore = async (v: NoteVersion) => {
    if (!window.confirm(`Restore "${v.label}"? Current unsaved changes will be replaced.`)) return;
    try {
      const res = await api.restoreNoteVersion(noteId, v.id);
      onRestored(res.note);
      onNotify('success', `Restored snapshot "${v.label}"`);
      onClose();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Restore failed');
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-80 sm:w-96 bg-white dark:bg-slate-900 border-l border-stone-200 dark:border-slate-800 shadow-2xl flex flex-col">
      <div className="px-4 py-3.5 border-b border-stone-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2 font-display font-bold text-sm text-slate-900 dark:text-white">
          <History className="w-4 h-4 text-indigo-600" /> Version History
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:bg-stone-100 dark:hover:bg-slate-800"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 border-b border-stone-100 dark:border-slate-800 space-y-2">
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Snapshot label (e.g. Before Final Edit)"
          className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="button"
          onClick={createSnapshot}
          className="w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Save className="w-3.5 h-3.5" /> Save New Snapshot
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <p className="text-xs text-center text-slate-400 py-8">Loading snapshots...</p>
        ) : versions.length === 0 ? (
          <p className="text-xs text-center text-slate-400 py-8">
            No snapshots saved yet. Save a checkpoint before major edits!
          </p>
        ) : (
          versions.map((v) => (
            <div
              key={v.id}
              className="p-3 rounded-xl border border-stone-200 dark:border-slate-800 bg-stone-50/70 dark:bg-slate-800/50 space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-xs text-slate-900 dark:text-white truncate">
                  {v.label}
                </span>
                <span className="text-[10px] text-slate-400 shrink-0">
                  {formatRelativeTime(v.created_at)}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                <span>
                  {v.mode} · {v.word_count} words
                </span>
                <button
                  type="button"
                  onClick={() => handleRestore(v)}
                  className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-semibold hover:underline cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" /> Restore
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
