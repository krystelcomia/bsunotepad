import React, { useEffect, useState } from 'react';
import ImageExtension from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Table from '@tiptap/extension-table';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TableRow from '@tiptap/extension-table-row';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import TextAlign from '@tiptap/extension-text-align';
import TextStyle from '@tiptap/extension-text-style';
import Underline from '@tiptap/extension-underline';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Printer } from 'lucide-react';
import { api } from '../../api/client';
import { Note } from '../../types';
import { parseDrawingData } from '../../utils/format';
import { BrandLogo } from '../common/BrandLogo';
import { DrawingCanvas } from '../editor/DrawingCanvas';
import { MathFormula } from '../editor/MathExtension';

export const SharedNoteView: React.FC<{ token: string; onExit: () => void }> = ({
  token,
  onExit,
}) => {
  const [note, setNote] = useState<(Note & { author_name: string; author_university: string }) | null>(null);
  const [error, setError] = useState('');

  const editor = useEditor({
    editable: false,
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table,
      TableRow,
      TableHeader,
      TableCell,
      Link,
      ImageExtension,
      MathFormula,
    ],
    content: '',
  });

  useEffect(() => {
    api
      .getSharedNote(token)
      .then((res) => {
        setNote(res.note);
        if (editor) {
          try {
            editor.commands.setContent(JSON.parse(res.note.content_json), false);
          } catch {
            editor.commands.setContent(res.note.content_html || '', false);
          }
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Shared note not found');
      });
  }, [token, editor]);

  const drawing = parseDrawingData(note?.drawing_data);
  const hasDrawing =
    drawing.strokes.length > 0 || drawing.shapes.length > 0 || drawing.texts.length > 0;

  return (
    <div className="min-h-screen bg-[#F5F3EE] dark:bg-[#0B0F17] py-6 px-4">
      <div className="no-print max-w-4xl mx-auto flex items-center justify-between mb-6">
        <BrandLogo size="sm" />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-stone-200 text-xs font-semibold text-slate-700 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" /> Print / PDF
          </button>
          <button
            type="button"
            onClick={onExit}
            className="px-3.5 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold cursor-pointer"
          >
            Open INKORA App
          </button>
        </div>
      </div>

      {error ? (
        <div className="max-w-lg mx-auto bg-white rounded-2xl border border-stone-200 p-8 text-center">
          <h2 className="font-display font-bold text-lg text-slate-900">Link Unavailable</h2>
          <p className="text-sm text-slate-500 mt-1">{error}</p>
        </div>
      ) : !note ? (
        <div className="text-center py-20 text-sm text-slate-400">Loading shared note...</div>
      ) : (
        <div className="print-sheet max-w-4xl mx-auto bg-white rounded-2xl border border-stone-200 shadow-lg p-8 sm:p-12 text-slate-900">
          <div className="border-b border-stone-200 pb-4 mb-6">
            {note.subject_code && (
              <span
                className="inline-block text-[11px] font-bold px-2 py-0.5 rounded text-white mb-2"
                style={{ backgroundColor: note.subject_color || '#4F46E5' }}
              >
                {note.subject_code} · {note.subject_name}
              </span>
            )}
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold">{note.title}</h1>
            <div className="text-xs text-slate-500 mt-1">
              Shared by <strong>{note.author_name}</strong>
              {note.author_university ? ` (${note.author_university})` : ''}
            </div>
          </div>

          {note.paper_style === 'cornell' && note.cornell_cues && (
            <div className="mb-6 p-4 rounded-xl bg-rose-50/50 border border-rose-200/70">
              <div className="text-[11px] font-bold uppercase tracking-wider text-rose-600 mb-1">
                Cues & Questions
              </div>
              <pre className="whitespace-pre-wrap text-sm font-sans">{note.cornell_cues}</pre>
            </div>
          )}

          <div className="inkora-prose">
            <EditorContent editor={editor} />
          </div>

          {note.cornell_summary && (
            <div className="mt-6 p-4 rounded-xl bg-emerald-50/60 border border-emerald-200/70">
              <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 mb-1">
                Summary
              </div>
              <p className="text-sm">{note.cornell_summary}</p>
            </div>
          )}

          {hasDrawing && (
            <div className="mt-8 border border-stone-200 rounded-2xl overflow-hidden h-[460px]">
              <DrawingCanvas value={drawing} readOnly onChange={() => {}} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
