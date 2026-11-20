import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CharacterCount from '@tiptap/extension-character-count';
import Color from '@tiptap/extension-color';
import FontFamily from '@tiptap/extension-font-family';
import Highlight from '@tiptap/extension-highlight';
import ImageExtension from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
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
import {
  ArrowLeft,
  Check,
  Columns2,
  Copy,
  ExternalLink,
  FileText,
  History,
  NotebookPen,
  Paperclip,
  PenTool,
  Pin,
  Save,
  Share2,
  Star,
  Tag,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { api } from '../../api/client';
import { Attachment, DrawingData, Folder, Notebook, Note, NoteMode, PageSize, PaperStyle, Subject } from '../../types';
import {
  downloadTextFile,
  exportNoteAsHtml,
  formatBytes,
  htmlToMarkdownApprox,
  parseDrawingData,
  parseTags,
} from '../../utils/format';
import { Modal } from '../common/Modal';
import { DrawingCanvas } from './DrawingCanvas';
import { MathFormula } from './MathExtension';
import { RibbonToolbar } from './RibbonToolbar';
import { VersionHistoryDrawer } from './VersionHistoryDrawer';

interface NoteWorkspaceProps {
  noteId: string;
  folders: Folder[];
  subjects: Subject[];
  notebooks: Notebook[];
  onBack: () => void;
  onNoteUpdated: (note: Note) => void;
  onNoteDeleted: () => void;
  onNotify: (type: 'success' | 'error' | 'info', text: string) => void;
}

type StudioView = 'document' | 'notebook' | 'drawing' | 'split';

export const NoteWorkspace: React.FC<NoteWorkspaceProps> = ({
  noteId,
  folders,
  subjects,
  notebooks,
  onBack,
  onNoteUpdated,
  onNoteDeleted,
  onNotify,
}) => {
  const [note, setNote] = useState<Note | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState('');
  const [studioView, setStudioView] = useState<StudioView>('document');
  const [paperStyle, setPaperStyle] = useState<PaperStyle>('plain');
  const [pageSize, setPageSize] = useState<PageSize>('a4');
  const [paperTone, setPaperTone] = useState<'light' | 'cream' | 'adaptive'>('light');
  const [zoom, setZoom] = useState<number>(100);

  const [cornellCues, setCornellCues] = useState('');
  const [cornellSummary, setCornellSummary] = useState('');
  const [drawingData, setDrawingData] = useState<DrawingData>(() => parseDrawingData(''));
  const [drawingPreview, setDrawingPreview] = useState('');
  const [inkOverlayActive, setInkOverlayActive] = useState(false);

  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState('');

  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'dirty'>('saved');
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [mathOpen, setMathOpen] = useState(false);
  const [latexInput, setLatexInput] = useState('f(x) = \\int_{-\\infty}^{\\infty} \\hat{f}(\\xi)\\,e^{2 \\pi i \\xi x}\\,d\\xi');
  const [findOpen, setFindOpen] = useState(false);
  const [findTerm, setFindTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');

  const imageUploadRef = useRef<HTMLInputElement | null>(null);
  const attachUploadRef = useRef<HTMLInputElement | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const latestPayloadRef = useRef<Record<string, unknown>>({});

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      TextStyle,
      FontFamily,
      Color,
      Highlight.configure({ multicolor: true }),
      Subscript,
      Superscript,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Link.configure({ openOnClick: false }),
      ImageExtension.configure({ inline: false, allowBase64: true }),
      Placeholder.configure({ placeholder: 'Start writing your academic notes, essays, or lecture summaries...' }),
      CharacterCount,
      MathFormula,
    ],
    content: '',
    onUpdate: ({ editor: ed }) => {
      const contentJson = JSON.stringify(ed.getJSON());
      const contentHtml = ed.getHTML();
      queueSave({ content_json: contentJson, content_html: contentHtml });
    },
  });

  const hydrateFromNote = useCallback(
    (loaded: Note) => {
      setNote(loaded);
      setTitle(loaded.title);
      setStudioView(loaded.mode as StudioView);
      setPaperStyle((loaded.paper_style || 'plain') as PaperStyle);
      setPageSize((loaded.page_size || 'a4') as PageSize);
      setCornellCues(loaded.cornell_cues || '');
      setCornellSummary(loaded.cornell_summary || '');
      setDrawingData(parseDrawingData(loaded.drawing_data));
      setDrawingPreview(loaded.drawing_preview || '');
      setTags(parseTags(loaded.tags_json));
      setInkOverlayActive(false);

      if (editor) {
        try {
          const parsed = JSON.parse(loaded.content_json);
          editor.commands.setContent(parsed, false);
        } catch {
          editor.commands.setContent(loaded.content_html || '<p></p>', false);
        }
      }
      setSaveState('saved');
    },
    [editor]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .getNote(noteId)
      .then((res) => {
        if (cancelled) return;
        setAttachments(res.attachments);
        hydrateFromNote(res.note);
      })
      .catch((err) => {
        onNotify('error', err instanceof Error ? err.message : 'Could not load note');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [noteId, hydrateFromNote, onNotify]);

  // Flush pending save on unmount or note change
  const flushSaveNow = useCallback(async () => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const pending = latestPayloadRef.current;
    if (Object.keys(pending).length === 0) return;
    latestPayloadRef.current = {};
    setSaveState('saving');
    try {
      const res = await api.updateNote(noteId, pending);
      setNote(res.note);
      onNoteUpdated(res.note);
      setSaveState('saved');
    } catch {
      setSaveState('dirty');
    }
  }, [noteId, onNoteUpdated]);

  const queueSave = useCallback(
    (patch: Record<string, unknown>) => {
      latestPayloadRef.current = { ...latestPayloadRef.current, ...patch };
      setSaveState('dirty');
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(() => {
        flushSaveNow();
      }, 650);
    },
    [flushSaveNow]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        flushSaveNow();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setFindOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [flushSaveNow]);

  const handleModeSwitch = (nextView: StudioView) => {
    setStudioView(nextView);
    if (nextView === 'notebook' && paperStyle === 'plain') {
      setPaperStyle('lined');
      queueSave({ mode: 'notebook', paper_style: 'lined' });
      return;
    }
    if (nextView === 'document' || nextView === 'notebook' || nextView === 'drawing') {
      queueSave({ mode: nextView as NoteMode });
    }
  };

  const handleEmbedDrawingIntoDoc = (dataUrl: string) => {
    if (!editor) return;
    editor.chain().focus().setImage({ src: dataUrl, alt: 'INKORA Sketch' }).run();
    if (studioView === 'drawing') {
      setStudioView('document');
      queueSave({ mode: 'document' });
    }
    onNotify('success', 'Drawing embedded into your document!');
  };

  const handleUploadInlineImage = async (file: File) => {
    try {
      const res = await api.uploadFile(file, { noteId, subjectId: note?.subject_id || null });
      setAttachments((prev) => [res.file, ...prev]);
      const url = `/api/files/${res.file.id}/content`;
      editor?.chain().focus().setImage({ src: url, alt: res.file.original_name }).run();
      onNotify('success', 'Image uploaded and inserted!');
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Image upload failed');
    }
  };

  const handleUploadAttachment = async (file: File) => {
    try {
      const res = await api.uploadFile(file, { noteId, subjectId: note?.subject_id || null });
      setAttachments((prev) => [res.file, ...prev]);
      onNotify('success', `Attached "${res.file.original_name}"`);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Attachment upload failed');
    }
  };

  const handleFindReplace = () => {
    if (!editor || !findTerm) return;
    const html = editor.getHTML();
    const escaped = findTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'g');
    const matches = html.match(regex);
    if (!matches || matches.length === 0) {
      onNotify('info', `No matches found for "${findTerm}"`);
      return;
    }
    const replaced = html.replace(regex, replaceTerm);
    editor.commands.setContent(replaced, true);
    onNotify('success', `Replaced ${matches.length} occurrence(s).`);
  };

  const handleSaveSnapshot = async () => {
    await flushSaveNow();
    try {
      await api.createNoteVersion(noteId);
      onNotify('success', 'Version snapshot saved!');
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Could not save snapshot');
    }
  };

  const handleToggleShare = async (enabled: boolean) => {
    try {
      const res = await api.toggleNoteShare(noteId, enabled);
      setNote((prev) => (prev ? { ...prev, share_token: res.share_token } : null));
      onNotify('success', res.share_token ? 'Share link activated!' : 'Share link disabled.');
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Could not update sharing');
    }
  };

  const addTag = () => {
    const clean = tagDraft.trim().toLowerCase().replace(/\s+/g, '-');
    if (!clean || tags.includes(clean)) {
      setTagDraft('');
      return;
    }
    const next = [...tags, clean];
    setTags(next);
    setTagDraft('');
    queueSave({ tags: next });
  };

  const removeTag = (t: string) => {
    const next = tags.filter((x) => x !== t);
    setTags(next);
    queueSave({ tags: next });
  };

  const pageWidthClass = useMemo(() => {
    if (pageSize === 'fluid') return 'max-w-none w-full';
    if (pageSize === 'letter') return 'max-w-[816px] w-full';
    return 'max-w-[794px] w-full';
  }, [pageSize]);

  const paperBgClass = useMemo(() => {
    const toneClass = paperTone === 'adaptive' ? 'paper-adaptive' : '';
    return `paper-${paperStyle} ${toneClass}`;
  }, [paperStyle, paperTone]);

  const wordCount = editor?.storage.characterCount?.words() ?? note?.word_count ?? 0;
  const charCount = editor?.storage.characterCount?.characters() ?? 0;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
        Opening studio workspace...
      </div>
    );
  }

  if (!note) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <p className="text-sm text-slate-500">Note not found.</p>
        <button type="button" onClick={onBack} className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm">
          Back to Workspace
        </button>
      </div>
    );
  }

  const shareUrl = note.share_token
    ? `${window.location.origin}/?share=${note.share_token}`
    : '';

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-[#EFECE5] dark:bg-[#0B0F17]">
      {/* Studio Top Bar */}
      <div className="no-print px-3 sm:px-5 py-2.5 bg-white dark:bg-slate-900 border-b border-stone-200 dark:border-slate-800 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            flushSaveNow().then(onBack);
          }}
          className="p-2 rounded-xl text-slate-500 hover:bg-stone-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
          title="Back to list"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="flex-1 min-w-[180px]">
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              queueSave({ title: e.target.value });
            }}
            placeholder="Untitled Note"
            className="w-full font-display font-bold text-base sm:text-lg text-slate-900 dark:text-white bg-transparent focus:outline-none truncate"
          />
          <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            <select
              value={note.folder_id || ''}
              onChange={(e) => queueSave({ folder_id: e.target.value || null })}
              className="bg-transparent hover:bg-violet-50 dark:hover:bg-slate-800 rounded px-1 py-0.5 cursor-pointer"
              title="Assign Folder"
            >
              <option value="">No Folder</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  📁 {f.name}
                </option>
              ))}
            </select>
            <span>·</span>
            <select
              value={note.subject_id || ''}
              onChange={(e) => queueSave({ subject_id: e.target.value || null })}
              className="bg-transparent hover:bg-violet-50 dark:hover:bg-slate-800 rounded px-1 py-0.5 cursor-pointer"
              title="Assign Course"
            >
              <option value="">No Course</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code ? `${s.code} · ${s.name}` : s.name}
                </option>
              ))}
            </select>
            <span>·</span>
            <select
              value={note.notebook_id || ''}
              onChange={(e) => queueSave({ notebook_id: e.target.value || null })}
              className="bg-transparent hover:bg-violet-50 dark:hover:bg-slate-800 rounded px-1 py-0.5 cursor-pointer"
              title="Assign Notebook"
            >
              <option value="">Loose Page</option>
              {notebooks.map((nb) => (
                <option key={nb.id} value={nb.id}>
                  {nb.title}
                </option>
              ))}
            </select>
            <span>·</span>
            <span
              className={`font-medium ${
                saveState === 'saving'
                  ? 'text-indigo-500'
                  : saveState === 'dirty'
                    ? 'text-amber-600'
                    : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {saveState === 'saving' ? 'Saving...' : saveState === 'dirty' ? 'Unsaved changes' : 'Saved'}
            </span>
          </div>
        </div>

        {/* Studio Mode Switcher */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-stone-100 dark:bg-slate-800">
          {(
            [
              { id: 'document', label: 'Document', icon: <FileText className="w-3.5 h-3.5" /> },
              { id: 'notebook', label: 'Notebook', icon: <NotebookPen className="w-3.5 h-3.5" /> },
              { id: 'drawing', label: 'Draw Pad', icon: <PenTool className="w-3.5 h-3.5" /> },
              { id: 'split', label: 'Split', icon: <Columns2 className="w-3.5 h-3.5" /> },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => handleModeSwitch(m.id)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                studioView === m.id
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              {m.icon}
              <span className="hidden sm:inline">{m.label}</span>
            </button>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={flushSaveNow}
            className="p-2 rounded-xl text-slate-500 hover:bg-stone-100 dark:hover:bg-slate-800 hover:text-indigo-600 cursor-pointer"
            title="Save now (Ctrl+S)"
          >
            <Save className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => queueSave({ is_starred: note.is_starred ? 0 : 1 })}
            className={`p-2 rounded-xl hover:bg-stone-100 dark:hover:bg-slate-800 cursor-pointer ${
              note.is_starred ? 'text-amber-500' : 'text-slate-400'
            }`}
            title="Star note"
          >
            <Star className="w-4 h-4" fill={note.is_starred ? 'currentColor' : 'none'} />
          </button>
          <button
            type="button"
            onClick={() => queueSave({ is_pinned: note.is_pinned ? 0 : 1 })}
            className={`p-2 rounded-xl hover:bg-stone-100 dark:hover:bg-slate-800 cursor-pointer ${
              note.is_pinned ? 'text-indigo-600' : 'text-slate-400'
            }`}
            title="Pin to top"
          >
            <Pin className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setAttachmentsOpen((v) => !v)}
            className={`relative p-2 rounded-xl hover:bg-stone-100 dark:hover:bg-slate-800 cursor-pointer ${
              attachmentsOpen ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/50' : 'text-slate-500'
            }`}
            title="Attachments & Files"
          >
            <Paperclip className="w-4 h-4" />
            {attachments.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center">
                {attachments.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setVersionsOpen(true)}
            className="p-2 rounded-xl text-slate-500 hover:bg-stone-100 dark:hover:bg-slate-800 cursor-pointer"
            title="Version History"
          >
            <History className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className={`p-2 rounded-xl hover:bg-stone-100 dark:hover:bg-slate-800 cursor-pointer ${
              note.share_token ? 'text-emerald-600' : 'text-slate-500'
            }`}
            title="Share Note"
          >
            <Share2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={async () => {
              await api.trashNote(note.id);
              onNotify('info', 'Moved note to Trash');
              onNoteDeleted();
            }}
            className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
            title="Move to Trash"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Hidden inline image upload input */}
      <input
        ref={imageUploadRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleUploadInlineImage(f);
          e.target.value = '';
        }}
      />

      {/* Word Ribbon Toolbar (shown for Document, Notebook, or Split) */}
      {studioView !== 'drawing' && (
        <RibbonToolbar
          editor={editor}
          paperStyle={paperStyle}
          onChangePaperStyle={(st) => {
            setPaperStyle(st);
            queueSave({ paper_style: st });
          }}
          pageSize={pageSize}
          onChangePageSize={(sz) => {
            setPageSize(sz);
            queueSave({ page_size: sz });
          }}
          paperTone={paperTone}
          onChangePaperTone={setPaperTone}
          zoom={zoom}
          onChangeZoom={setZoom}
          wordCount={wordCount}
          charCount={charCount}
          onOpenImagePicker={() => imageUploadRef.current?.click()}
          onOpenMathModal={() => setMathOpen(true)}
          onEmbedDrawing={() => {
            setStudioView('split');
            onNotify('info', 'Sketch on the right pad and click Embed to insert it into your document.');
          }}
          onSaveSnapshot={handleSaveSnapshot}
          onOpenVersions={() => setVersionsOpen(true)}
          onToggleFind={() => setFindOpen((v) => !v)}
          onExportHtml={() => exportNoteAsHtml(note, editor?.getHTML() || '')}
          onExportMarkdown={() => {
            const md = htmlToMarkdownApprox(note, editor?.getText() || '');
            const slug = (title || 'note').toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'note';
            downloadTextFile(`${slug}.md`, md, 'text/markdown;charset=utf-8');
          }}
          onPrintPdf={() => window.print()}
          onOpenShare={() => setShareOpen(true)}
        />
      )}

      {/* Find & Replace Bar */}
      {findOpen && studioView !== 'drawing' && (
        <div className="no-print px-4 py-2 bg-amber-50/90 dark:bg-slate-800 border-b border-amber-200 dark:border-slate-700 flex flex-wrap items-center gap-2 text-xs">
          <input
            type="text"
            value={findTerm}
            onChange={(e) => setFindTerm(e.target.value)}
            placeholder="Find text..."
            className="px-2.5 py-1.5 rounded-lg border border-stone-300 dark:border-slate-600 bg-white dark:bg-slate-900"
          />
          <input
            type="text"
            value={replaceTerm}
            onChange={(e) => setReplaceTerm(e.target.value)}
            placeholder="Replace with..."
            className="px-2.5 py-1.5 rounded-lg border border-stone-300 dark:border-slate-600 bg-white dark:bg-slate-900"
          />
          <button
            type="button"
            onClick={handleFindReplace}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-semibold cursor-pointer"
          >
            Replace All
          </button>
          <button
            type="button"
            onClick={() => setFindOpen(false)}
            className="ml-auto p-1 text-slate-400 hover:text-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Studio Body */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Document / Notebook Area */}
        {studioView !== 'drawing' && (
          <div
            className={`flex-1 overflow-y-auto p-4 sm:p-8 flex flex-col items-center ${
              studioView === 'split' ? 'lg:w-1/2 border-r border-stone-200 dark:border-slate-800' : ''
            }`}
          >
            {/* Notebook Overlay Ink Toggle Bar */}
            {studioView === 'notebook' && (
              <div className="no-print w-full max-w-[794px] mb-3 flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-stone-200 dark:border-slate-800 shadow-xs">
                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <span className="font-semibold">Notebook Sheet:</span>
                  <span className="capitalize px-2 py-0.5 rounded bg-stone-100 dark:bg-slate-800 font-medium">
                    {paperStyle.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setInkOverlayActive((v) => !v)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      inkOverlayActive
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100'
                    }`}
                  >
                    <PenTool className="w-3.5 h-3.5" />
                    {inkOverlayActive ? 'Drawing Ink On Paper (Switch to Type)' : 'Annotate Paper With Ink'}
                  </button>
                </div>
              </div>
            )}

            {/* Paper Sheet */}
            <div
              className={`print-sheet relative ${pageWidthClass} rounded-2xl shadow-lg border border-stone-300/80 dark:border-slate-700/80 overflow-hidden transition-all ${paperBgClass} ${
                paperStyle === 'dark_board' ? 'text-slate-100' : 'text-slate-900'
              }`}
              style={{
                transform: `scale(${zoom / 100})`,
                transformOrigin: 'top center',
              }}
            >
              {/* Spiral binding decoration in Notebook Mode */}
              {studioView === 'notebook' && (
                <div className="no-print h-4 bg-gradient-to-b from-stone-200/70 to-transparent dark:from-slate-800/70 flex items-center justify-around px-6 border-b border-stone-200/60 dark:border-slate-700/50">
                  {Array.from({ length: 18 }).map((_, i) => (
                    <span
                      key={i}
                      className="w-2.5 h-2.5 rounded-full bg-stone-400/60 dark:bg-slate-600 ring-1 ring-white/50"
                    />
                  ))}
                </div>
              )}

              {/* Sheet Body (Cornell or Standard) */}
              <div className={`relative ${paperStyle === 'lined' || paperStyle === 'wide_ruled' ? 'pl-20 pr-8 py-8' : 'px-8 sm:px-12 py-9'}`}>
                {paperStyle === 'cornell' ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-[210px_1fr] gap-6 border-b-2 border-indigo-200/70 dark:border-indigo-800/50 pb-6">
                      <div className="md:border-r-2 md:border-rose-300/70 md:pr-5">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-rose-500 mb-2">
                          Cues & Questions
                        </div>
                        <textarea
                          value={cornellCues}
                          onChange={(e) => {
                            setCornellCues(e.target.value);
                            queueSave({ cornell_cues: e.target.value });
                          }}
                          rows={16}
                          placeholder="Key questions, formulas, exam prompts..."
                          className="w-full bg-transparent text-sm leading-7 resize-none focus:outline-none text-current placeholder:text-slate-400"
                        />
                      </div>
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-500 mb-2">
                          Lecture Notes
                        </div>
                        <div className="inkora-prose">
                          <EditorContent editor={editor} />
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 mb-1.5">
                        Page Summary
                      </div>
                      <textarea
                        value={cornellSummary}
                        onChange={(e) => {
                          setCornellSummary(e.target.value);
                          queueSave({ cornell_summary: e.target.value });
                        }}
                        rows={3}
                        placeholder="Summarize the key ideas from this page in 2-3 sentences..."
                        className="w-full bg-transparent text-sm leading-relaxed resize-none focus:outline-none text-current placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="inkora-prose">
                    <EditorContent editor={editor} />
                  </div>
                )}

                {/* Transparent Ink Annotation Overlay in Notebook Mode */}
                {studioView === 'notebook' &&
                  (inkOverlayActive ||
                    drawingData.strokes.length > 0 ||
                    drawingData.shapes.length > 0 ||
                    drawingData.texts.length > 0) && (
                    <div
                      className={`absolute inset-0 z-10 ${
                        inkOverlayActive ? 'pointer-events-auto' : 'pointer-events-none'
                      }`}
                    >
                      <DrawingCanvas
                        value={{ ...drawingData, background: 'transparent' }}
                        overlayMode
                        readOnly={!inkOverlayActive}
                        compactToolbar
                        canvasWidth={800}
                        canvasHeight={900}
                        onChange={(next, preview) => {
                          setDrawingData(next);
                          if (preview) setDrawingPreview(preview);
                          queueSave({
                            drawing_data: JSON.stringify(next),
                            drawing_preview: preview ?? drawingPreview,
                          });
                        }}
                      />
                    </div>
                  )}
              </div>
            </div>

            {/* Tags Footer */}
            <div className="no-print w-full max-w-[794px] mt-5 flex flex-wrap items-center gap-2 px-2">
              <Tag className="w-3.5 h-3.5 text-slate-400" />
              {tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white dark:bg-slate-800 border border-stone-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300"
                >
                  #{t}
                  <button
                    type="button"
                    onClick={() => removeTag(t)}
                    className="text-slate-400 hover:text-rose-500 cursor-pointer"
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder="Add tag + Enter..."
                className="text-xs bg-transparent px-2 py-1 text-slate-600 dark:text-slate-300 focus:outline-none placeholder:text-slate-400"
              />
            </div>
          </div>
        )}

        {/* Dedicated Drawing Pad (Full or Split Right Pane) */}
        {(studioView === 'drawing' || studioView === 'split') && (
          <div className={studioView === 'split' ? 'hidden lg:flex lg:w-1/2 flex-col min-h-0' : 'flex-1 flex flex-col min-h-0'}>
            <DrawingCanvas
              value={{
                ...drawingData,
                background:
                  drawingData.background === 'transparent'
                    ? paperStyle === 'dark_board'
                      ? 'dark_board'
                      : 'grid'
                    : drawingData.background,
              }}
              compactToolbar={studioView === 'split'}
              onInsertIntoDocument={studioView === 'split' || editor ? handleEmbedDrawingIntoDoc : undefined}
              onChange={(next, preview) => {
                setDrawingData(next);
                if (preview) setDrawingPreview(preview);
                queueSave({
                  drawing_data: JSON.stringify(next),
                  drawing_preview: preview ?? drawingPreview,
                });
              }}
            />
          </div>
        )}

        {/* Attachments Drawer */}
        {attachmentsOpen && (
          <div className="no-print w-72 sm:w-80 bg-white dark:bg-slate-900 border-l border-stone-200 dark:border-slate-800 flex flex-col shrink-0">
            <div className="px-4 py-3 border-b border-stone-200 dark:border-slate-800 flex items-center justify-between">
              <span className="font-display font-bold text-sm">Note Attachments</span>
              <button type="button" onClick={() => setAttachmentsOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 border-b border-stone-100 dark:border-slate-800">
              <input
                ref={attachUploadRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUploadAttachment(f);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => attachUploadRef.current?.click()}
                className="w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" /> Attach File to Note
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {attachments.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">No files attached to this note yet.</p>
              ) : (
                attachments.map((att) => (
                  <div
                    key={att.id}
                    className="p-2.5 rounded-xl border border-stone-200 dark:border-slate-800 bg-stone-50/70 dark:bg-slate-800/50 space-y-1.5"
                  >
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                      {att.original_name}
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center justify-between">
                      <span>{formatBytes(att.size_bytes)}</span>
                      <div className="flex items-center gap-2">
                        {att.category === 'image' && editor && (
                          <button
                            type="button"
                            onClick={() =>
                              editor.chain().focus().setImage({ src: `/api/files/${att.id}/content`, alt: att.original_name }).run()
                            }
                            className="text-indigo-600 font-semibold hover:underline cursor-pointer"
                          >
                            Insert
                          </button>
                        )}
                        <a
                          href={`/api/files/${att.id}/content?download=1`}
                          className="text-slate-600 dark:text-slate-300 hover:underline"
                        >
                          Download
                        </a>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Version History Drawer */}
      <VersionHistoryDrawer
        open={versionsOpen}
        noteId={noteId}
        onClose={() => setVersionsOpen(false)}
        onRestored={(restored) => {
          hydrateFromNote(restored);
          onNoteUpdated(restored);
        }}
        onNotify={onNotify}
      />

      {/* Math Equation Modal */}
      <Modal
        open={mathOpen}
        onClose={() => setMathOpen(false)}
        title="Insert Mathematical Equation"
        subtitle="Write LaTeX notation rendered cleanly with KaTeX"
      >
        <div className="space-y-4">
          <textarea
            value={latexInput}
            onChange={(e) => setLatexInput(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 text-sm font-mono rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <div className="flex flex-wrap gap-1.5 text-xs">
            {[
              { label: 'Quadratic', tex: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}' },
              { label: 'Michaelis-Menten', tex: 'V_0 = \\frac{V_{\\max}[S]}{K_m + [S]}' },
              { label: 'Entropy', tex: 'S = k_B \\ln \\Omega' },
              { label: 'Big-O Sum', tex: '\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}' },
            ].map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setLatexInput(p.tex)}
                className="px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-slate-800 hover:bg-indigo-50 text-slate-700 dark:text-slate-300 font-medium cursor-pointer"
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setMathOpen(false)}
              className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-stone-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (latexInput.trim()) {
                  editor?.chain().focus().insertMathFormula(latexInput.trim()).run();
                }
                setMathOpen(false);
              }}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold cursor-pointer"
            >
              Insert Equation
            </button>
          </div>
        </div>
      </Modal>

      {/* Share Note Modal */}
      <Modal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        title="Share Note"
        subtitle="Create a public read-only web link for classmates or instructors"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-xl bg-stone-50 dark:bg-slate-800/70 border border-stone-200 dark:border-slate-700">
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                Public Read-Only Link
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Anyone with the secret link can view this note.
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleToggleShare(!note.share_token)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                note.share_token
                  ? 'bg-emerald-600 text-white'
                  : 'bg-stone-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
              }`}
            >
              {note.share_token ? 'Active' : 'Enable'}
            </button>
          </div>

          {note.share_token && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={shareUrl}
                  className="flex-1 px-3 py-2 text-xs font-mono rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(shareUrl);
                    onNotify('success', 'Copied share link!');
                  }}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy
                </button>
              </div>
              <a
                href={shareUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Open Shared View
              </a>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setShareOpen(false)}
              className="px-4 py-2 rounded-xl bg-stone-100 dark:bg-slate-800 text-sm font-semibold flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" /> Done
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
