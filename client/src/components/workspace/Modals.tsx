import React, { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { api } from '../../api/client';
import { Folder, Notebook, PaperStyle, Subject } from '../../types';
import { Modal } from '../common/Modal';

const COLORS = ['#1D4ED8', '#2563EB', '#3B82F6', '#0284C7', '#0EA5E9', '#1E3A8A', '#0369A1', '#60A5FA'];

export const FolderModal: React.FC<{
  open: boolean;
  editing: Folder | null;
  onClose: () => void;
  onSaved: () => void;
  onNotify: (type: 'success' | 'error' | 'info', text: string) => void;
}> = ({ open, editing, onClose, onSaved, onNotify }) => {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#2563EB');

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setColor(editing.color);
    } else {
      setName('');
      setColor('#2563EB');
    }
  }, [open, editing]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.updateFolder(editing.id, { name, color });
        onNotify('success', 'Na-update ang folder');
      } else {
        await api.createFolder({ name, color });
        onNotify('success', 'Nagawa ang folder');
      }
      onSaved();
      onClose();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Nabigong i-save ang folder');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'I-edit ang Folder' : 'Gumawa ng Folder'}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold mb-1">Pangalan ng Folder *</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Mga Babasahin sa Midterm"
            className="w-full px-3 py-2 text-sm rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-[#132340]"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1.5">Kulay ng Folder</label>
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-7 h-7 rounded-full cursor-pointer ${color === c ? 'ring-2 ring-offset-2 ring-blue-600' : ''}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between pt-2">
          {editing ? (
            <button
              type="button"
              onClick={async () => {
                if (!window.confirm(`Burahin ang folder na "${editing.name}"? Mananatili sa Lahat ng Tala ang mga dokumento sa loob.`)) return;
                await api.deleteFolder(editing.id);
                onSaved();
                onClose();
              }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:underline cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Burahin ang Folder
            </button>
          ) : (
            <span />
          )}
          <button
            type="submit"
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-700 to-sky-600 text-white text-sm font-semibold cursor-pointer"
          >
            {editing ? 'I-save ang Folder' : 'Gumawa ng Folder'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export const SubjectModal: React.FC<{
  open: boolean;
  editing: Subject | null;
  onClose: () => void;
  onSaved: () => void;
  onNotify: (type: 'success' | 'error' | 'info', text: string) => void;
}> = ({ open, editing, onClose, onSaved, onNotify }) => {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [instructor, setInstructor] = useState('');
  const [semester, setSemester] = useState('Unang Semestre 2026');
  const [color, setColor] = useState('#1D4ED8');

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setCode(editing.code);
      setName(editing.name);
      setInstructor(editing.instructor);
      setSemester(editing.semester);
      setColor(editing.color);
    } else {
      setCode('');
      setName('');
      setInstructor('');
      setSemester('Unang Semestre 2026');
      setColor('#1D4ED8');
    }
  }, [open, editing]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.updateSubject(editing.id, { code, name, instructor, semester, color });
        onNotify('success', 'Na-update ang asignatura');
      } else {
        await api.createSubject({ code, name, instructor, semester, color });
        onNotify('success', 'Nagawa ang asignatura');
      }
      onSaved();
      onClose();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Nabigong i-save ang asignatura');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'I-edit ang Asignatura' : 'Magdagdag ng Asignatura'}>
      <form onSubmit={submit} className="space-y-3.5">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold mb-1">Kodigo ng Kurso</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="CS 301"
              className="w-full px-3 py-2 text-sm rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-[#132340]"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-semibold mb-1">Pangalan ng Asignatura *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mga Algoritmo at Estruktura ng Datos"
              className="w-full px-3 py-2 text-sm rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-[#132340]"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold mb-1">Guro / Propesor</label>
            <input
              type="text"
              value={instructor}
              onChange={(e) => setInstructor(e.target.value)}
              placeholder="Dr. Elena Vance"
              className="w-full px-3 py-2 text-sm rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-[#132340]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Semestre</label>
            <input
              type="text"
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-[#132340]"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1.5">Kulay ng Asignatura</label>
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-7 h-7 rounded-full cursor-pointer ${color === c ? 'ring-2 ring-offset-2 ring-blue-600' : ''}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          {editing ? (
            <button
              type="button"
              onClick={async () => {
                if (!window.confirm(`Burahin ang asignaturang "${editing.name}"? Mananatiling bukas ang mga tala sa loob.`)) return;
                await api.deleteSubject(editing.id);
                onSaved();
                onClose();
              }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:underline cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Burahin ang Asignatura
            </button>
          ) : (
            <span />
          )}
          <button
            type="submit"
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-700 to-sky-600 text-white text-sm font-semibold cursor-pointer"
          >
            {editing ? 'I-save ang Asignatura' : 'Gumawa ng Asignatura'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export const NotebookModal: React.FC<{
  open: boolean;
  editing: Notebook | null;
  subjects: Subject[];
  onClose: () => void;
  onSaved: () => void;
  onNotify: (type: 'success' | 'error' | 'info', text: string) => void;
}> = ({ open, editing, subjects, onClose, onSaved, onNotify }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [coverColor, setCoverColor] = useState('#1E3A8A');
  const [paperStyle, setPaperStyle] = useState<PaperStyle>('lined');

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setTitle(editing.title);
      setDescription(editing.description);
      setSubjectId(editing.subject_id || '');
      setCoverColor(editing.cover_color);
      setPaperStyle(editing.default_paper_style);
    } else {
      setTitle('');
      setDescription('');
      setSubjectId('');
      setCoverColor('#1E3A8A');
      setPaperStyle('lined');
    }
  }, [open, editing]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        title,
        description,
        subject_id: subjectId || null,
        cover_color: coverColor,
        default_paper_style: paperStyle,
      };
      if (editing) {
        await api.updateNotebook(editing.id, payload);
        onNotify('success', 'Na-update ang kuwaderno');
      } else {
        await api.createNotebook(payload);
        onNotify('success', 'Nagawa ang kuwaderno');
      }
      onSaved();
      onClose();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Nabigong i-save ang kuwaderno');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Mga Setting ng Kuwaderno' : 'Gumawa ng Digital na Kuwaderno'}>
      <form onSubmit={submit} className="space-y-3.5">
        <div>
          <label className="block text-xs font-semibold mb-1">Pamagat ng Kuwaderno *</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Mga Tala sa Organikong Kimika"
            className="w-full px-3 py-2 text-sm rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-[#132340]"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">Paglalarawan</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Mga mekanismo ng reaksyon, ulat sa lab, at buod"
            className="w-full px-3 py-2 text-sm rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-[#132340]"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold mb-1">Asignatura</label>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-[#132340]"
            >
              <option value="">Pangkalahatan / Wala</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code ? `${s.code} · ${s.name}` : s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Karaniwang Papel</label>
            <select
              value={paperStyle}
              onChange={(e) => setPaperStyle(e.target.value as PaperStyle)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-[#132340]"
            >
              <option value="lined">Linyado (Kolehiyo)</option>
              <option value="cornell">Lekturang Cornell</option>
              <option value="grid">Grid na Papel</option>
              <option value="dot">May Tuldok</option>
              <option value="plain">Blankong Dokumento</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1.5">Kulay ng Pabalat</label>
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCoverColor(c)}
                className={`w-7 h-7 rounded-full cursor-pointer ${coverColor === c ? 'ring-2 ring-offset-2 ring-blue-600' : ''}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          {editing ? (
            <button
              type="button"
              onClick={async () => {
                if (!window.confirm(`Burahin ang kuwadernong "${editing.title}"? Mananatili sa Lahat ng Tala ang mga pahina nito.`)) return;
                await api.deleteNotebook(editing.id);
                onSaved();
                onClose();
              }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:underline cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Burahin ang Kuwaderno
            </button>
          ) : (
            <span />
          )}
          <button
            type="submit"
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-700 to-sky-600 text-white text-sm font-semibold cursor-pointer"
          >
            {editing ? 'I-save ang Kuwaderno' : 'Gumawa ng Kuwaderno'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
