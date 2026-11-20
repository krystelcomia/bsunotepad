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
      // huwag pansinin
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
      onNotify('success', 'Na-save ang kuha sa kasaysayan ng bersyon.');
      await load();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Nabigong i-save ang bersyon');
    }
  };

  const handleRestore = async (v: NoteVersion) => {
    if (!window.confirm(`Ibalik ang "${v.label}"? Papalitan nito ang mga kasalukuyang hindi naka-save na pagbabago.`)) return;
    try {
      const res = await api.restoreNoteVersion(noteId, v.id);
      onRestored(res.note);
      onNotify('success', `Naibalik ang bersyong "${v.label}"`);
      onClose();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Nabigo ang pagbalik ng bersyon');
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-80 sm:w-96 bg-white dark:bg-[#0D1930] border-l border-blue-200 dark:border-blue-900 shadow-2xl flex flex-col">
      <div className="px-4 py-3.5 border-b border-blue-100 dark:border-blue-900 flex items-center justify-between">
        <div className="flex items-center gap-2 font-display font-bold text-sm text-slate-900 dark:text-white">
          <History className="w-4 h-4 text-blue-600 dark:text-sky-400" /> Kasaysayan ng Bersyon
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Isara"
          className="p-1 rounded-lg text-slate-400 hover:bg-blue-50 dark:hover:bg-blue-950 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 border-b border-blue-100 dark:border-blue-900 space-y-2">
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Pangalan ng bersyon (hal. Bago ang Huling Edit)"
          className="w-full px-3 py-2 text-xs rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-[#132340] focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={createSnapshot}
          className="w-full py-2 px-3 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Save className="w-3.5 h-3.5" /> Mag-save ng Bagong Bersyon
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <p className="text-xs text-center text-slate-400 py-8">Nilo-load ang mga bersyon...</p>
        ) : versions.length === 0 ? (
          <p className="text-xs text-center text-slate-400 py-8">
            Wala pang naka-save na bersyon. Mag-save ng checkpoint bago ang malalaking pagbabago!
          </p>
        ) : (
          versions.map((v) => (
            <div
              key={v.id}
              className="p-3 rounded-xl border border-blue-100 dark:border-blue-800 bg-blue-50/40 dark:bg-[#132340] space-y-1.5"
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
                  {v.mode === 'drawing' ? 'Guhit' : v.mode === 'notebook' ? 'Kuwaderno' : 'Dokumento'} · {v.word_count} salita
                </span>
                <button
                  type="button"
                  onClick={() => handleRestore(v)}
                  className="inline-flex items-center gap-1 text-blue-600 dark:text-sky-400 font-semibold hover:underline cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" /> Ibalik
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
