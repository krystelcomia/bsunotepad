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
  ChevronDown,
  Columns2,
  Copy,
  CopyPlus,
  Download,
  Edit3,
  ExternalLink,
  FileDown,
  FilePlus2,
  History,
  Image as ImageIcon,
  Moon,
  Palette,
  Paperclip,
  PenTool,
  Pin,
  Printer,
  Save,
  Share2,
  Star,
  Sun,
  Tag,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { api } from '../../api/client';
import { useTheme } from '../../context/ThemeContext';
import { Attachment, DrawingData, Folder, Notebook, Note, PageSize, PaperStyle, Subject } from '../../types';
import {
  downloadTextFile,
  exportNoteAsDoc,
  exportNoteAsHtml,
  exportNoteAsTxt,
  formatBytes,
  htmlToMarkdownApprox,
  parseDrawingData,
  parseTags,
} from '../../utils/format';
import { Modal } from '../common/Modal';
import { DrawingCanvas } from './DrawingCanvas';
import { MathFormula } from './MathExtension';
import { PAPER_BG_SWATCHES, RibbonToolbar } from './RibbonToolbar';
import { VersionHistoryDrawer } from './VersionHistoryDrawer';

const NOTE_CATEGORIES = [
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
] as const;

function getPaperStyleLabel(style: PaperStyle): string {
  switch (style) {
    case 'plain':
      return 'Blankong Papel';
    case 'lined':
      return 'Linyado';
    case 'wide_ruled':
      return 'Malawak na Linya';
    case 'grid':
      return 'Grid';
    case 'dot':
      return 'May Tuldok';
    case 'cornell':
      return 'Cornell';
    case 'cream':
      return 'Krema';
    case 'dark_board':
      return 'Madilim na Pisara';
    default:
      return String(style);
  }
}

interface NoteWorkspaceProps {
  noteId: string;
  folders: Folder[];
  subjects: Subject[];
  notebooks: Notebook[];
  onBack: () => void;
  onOpenNote?: (noteId: string) => void;
  onNewNote?: () => void;
  onNoteUpdated: (note: Note) => void;
  onNoteDeleted: () => void;
  onNotify: (type: 'success' | 'error' | 'info', text: string) => void;
}

