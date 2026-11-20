import React, { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { api } from '../../api/client';
import { Folder, Notebook, PaperStyle, Subject } from '../../types';
import { Modal } from '../common/Modal';

const COLORS = ['#6D28D9', '#8B5CF6', '#3B82F6', '#4C1D95', '#0EA5E9', '#EC4899', '#10B981', '#F59E0B'];

export const FolderModal: React.FC<{
  open: boolean;
  editing: Folder | null;
  onClose: () => void;
  onSaved: () => void;
  onNotify: (type: 'success' | 'error' | 'info', text: string) => void;
}> = ({ open, editing, onClose, onSaved, onNotify }) => {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6D28D9');

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setColor(editing.color);
    } else {
      setName('');
      setColor('#6D28D9');
    }
  }, [open, editing]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.updateFolder(editing.id, { name, color });
        onNotify('success', 'Folder updated');
      } else {
        await api.createFolder({ name, color });
        onNotify('success', 'Folder created');
      }
      onSaved();
      onClose();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Failed to save folder');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Folder' : 'Create Folder'}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold mb-1">Folder Name *</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Midterm Study Packets"
            className="w-full px-3 py-2 text-sm rounded-xl border border-violet-200 dark:border-slate-700 bg-violet-50/40 dark:bg-slate-800"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1.5">Folder Color</label>
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-7 h-7 rounded-full cursor-pointer ${color === c ? 'ring-2 ring-offset-2 ring-violet-600' : ''}`}
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
                if (!window.confirm(`Delete folder "${editing.name}"? Notes inside will remain in All Notes.`)) return;
                await api.deleteFolder(editing.id);
                onSaved();
                onClose();
              }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:underline cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete Folder
            </button>
          ) : (
            <span />
          )}
          <button
            type="submit"
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-violet-700 to-blue-600 text-white text-sm font-semibold cursor-pointer"
          >
            {editing ? 'Save Folder' : 'Create Folder'}
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
  const [semester, setSemester] = useState('Fall 2026');
  const [color, setColor] = useState('#4F46E5');

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
      setSemester('Fall 2026');
      setColor('#4F46E5');
    }
  }, [open, editing]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.updateSubject(editing.id, { code, name, instructor, semester, color });
        onNotify('success', 'Course updated');
      } else {
        await api.createSubject({ code, name, instructor, semester, color });
        onNotify('success', 'Course created');
      }
      onSaved();
      onClose();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Failed to save course');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Course' : 'Add Academic Course'}>
      <form onSubmit={submit} className="space-y-3.5">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold mb-1">Course Code</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="CS 301"
              className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-semibold mb-1">Course Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Data Structures & Algorithms"
              className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold mb-1">Instructor</label>
            <input
              type="text"
              value={instructor}
              onChange={(e) => setInstructor(e.target.value)}
              placeholder="Dr. Elena Vance"
              className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Semester</label>
            <input
              type="text"
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1.5">Course Color</label>
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-7 h-7 rounded-full cursor-pointer ${color === c ? 'ring-2 ring-offset-2 ring-indigo-500' : ''}`}
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
                if (!window.confirm(`Delete course "${editing.name}"? Notes inside will remain accessible.`)) return;
                await api.deleteSubject(editing.id);
                onSaved();
                onClose();
              }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:underline cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete Course
            </button>
          ) : (
            <span />
          )}
          <button type="submit" className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold cursor-pointer">
            {editing ? 'Save Course' : 'Create Course'}
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
  const [coverColor, setCoverColor] = useState('#312E81');
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
      setCoverColor('#312E81');
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
        onNotify('success', 'Notebook updated');
      } else {
        await api.createNotebook(payload);
        onNotify('success', 'Notebook created');
      }
      onSaved();
      onClose();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Failed to save notebook');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Notebook Settings' : 'Create Digital Notebook'}>
      <form onSubmit={submit} className="space-y-3.5">
        <div>
          <label className="block text-xs font-semibold mb-1">Notebook Title *</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Organic Chemistry Lecture Notes"
            className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Reaction mechanisms, lab sheets, and summaries"
            className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold mb-1">Course</label>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800"
            >
              <option value="">General / None</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code ? `${s.code} · ${s.name}` : s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Default Paper</label>
            <select
              value={paperStyle}
              onChange={(e) => setPaperStyle(e.target.value as PaperStyle)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800"
            >
              <option value="lined">College Ruled</option>
              <option value="cornell">Cornell Lecture</option>
              <option value="grid">Graph Grid</option>
              <option value="dot">Dot Grid</option>
              <option value="plain">Plain Document</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1.5">Cover Spine Color</label>
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCoverColor(c)}
                className={`w-7 h-7 rounded-full cursor-pointer ${coverColor === c ? 'ring-2 ring-offset-2 ring-indigo-500' : ''}`}
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
                if (!window.confirm(`Delete notebook "${editing.title}"? Its notes will stay in All Notes.`)) return;
                await api.deleteNotebook(editing.id);
                onSaved();
                onClose();
              }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:underline cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete Notebook
            </button>
          ) : (
            <span />
          )}
          <button type="submit" className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold cursor-pointer">
            {editing ? 'Save Notebook' : 'Create Notebook'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