export const NoteWorkspace: React.FC<NoteWorkspaceProps> = ({
  noteId,
  folders,
  notebooks,
  onBack,
  onOpenNote,
  onNewNote,
  onNoteUpdated,
  onNoteDeleted,
  onNotify,
}) => {
  const { resolved: workspaceTheme, toggle: toggleWorkspaceTheme } = useTheme();
  const [note, setNote] = useState<Note | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Pangkalahatan');
  const [paperStyle, setPaperStyle] = useState<PaperStyle>('plain');
  const [paperBgColor, setPaperBgColor] = useState('');
  const [pageSize, setPageSize] = useState<PageSize>('a4');
  const [paperTone, setPaperTone] = useState<'light' | 'cream' | 'adaptive'>('light');
  const [zoom, setZoom] = useState<number>(100);
  const [customizerOpen, setCustomizerOpen] = useState(false);

  const [cornellCues, setCornellCues] = useState('');
  const [cornellSummary, setCornellSummary] = useState('');
  const [drawingData, setDrawingData] = useState<DrawingData>(() => parseDrawingData(''));
  const [drawingPreview, setDrawingPreview] = useState('');
  const [inkOverlayActive, setInkOverlayActive] = useState(false);
  const [doodlePanelOpen, setDoodlePanelOpen] = useState(false);
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);

  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState('');

  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'dirty'>('saved');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [mathOpen, setMathOpen] = useState(false);
  const [latexInput, setLatexInput] = useState('f(x) = \\int_{-\\infty}^{\\infty} \\hat{f}(\\xi)\\,e^{2 \\pi i \\xi x}\\,d\\xi');
  const [findOpen, setFindOpen] = useState(false);
  const [findTerm, setFindTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');

  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const imageUploadRef = useRef<HTMLInputElement | null>(null);
  const attachUploadRef = useRef<HTMLInputElement | null>(null);
  const downloadMenuRef = useRef<HTMLDivElement | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const latestPayloadRef = useRef<Record<string, unknown>>({});

  useEffect(() => {
    if (!downloadMenuOpen) return;
    const onOutside = (e: MouseEvent) => {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(e.target as Node)) {
        setDownloadMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [downloadMenuOpen]);

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
      Placeholder.configure({ placeholder: 'Magsimulang magsulat ng iyong personal na tala, mga ideya, o buod...' }),
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

  const autoSaveRef = useRef(true);
  autoSaveRef.current = autoSaveEnabled;

  const hydrateFromNote = useCallback(
    (loaded: Note) => {
      setNote(loaded);
      setTitle(loaded.title);
      setDescription(loaded.description || '');
      setCategory(loaded.category || 'Pangkalahatan');
      setPaperStyle((loaded.paper_style || 'plain') as PaperStyle);
      setPaperBgColor(loaded.paper_bg_color || '');
      setPageSize((loaded.page_size || 'a4') as PageSize);
      setCornellCues(loaded.cornell_cues || '');
      setCornellSummary(loaded.cornell_summary || '');
      setDrawingData(parseDrawingData(loaded.drawing_data));
      setDrawingPreview(loaded.drawing_preview || '');
      setTags(parseTags(loaded.tags_json));
      setInkOverlayActive(false);
      setDoodlePanelOpen(loaded.mode === 'drawing');

      if (editor) {
        try {
          const parsed = JSON.parse(loaded.content_json);
          editor.commands.setContent(parsed, false);
        } catch {
          editor.commands.setContent(loaded.content_html || '<p></p>', false);
        }
      }
      setSaveState('saved');
      setLastSavedAt(loaded.updated_at || new Date().toISOString());
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
        onNotify('error', err instanceof Error ? err.message : 'Hindi ma-load ang tala.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [noteId, hydrateFromNote, onNotify]);

  // I-save ang nakabinbing pagbabago bago magsara o lumipat ng tala
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
      setLastSavedAt(new Date().toISOString());
    } catch {
      latestPayloadRef.current = { ...pending, ...latestPayloadRef.current };
      setSaveState('dirty');
    }
  }, [noteId, onNoteUpdated]);

  const handleManualSave = useCallback(async () => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const pending: Record<string, unknown> = {
      ...latestPayloadRef.current,
      title: title.trim() || 'Walang Pamagat na Tala',
      description,
      category,
      paper_style: paperStyle,
      paper_bg_color: paperBgColor,
      page_size: pageSize,
    };
    if (editor) {
      pending.content_json = JSON.stringify(editor.getJSON());
      pending.content_html = editor.getHTML();
    }
    latestPayloadRef.current = {};
    setSaveState('saving');
    try {
      const res = await api.updateNote(noteId, pending);
      setNote(res.note);
      onNoteUpdated(res.note);
      setSaveState('saved');
      setLastSavedAt(new Date().toISOString());
      onNotify('success', 'Mano-manong na-save ang tala');
    } catch (err) {
      setSaveState('dirty');
      onNotify('error', err instanceof Error ? err.message : 'Nabigo ang pag-save');
    }
  }, [noteId, title, description, category, paperStyle, paperBgColor, pageSize, editor, onNoteUpdated, onNotify]);

  const queueSave = useCallback(
    (patch: Record<string, unknown>) => {
      latestPayloadRef.current = { ...latestPayloadRef.current, ...patch };
      setSaveState('dirty');
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      if (autoSaveRef.current) {
        saveTimerRef.current = window.setTimeout(() => {
          flushSaveNow();
        }, 650);
      }
    },
    [flushSaveNow]
  );

  const handleDuplicateInStudio = async () => {
    try {
      await flushSaveNow();
      const res = await api.duplicateNote(noteId);
      onNoteUpdated(res.note);
      onNotify('success', `Nakopya bilang "${res.note.title}"`);
      if (onOpenNote) {
        onOpenNote(res.note.id);
      }
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Nabigong kopyahin ang tala');
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleManualSave();
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
  }, [handleManualSave]);

  const handleEmbedDrawingIntoDoc = (dataUrl: string) => {
    if (!editor) return;
    editor.chain().focus().setImage({ src: dataUrl, alt: 'Guhit mula sa INKORA' }).run();
    onNotify('success', 'Naisama ang guhit sa loob ng iyong tala!');
  };

  const handleUploadInlineImage = async (file: File) => {
    try {
      const res = await api.uploadFile(file, { noteId, subjectId: note?.subject_id || null });
      setAttachments((prev) => [res.file, ...prev]);
      const url = `/api/files/${res.file.id}/content`;
      editor?.chain().focus().setImage({ src: url, alt: res.file.original_name }).run();
      onNotify('success', 'Na-upload at naisingit ang larawan!');
    } catch {
      // Fallback: i-embed direkta ang larawan bilang inline data URL upang laging gumana
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result || '');
        if (dataUrl) {
          editor?.chain().focus().setImage({ src: dataUrl, alt: file.name }).run();
          onNotify('success', 'Naisingit ang larawan sa iyong tala!');
        } else {
          onNotify('error', 'Hindi mabasa ang napiling larawan.');
        }
      };
      reader.onerror = () => onNotify('error', 'Hindi mabasa ang napiling larawan.');
      reader.readAsDataURL(file);
    }
  };

  const handleUploadAttachment = async (file: File) => {
    try {
      const res = await api.uploadFile(file, { noteId, subjectId: note?.subject_id || null });
      setAttachments((prev) => [res.file, ...prev]);
      onNotify('success', `Nailakip ang "${res.file.original_name}"`);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Nabigo ang paglalakip ng file');
    }
  };

  const handleFindReplace = () => {
    if (!editor || !findTerm) return;
    const html = editor.getHTML();
    const escaped = findTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'g');
    const matches = html.match(regex);
    if (!matches || matches.length === 0) {
      onNotify('info', `Walang tugma para sa "${findTerm}"`);
      return;
    }
    const replaced = html.replace(regex, replaceTerm);
    editor.commands.setContent(replaced, true);
    onNotify('success', `Napalitan ang ${matches.length} bahagi.`);
  };

  const handleSaveSnapshot = async () => {
    await flushSaveNow();
    try {
      await api.createNoteVersion(noteId);
      onNotify('success', 'Na-save ang bersyon ng tala!');
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Hindi ma-save ang bersyon');
    }
  };

  const handleToggleShare = async (enabled: boolean) => {
    try {
      const res = await api.toggleNoteShare(noteId, enabled);
      setNote((prev) => (prev ? { ...prev, share_token: res.share_token } : null));
      onNotify('success', res.share_token ? 'Pinagana ang link ng pagbabahagi!' : 'Pinatay ang link ng pagbabahagi.');
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Hindi ma-update ang pagbabahagi');
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
    if (pageSize === 'compact') return 'max-w-[640px] w-full';
    if (pageSize === 'letter') return 'max-w-[816px] w-full';
    if (pageSize === 'wide') return 'max-w-[1024px] w-full';
    if (pageSize === 'fluid') return 'max-w-none w-full';
    return 'max-w-[794px] w-full';
  }, [pageSize]);

  const isDarkPaper = useMemo(
    () =>
      paperStyle === 'dark_board' ||
      paperBgColor === '#1E293B' ||
      paperBgColor === '#0B172E' ||
      paperBgColor === '#13111C',
    [paperStyle, paperBgColor]
  );

  const paperBgClass = useMemo(() => {
    const toneClass = !paperBgColor && paperTone === 'adaptive' ? 'paper-adaptive' : '';
    const darkSheetClass = isDarkPaper && paperStyle !== 'dark_board' ? 'paper-dark-sheet' : '';
    return `paper-${paperStyle} ${toneClass} ${darkSheetClass}`;
  }, [paperStyle, paperTone, paperBgColor, isDarkPaper]);

  const wordCount = editor?.storage.characterCount?.words() ?? note?.word_count ?? 0;
  const charCount = editor?.storage.characterCount?.characters() ?? 0;

  const categoryChoices = useMemo(() => {
    const list = new Set<string>(NOTE_CATEGORIES);
    if (category) list.add(category);
    return Array.from(list);
  }, [category]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
        Binubuksan ang workspace ng studio...
      </div>
    );
  }

  if (!note) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <p className="text-sm text-slate-500">Hindi nahanap ang tala.</p>
        <button type="button" onClick={onBack} className="px-4 py-2 rounded-xl bg-blue-700 text-white text-sm cursor-pointer">
          Bumalik sa Workspace
        </button>
      </div>
    );
  }

  const shareUrl = note.share_token
    ? `${window.location.origin}/?share=${note.share_token}`
    : '';

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-[#EFF6FF] dark:bg-[#071021]">
      {/* Tuktok na Bar ng Studio */}
      <div className="no-print px-3 sm:px-5 py-2.5 bg-white dark:bg-[#0D1930] border-b border-blue-200/80 dark:border-blue-900/60 flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={() => {
            flushSaveNow().then(onBack);
          }}
          className="p-2 rounded-xl text-slate-500 hover:bg-blue-50 dark:hover:bg-blue-950/60 hover:text-blue-700 dark:hover:text-white transition cursor-pointer"
          title="Bumalik sa listahan"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center gap-1.5">
            <input
              ref={titleInputRef}
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                queueSave({ title: e.target.value });
              }}
              placeholder="Walang Pamagat na Tala"
              className="w-full font-display font-bold text-base sm:text-lg text-slate-900 dark:text-white bg-transparent focus:outline-none truncate"
            />
            <button
              type="button"
              onClick={() => {
                titleInputRef.current?.focus();
                titleInputRef.current?.select();
              }}
              className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/60 cursor-pointer shrink-0"
              title="Palitan ang pamagat ng tala"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                queueSave({ category: e.target.value });
              }}
              className="bg-blue-50/80 dark:bg-blue-950/60 text-blue-700 dark:text-sky-300 font-semibold rounded px-1.5 py-0.5 cursor-pointer"
              title="Kategorya ng Tala"
            >
              {categoryChoices.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <span>·</span>
            <select
              value={note.folder_id || ''}
              onChange={(e) => queueSave({ folder_id: e.target.value || null })}
              className="bg-transparent hover:bg-blue-50 dark:hover:bg-blue-950/60 rounded px-1 py-0.5 cursor-pointer"
              title="Italaga sa Folder"
            >
              <option value="">Walang Folder</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  📁 {f.name}
                </option>
              ))}
            </select>
            <span>·</span>
            <select
              value={note.notebook_id || ''}
              onChange={(e) => queueSave({ notebook_id: e.target.value || null })}
              className="bg-transparent hover:bg-blue-50 dark:hover:bg-blue-950/60 rounded px-1 py-0.5 cursor-pointer"
              title="Italaga sa Kuwaderno"
            >
              <option value="">Malayang Pahina</option>
              {notebooks.map((nb) => (
                <option key={nb.id} value={nb.id}>
                  {nb.title}
                </option>
              ))}
            </select>
            <span>·</span>
            <button
              type="button"
              onClick={() => {
                const next = !autoSaveEnabled;
                setAutoSaveEnabled(next);
                onNotify('info', next ? 'Pinagana ang awtomatikong pag-save' : 'Ihinto muna ang awtomatikong pag-save (gamitin ang button na I-save)');
                if (next && saveState === 'dirty') {
                  flushSaveNow();
                }
              }}
              className={`px-1.5 py-0.5 rounded font-semibold cursor-pointer ${
                autoSaveEnabled
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                  : 'bg-blue-50 dark:bg-[#132340] text-slate-500'
              }`}
              title="I-on o i-off ang awtomatikong pag-save"
            >
              Auto: {autoSaveEnabled ? 'BUKAS' : 'PATAY'}
            </button>
            <span
              className={`font-medium ${
                saveState === 'saving'
                  ? 'text-blue-600 dark:text-sky-400'
                  : saveState === 'dirty'
                    ? 'text-amber-600'
                    : 'text-emerald-600 dark:text-emerald-400'
              }`}
              title={lastSavedAt ? `Huling na-save ${new Date(lastSavedAt).toLocaleTimeString()}` : undefined}
            >
              {saveState === 'saving'
                ? 'Sini-save...'
                : saveState === 'dirty'
                  ? 'May hindi pa na-save'
                  : lastSavedAt
                    ? `Na-save ${new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : 'Na-save'}
            </span>
          </div>
        </div>

        {/* Pinagsamang mga Kagamitan sa Iisang Tala (Larawan, Guhit/Doodle, Panel, I-download) */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => imageUploadRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-blue-200 dark:border-blue-800 bg-white dark:bg-[#132340] text-blue-800 dark:text-blue-200 hover:bg-blue-50 dark:hover:bg-blue-950/60 text-xs font-semibold transition cursor-pointer"
            title="Magdagdag ng larawan sa dokumento"
          >
            <ImageIcon className="w-3.5 h-3.5 text-blue-600 dark:text-sky-400" />
            <span className="hidden sm:inline">Larawan</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setInkOverlayActive((v) => {
                const next = !v;
                if (next) setDoodlePanelOpen(false);
                return next;
              });
            }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
              inkOverlayActive
                ? 'bg-sky-600 text-white shadow-xs'
                : 'border border-blue-200 dark:border-blue-800 bg-white dark:bg-[#132340] text-blue-800 dark:text-blue-200 hover:bg-blue-50 dark:hover:bg-blue-950/60'
            }`}
            title="Gumuhit o mag-doodle gamit ang iba't ibang lapis at panulat direkta sa pahina"
          >
            <PenTool className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{inkOverlayActive ? 'Gumuguhit' : 'Guhit / Doodle'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setDoodlePanelOpen((v) => {
                const next = !v;
                if (next) setInkOverlayActive(false);
                return next;
              });
            }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
              doodlePanelOpen
                ? 'bg-blue-700 text-white shadow-xs'
                : 'border border-blue-200 dark:border-blue-800 bg-white dark:bg-[#132340] text-blue-800 dark:text-blue-200 hover:bg-blue-50 dark:hover:bg-blue-950/60'
            }`}
            title="Buksan ang katabing panel ng guhit upang mag-sketch at ilakip sa dokumento"
          >
            <Columns2 className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Panel ng Guhit</span>
          </button>

          <div ref={downloadMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setDownloadMenuOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/80 dark:bg-[#132340] text-blue-800 dark:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-950/70 text-xs font-semibold transition cursor-pointer"
              title="I-download ang dokumentong ito"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">I-download</span>
              <ChevronDown className="w-3 h-3" />
            </button>

            {downloadMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-56 rounded-2xl bg-white dark:bg-[#0D1930] border border-blue-200 dark:border-blue-800 shadow-xl py-1.5 z-40 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setDownloadMenuOpen(false);
                    exportNoteAsDoc(note, editor?.getHTML() || '', drawingPreview);
                    onNotify('success', 'Na-download ang dokumento bilang Word (.doc)');
                  }}
                  className="w-full px-3.5 py-2 text-left flex items-center gap-2 text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/60 cursor-pointer font-medium"
                >
                  <FileDown className="w-3.5 h-3.5 text-blue-600 dark:text-sky-400" />
                  Dokumento ng Word (.doc)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDownloadMenuOpen(false);
                    window.print();
                  }}
                  className="w-full px-3.5 py-2 text-left flex items-center gap-2 text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/60 cursor-pointer font-medium"
                >
                  <Printer className="w-3.5 h-3.5 text-blue-600 dark:text-sky-400" />
                  I-print / I-save na PDF
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDownloadMenuOpen(false);
                    exportNoteAsHtml(note, editor?.getHTML() || '', drawingPreview);
                    onNotify('success', 'Na-download ang dokumento bilang HTML (.html)');
                  }}
                  className="w-full px-3.5 py-2 text-left flex items-center gap-2 text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/60 cursor-pointer font-medium"
                >
                  <FileDown className="w-3.5 h-3.5 text-slate-500" />
                  Pahina ng Web (.html)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDownloadMenuOpen(false);
                    const md = htmlToMarkdownApprox(note, editor?.getText() || '');
                    const slug = (title || 'tala').toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'tala';
                    downloadTextFile(`${slug}.md`, md, 'text/markdown;charset=utf-8');
                    onNotify('success', 'Na-download ang dokumento bilang Markdown (.md)');
                  }}
                  className="w-full px-3.5 py-2 text-left flex items-center gap-2 text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/60 cursor-pointer font-medium"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  Markdown (.md)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDownloadMenuOpen(false);
                    exportNoteAsTxt(note, editor?.getText() || '');
                    onNotify('success', 'Na-download ang dokumento bilang Teksto (.txt)');
                  }}
                  className="w-full px-3.5 py-2 text-left flex items-center gap-2 text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/60 cursor-pointer font-medium"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  Simpleng Teksto (.txt)
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mga Mabilisang Aksyon */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleManualSave}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
            title="Mano-manong I-save (Ctrl+S)"
          >
            <Save className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">I-save</span>
          </button>
          {onNewNote && (
            <button
              type="button"
              onClick={async () => {
                await flushSaveNow();
                onNewNote();
              }}
              className="p-2 rounded-xl text-slate-500 hover:bg-blue-50 dark:hover:bg-blue-950/60 hover:text-blue-700 cursor-pointer"
              title="Gumawa ng Bagong Tala"
            >
              <FilePlus2 className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={handleDuplicateInStudio}
            className="p-2 rounded-xl text-slate-500 hover:bg-blue-50 dark:hover:bg-blue-950/60 hover:text-blue-700 cursor-pointer"
            title="Kopyahin ang Tala"
          >
            <CopyPlus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setCustomizerOpen((v) => !v)}
            className={`p-2 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-950/60 cursor-pointer ${
              customizerOpen ? 'text-blue-700 bg-blue-50 dark:bg-blue-950/60 dark:text-sky-300' : 'text-slate-500'
            }`}
            title="I-customize ang Estilo ng Papel, Kulay, Laki at Tema"
          >
            <Palette className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => queueSave({ is_starred: note.is_starred ? 0 : 1 })}
            className={`p-2 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-950/60 cursor-pointer ${
              note.is_starred ? 'text-amber-500' : 'text-slate-400'
            }`}
            title="Paboritong tala"
          >
            <Star className="w-4 h-4" fill={note.is_starred ? 'currentColor' : 'none'} />
          </button>
          <button
            type="button"
            onClick={() => queueSave({ is_pinned: note.is_pinned ? 0 : 1 })}
            className={`p-2 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-950/60 cursor-pointer ${
              note.is_pinned ? 'text-blue-600 dark:text-sky-400' : 'text-slate-400'
            }`}
            title="I-pin sa itaas"
          >
            <Pin className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setAttachmentsOpen((v) => !v)}
            className={`relative p-2 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-950/60 cursor-pointer ${
              attachmentsOpen ? 'text-blue-700 bg-blue-50 dark:bg-blue-950/50 dark:text-sky-300' : 'text-slate-500'
            }`}
            title="Mga Kalakip na File"
          >
            <Paperclip className="w-4 h-4" />
            {attachments.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-blue-700 text-white text-[10px] font-bold flex items-center justify-center">
                {attachments.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setVersionsOpen(true)}
            className="p-2 rounded-xl text-slate-500 hover:bg-blue-50 dark:hover:bg-blue-950/60 cursor-pointer"
            title="Kasaysayan ng Bersyon"
          >
            <History className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className={`p-2 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-950/60 cursor-pointer ${
              note.share_token ? 'text-emerald-600' : 'text-slate-500'
            }`}
            title="Ibahagi ang Tala"
          >
            <Share2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={async () => {
              await api.trashNote(note.id);
              onNotify('info', 'Inilipat ang tala sa Basurahan');
              onNoteDeleted();
            }}
            className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
            title="Burahin ang Tala (Ilipat sa Basurahan)"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Maikling Paglalarawan at Mabilisang Tagapag-customize */}
      <div className="no-print px-3 sm:px-5 py-1.5 bg-white/80 dark:bg-[#0D1930]/80 border-b border-blue-100 dark:border-blue-900/60 flex flex-wrap items-center gap-3 text-xs">
        <div className="flex-1 min-w-[220px] flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 shrink-0">
            Paglalarawan:
          </span>
          <input
            type="text"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              queueSave({ description: e.target.value });
            }}
            placeholder="Magdagdag ng maikling paglalarawan o paalala para sa iyong personal na tala..."
            className="w-full bg-transparent text-xs text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => setCustomizerOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-[#132340] border border-blue-200 dark:border-blue-800 text-[11px] font-semibold text-blue-800 dark:text-blue-200 hover:border-blue-400 cursor-pointer"
        >
          <Palette className="w-3 h-3 text-blue-600 dark:text-sky-400" />
          {getPaperStyleLabel(paperStyle)}
          <span className="text-slate-400">·</span>
          <span className="uppercase">{pageSize}</span>
        </button>
      </div>

      {/* Nabubuksang Panel ng Pag-customize ng Tala */}
      {customizerOpen && (
        <div className="no-print px-4 sm:px-6 py-3 bg-blue-50/80 dark:bg-[#132340] border-b border-blue-200/70 dark:border-blue-900/60 flex flex-wrap items-center gap-x-5 gap-y-2.5 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-600 dark:text-slate-300">Estilo ng Papel:</span>
            <div className="flex flex-wrap items-center gap-1">
              {(
                [
                  { id: 'plain', label: 'Blanko' },
                  { id: 'lined', label: 'Linyado' },
                  { id: 'grid', label: 'Grid' },
                  { id: 'dot', label: 'May Tuldok' },
                  { id: 'cornell', label: 'Cornell' },
                  { id: 'wide_ruled', label: 'Malawak na Linya' },
                  { id: 'dark_board', label: 'Pisara' },
                ] as const
              ).map((ps) => (
                <button
                  key={ps.id}
                  type="button"
                  onClick={() => {
                    setPaperStyle(ps.id);
                    queueSave({ paper_style: ps.id });
                  }}
                  className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                    paperStyle === ps.id
                      ? 'bg-blue-700 text-white shadow-xs'
                      : 'bg-white dark:bg-[#0D1930] text-slate-700 dark:text-slate-300 border border-blue-200 dark:border-blue-800'
                  }`}
                >
                  {ps.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-600 dark:text-slate-300">Kulay ng Background:</span>
            <div className="flex items-center gap-1">
              {PAPER_BG_SWATCHES.map((sw) => (
                <button
                  key={sw.value || 'auto'}
                  type="button"
                  onClick={() => {
                    setPaperBgColor(sw.value);
                    queueSave({ paper_bg_color: sw.value });
                  }}
                  title={sw.label}
                  className={`w-5 h-5 rounded-full border transition cursor-pointer ${
                    paperBgColor === sw.value
                      ? 'ring-2 ring-blue-600 ring-offset-1 border-blue-600 scale-110'
                      : 'border-blue-200 dark:border-blue-700'
                  }`}
                  style={'preview' in sw ? { background: sw.preview } : { backgroundColor: sw.value }}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-600 dark:text-slate-300">Laki ng Pahina:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                const sz = e.target.value as PageSize;
                setPageSize(sz);
                queueSave({ page_size: sz });
              }}
              className="px-2.5 py-1 rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-[#0D1930] text-slate-700 dark:text-slate-200"
            >
              <option value="compact">Siksik (B5)</option>
              <option value="a4">Pamantayang A4</option>
              <option value="letter">Liham (US Letter)</option>
              <option value="wide">Malawak na Studio</option>
              <option value="fluid">Buong Lapad</option>
            </select>
          </div>

          <button
            type="button"
            onClick={toggleWorkspaceTheme}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-[#0D1930] border border-blue-200 dark:border-blue-800 font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            {workspaceTheme === 'dark' ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" /> Lumipat sa Maliwanag na Tema
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-blue-600" /> Lumipat sa Madilim na Tema
              </>
            )}
          </button>
        </div>
      )}

      {/* Nakatagong upload input para sa inline na larawan */}
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

      {/* Pinagsamang Ribbon Toolbar na Parang Word */}
      <RibbonToolbar
        editor={editor}
        paperStyle={paperStyle}
        onChangePaperStyle={(st) => {
          setPaperStyle(st);
          queueSave({ paper_style: st });
        }}
        paperBgColor={paperBgColor}
        onChangePaperBgColor={(clr) => {
          setPaperBgColor(clr);
          queueSave({ paper_bg_color: clr });
        }}
        pageSize={pageSize}
        onChangePageSize={(sz) => {
          setPageSize(sz);
          queueSave({ page_size: sz });
        }}
        paperTone={paperTone}
        onChangePaperTone={setPaperTone}
        workspaceTheme={workspaceTheme}
        onToggleWorkspaceTheme={toggleWorkspaceTheme}
        zoom={zoom}
        onChangeZoom={setZoom}
        wordCount={wordCount}
        charCount={charCount}
        onOpenImagePicker={() => imageUploadRef.current?.click()}
        onOpenMathModal={() => setMathOpen(true)}
        doodleActive={inkOverlayActive}
        onToggleDoodle={() => {
          setInkOverlayActive((v) => {
            const next = !v;
            if (next) setDoodlePanelOpen(false);
            return next;
          });
        }}
        onOpenDoodlePanel={() => {
          setDoodlePanelOpen(true);
          setInkOverlayActive(false);
          onNotify('info', 'Gumuhit sa katabing panel at pindutin ang Ilakip upang ilagay ang guhit sa iyong dokumento.');
        }}
        onSaveSnapshot={handleSaveSnapshot}
        onOpenVersions={() => setVersionsOpen(true)}
        onToggleFind={() => setFindOpen((v) => !v)}
        onExportDoc={() => {
          exportNoteAsDoc(note, editor?.getHTML() || '', drawingPreview);
          onNotify('success', 'Na-download ang dokumento bilang Word (.doc)');
        }}
        onExportHtml={() => {
          exportNoteAsHtml(note, editor?.getHTML() || '', drawingPreview);
          onNotify('success', 'Na-download ang dokumento bilang HTML (.html)');
        }}
        onExportMarkdown={() => {
          const md = htmlToMarkdownApprox(note, editor?.getText() || '');
          const slug = (title || 'tala').toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'tala';
          downloadTextFile(`${slug}.md`, md, 'text/markdown;charset=utf-8');
          onNotify('success', 'Na-download ang dokumento bilang Markdown (.md)');
        }}
        onExportTxt={() => {
          exportNoteAsTxt(note, editor?.getText() || '');
          onNotify('success', 'Na-download ang dokumento bilang Teksto (.txt)');
        }}
        onPrintPdf={() => window.print()}
        onOpenShare={() => setShareOpen(true)}
      />

      {/* Hanapin at Palitan Bar */}
      {findOpen && (
        <div className="no-print px-4 py-2 bg-blue-50/90 dark:bg-[#132340] border-b border-blue-200 dark:border-blue-800 flex flex-wrap items-center gap-2 text-xs">
          <input
            type="text"
            value={findTerm}
            onChange={(e) => setFindTerm(e.target.value)}
            placeholder="Hanapin ang teksto..."
            className="px-2.5 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-[#0D1930]"
          />
          <input
            type="text"
            value={replaceTerm}
            onChange={(e) => setReplaceTerm(e.target.value)}
            placeholder="Palitan ng..."
            className="px-2.5 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-[#0D1930]"
          />
          <button
            type="button"
            onClick={handleFindReplace}
            className="px-3 py-1.5 rounded-lg bg-blue-700 text-white font-semibold cursor-pointer"
          >
            Palitan Lahat
          </button>
          <button
            type="button"
            onClick={() => setFindOpen(false)}
            aria-label="Isara ang paghahanap"
            className="ml-auto p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Pangunahing Katawan ng Iisang Pinagsamang Dokumento */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
        {/* Pinagsamang Pahina ng Tala (Teksto + Larawan + Live na Guhit/Doodle) */}
        <div
          className={`flex-1 overflow-y-auto p-4 sm:p-8 flex flex-col items-center ${
            doodlePanelOpen ? 'lg:w-1/2 border-b lg:border-b-0 lg:border-r border-blue-200 dark:border-blue-900' : ''
          }`}
        >
          {/* Aktibong Banner kapag naka-on ang Guhit sa Pahina */}
          {inkOverlayActive && (
            <div className={`no-print ${pageWidthClass} mb-3 flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-blue-700 text-white shadow-sm`}>
              <div className="flex items-center gap-2 text-xs font-medium">
                <PenTool className="w-3.5 h-3.5" />
                <span>Mode ng Guhit / Doodle sa Pahina — pumili ng Ballpen, Lapis, Fountain Pen, Marker, o Highlighter sa ibaba.</span>
              </div>
              <button
                type="button"
                onClick={() => setInkOverlayActive(false)}
                className="px-2.5 py-1 rounded-lg bg-white text-blue-800 text-xs font-bold hover:bg-blue-50 cursor-pointer"
              >
                Bumalik sa Pagsulat
              </button>
            </div>
          )}

          {/* Pahina ng Papel */}
          <div
            className={`print-sheet relative ${pageWidthClass} rounded-2xl shadow-lg border border-blue-200/80 dark:border-blue-800/70 overflow-hidden transition-all ${paperBgClass} ${
              isDarkPaper ? 'text-slate-100' : 'text-slate-900'
            }`}
            style={{
              backgroundColor: paperBgColor || undefined,
              transform: `scale(${zoom / 100})`,
              transformOrigin: 'top center',
            }}
          >
            {/* Katawan ng Papel (Cornell o Karaniwan) */}
            <div className={`relative ${paperStyle === 'lined' || paperStyle === 'wide_ruled' ? 'pl-20 pr-8 py-8' : 'px-8 sm:px-12 py-9'}`}>
              {paperStyle === 'cornell' ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-[210px_1fr] gap-6 border-b-2 border-blue-200/80 dark:border-blue-800/60 pb-6">
                    <div className="md:border-r-2 md:border-sky-300/80 md:pr-5">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 mb-2">
                        Mga Gabay at Tanong
                      </div>
                      <textarea
                        value={cornellCues}
                        onChange={(e) => {
                          setCornellCues(e.target.value);
                          queueSave({ cornell_cues: e.target.value });
                        }}
                        rows={16}
                        placeholder="Mga pangunahing tanong, pormula, o mabilisang paalala..."
                        className="w-full bg-transparent text-sm leading-7 resize-none focus:outline-none text-current placeholder:text-slate-400"
                      />
                    </div>
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300 mb-2">
                        Mga Pangunahing Tala
                      </div>
                      <div className="inkora-prose">
                        <EditorContent editor={editor} />
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-sky-400 mb-1.5">
                      Buod ng Pahina
                    </div>
                    <textarea
                      value={cornellSummary}
                      onChange={(e) => {
                        setCornellSummary(e.target.value);
                        queueSave({ cornell_summary: e.target.value });
                      }}
                      rows={3}
                      placeholder="Ibuod ang mahahalagang ideya ng pahinang ito sa 2–3 pangungusap..."
                      className="w-full bg-transparent text-sm leading-relaxed resize-none focus:outline-none text-current placeholder:text-slate-400"
                    />
                  </div>
                </div>
              ) : (
                <div className="inkora-prose">
                  <EditorContent editor={editor} />
                </div>
              )}

              {/* Pinagsamang Transparenteng Doodle / Ink Layer direkta sa Dokumento */}
              {(inkOverlayActive ||
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

          {/* Footer ng mga Tag */}
          <div className="no-print w-full max-w-[794px] mt-5 flex flex-wrap items-center gap-2 px-2">
            <Tag className="w-3.5 h-3.5 text-slate-400" />
            {tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white dark:bg-[#0D1930] border border-blue-200 dark:border-blue-800 text-xs text-blue-800 dark:text-blue-200"
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
              placeholder="Magdagdag ng tag + Enter..."
              className="text-xs bg-transparent px-2 py-1 text-slate-600 dark:text-slate-300 focus:outline-none placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Katabing Panel ng Guhit (Doodle Pad na maaaring ilakip sa dokumento) */}
        {doodlePanelOpen && (
          <div className="flex flex-col min-h-[380px] lg:min-h-0 lg:w-1/2 bg-white dark:bg-[#0D1930]">
            <div className="no-print px-3 py-1.5 border-b border-blue-100 dark:border-blue-900 flex items-center justify-between text-xs bg-blue-50/70 dark:bg-[#132340]">
              <span className="font-bold text-blue-800 dark:text-sky-300">
                Panel ng Guhit / Doodle — gumuhit at pindutin ang &ldquo;Ilakip&rdquo; upang isingit sa tala
              </span>
              <button
                type="button"
                onClick={() => setDoodlePanelOpen(false)}
                className="p-1 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
                aria-label="Isara ang panel ng guhit"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <DrawingCanvas
                value={{
                  ...drawingData,
                  background:
                    drawingData.background === 'transparent'
                      ? paperStyle === 'dark_board'
                        ? 'dark_board'
                        : 'plain'
                      : drawingData.background,
                }}
                compactToolbar
                onInsertIntoDocument={editor ? handleEmbedDrawingIntoDoc : undefined}
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
          </div>
        )}

        {/* Drawer ng mga Kalakip na File */}
        {attachmentsOpen && (
          <div className="no-print w-72 sm:w-80 bg-white dark:bg-[#0D1930] border-l border-blue-200 dark:border-blue-900 flex flex-col shrink-0">
            <div className="px-4 py-3 border-b border-blue-100 dark:border-blue-900 flex items-center justify-between">
              <span className="font-display font-bold text-sm">Mga Kalakip ng Tala</span>
              <button type="button" onClick={() => setAttachmentsOpen(false)} aria-label="Isara" className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 border-b border-blue-100 dark:border-blue-900">
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
                className="w-full py-2 px-3 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" /> Maglakip ng File sa Tala
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {attachments.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">Wala pang nakalakip na file sa talang ito.</p>
              ) : (
                attachments.map((att) => (
                  <div
                    key={att.id}
                    className="p-2.5 rounded-xl border border-blue-100 dark:border-blue-800 bg-blue-50/50 dark:bg-[#132340] space-y-1.5"
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
                            className="text-blue-600 dark:text-sky-400 font-semibold hover:underline cursor-pointer"
                          >
                            Isingit
                          </button>
                        )}
                        <a
                          href={`/api/files/${att.id}/content?download=1`}
                          className="text-slate-600 dark:text-slate-300 hover:underline"
                        >
                          I-download
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

      {/* Drawer ng Kasaysayan ng Bersyon */}
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

      {/* Modal para sa Pormulang Matematika */}
      <Modal
        open={mathOpen}
        onClose={() => setMathOpen(false)}
        title="Magsingit ng Pormulang Matematika"
        subtitle="Magsulat ng notasyong LaTeX na malinis na ire-render gamit ang KaTeX"
      >
        <div className="space-y-4">
          <textarea
            value={latexInput}
            onChange={(e) => setLatexInput(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 text-sm font-mono rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-[#132340] focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex flex-wrap gap-1.5 text-xs">
            {[
              { label: 'Kwadratiko', tex: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}' },
              { label: 'Michaelis-Menten', tex: 'V_0 = \\frac{V_{\\max}[S]}{K_m + [S]}' },
              { label: 'Entropiya', tex: 'S = k_B \\ln \\Omega' },
              { label: 'Kabuuan (Big-O)', tex: '\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}' },
            ].map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setLatexInput(p.tex)}
                className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-[#132340] hover:bg-blue-100 text-blue-800 dark:text-blue-200 font-medium cursor-pointer"
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setMathOpen(false)}
              className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-blue-50 cursor-pointer"
            >
              Kanselahin
            </button>
            <button
              type="button"
              onClick={() => {
                if (latexInput.trim()) {
                  editor?.chain().focus().insertMathFormula(latexInput.trim()).run();
                }
                setMathOpen(false);
              }}
              className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold cursor-pointer"
            >
              Isingit ang Pormula
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal ng Pagbabahagi ng Tala */}
      <Modal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        title="Ibahagi ang Tala"
        subtitle="Gumawa ng pampublikong read-only link upang maibahagi ang iyong personal na tala"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-xl bg-blue-50/70 dark:bg-[#132340] border border-blue-200 dark:border-blue-800">
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                Pampublikong Read-Only Link
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Maaaring tingnan ng sinumang may hawak ng lihim na link ang talang ito.
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleToggleShare(!note.share_token)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                note.share_token
                  ? 'bg-emerald-600 text-white'
                  : 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
              }`}
            >
              {note.share_token ? 'Aktibo' : 'Paganahin'}
            </button>
          </div>

          {note.share_token && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={shareUrl}
                  className="flex-1 px-3 py-2 text-xs font-mono rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-[#132340]"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(shareUrl);
                    onNotify('success', 'Nakopya ang link ng pagbabahagi!');
                  }}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-blue-700 text-white text-xs font-semibold cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" /> Kopyahin
                </button>
              </div>
              <a
                href={shareUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-sky-400 hover:underline"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Buksan ang Ibinahaging Pahina
              </a>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setShareOpen(false)}
              className="px-4 py-2 rounded-xl bg-blue-50 dark:bg-[#132340] text-blue-800 dark:text-blue-200 text-sm font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" /> Tapos na
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
