import React, { useState } from 'react';
import { Editor } from '@tiptap/react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  CheckSquare,
  Code2,
  Columns3,
  Download,
  Eraser,
  FileDown,
  Highlighter,
  History,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Moon,
  PenTool,
  Printer,
  Quote,
  Redo2,
  Rows3,
  Save,
  Search,
  Share2,
  Sigma,
  Strikethrough,
  Subscript,
  Sun,
  Superscript,
  Table,
  Trash2,
  Underline,
  Undo2,
} from 'lucide-react';
import { PageSize, PaperStyle } from '../../types';

export const PAPER_BG_SWATCHES = [
  { value: '', label: 'Auto Theme', preview: 'linear-gradient(135deg, #ffffff 50%, #1e293b 50%)' },
  { value: '#FFFFFF', label: 'Crisp White' },
  { value: '#FFFDF5', label: 'Warm Cream' },
  { value: '#F5F3FF', label: 'Soft Lavender' },
  { value: '#EFF6FF', label: 'Powder Blue' },
  { value: '#ECFDF5', label: 'Mint Mist' },
  { value: '#FFF1F2', label: 'Blush Rose' },
  { value: '#FFFBEB', label: 'Soft Amber' },
  { value: '#1E293B', label: 'Dark Slate' },
  { value: '#13111C', label: 'Deep Obsidian' },
] as const;

interface RibbonToolbarProps {
  editor: Editor | null;
  paperStyle: PaperStyle;
  onChangePaperStyle: (style: PaperStyle) => void;
  paperBgColor: string;
  onChangePaperBgColor: (color: string) => void;
  pageSize: PageSize;
  onChangePageSize: (size: PageSize) => void;
  paperTone: 'light' | 'cream' | 'adaptive';
  onChangePaperTone: (tone: 'light' | 'cream' | 'adaptive') => void;
  workspaceTheme: 'light' | 'dark';
  onToggleWorkspaceTheme: () => void;
  zoom: number;
  onChangeZoom: (zoom: number) => void;
  wordCount: number;
  charCount: number;
  onOpenImagePicker: () => void;
  onOpenMathModal: () => void;
  onEmbedDrawing: () => void;
  onSaveSnapshot: () => void;
  onOpenVersions: () => void;
  onToggleFind: () => void;
  onExportHtml: () => void;
  onExportMarkdown: () => void;
  onPrintPdf: () => void;
  onOpenShare: () => void;
}

type RibbonTab = 'home' | 'insert' | 'layout' | 'review';

export const RibbonToolbar: React.FC<RibbonToolbarProps> = ({
  editor,
  paperStyle,
  onChangePaperStyle,
  paperBgColor,
  onChangePaperBgColor,
  pageSize,
  onChangePageSize,
  paperTone,
  onChangePaperTone,
  workspaceTheme,
  onToggleWorkspaceTheme,
  zoom,
  onChangeZoom,
  wordCount,
  charCount,
  onOpenImagePicker,
  onOpenMathModal,
  onEmbedDrawing,
  onSaveSnapshot,
  onOpenVersions,
  onToggleFind,
  onExportHtml,
  onExportMarkdown,
  onPrintPdf,
  onOpenShare,
}) => {
  const [tab, setTab] = useState<RibbonTab>('home');
  const [textColor, setTextColor] = useState('#161925');
  const [highlightColor, setHighlightColor] = useState('#FEF08A');

  const btn = (active = false) =>
    `p-1.5 rounded-lg transition cursor-pointer ${
      active
        ? 'bg-indigo-600 text-white shadow-xs'
        : 'text-slate-600 dark:text-slate-300 hover:bg-stone-200/70 dark:hover:bg-slate-800'
    }`;

  const pillBtn = (active = false) =>
    `inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
      active
        ? 'bg-indigo-600 text-white'
        : 'text-slate-700 dark:text-slate-200 hover:bg-stone-200/70 dark:hover:bg-slate-800 border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800/80'
    }`;

  const promptLink = () => {
    if (!editor) return;
    const prev = editor.getAttributes('link').href || '';
    const url = window.prompt('Enter hyperlink URL:', prev);
    if (url === null) return;
    if (!url.trim()) {
      editor.chain().focus().unsetLink().run();
    } else {
      editor.chain().focus().setLink({ href: url.trim() }).run();
    }
  };

  const inTable = Boolean(editor?.isActive('table'));

  return (
    <div className="no-print border-b border-stone-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs">
      {/* Ribbon Tabs */}
      <div className="flex items-center justify-between px-4 pt-1.5 border-b border-stone-100 dark:border-slate-800/70">
        <div className="flex items-center gap-1">
          {(
            [
              { id: 'home', label: 'Home' },
              { id: 'insert', label: 'Insert' },
              { id: 'layout', label: 'Page & Paper' },
              { id: 'review', label: 'Review & Export' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg border-b-2 transition cursor-pointer ${
                tab === t.id
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/40 dark:bg-indigo-950/30'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3 text-[11px] text-slate-400 pb-1">
          <span>{wordCount} words</span>
          <span>{charCount} chars</span>
          <span>~{Math.max(1, Math.ceil(wordCount / 200))} min read</span>
        </div>
      </div>

      {/* Ribbon Body */}
      <div className="px-3 py-2 flex flex-wrap items-center gap-1.5 min-h-[46px]">
        {tab === 'home' && editor && (
          <>
            <button
              type="button"
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
              className={`${btn()} disabled:opacity-35`}
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
              className={`${btn()} disabled:opacity-35`}
              title="Redo (Ctrl+Y)"
            >
              <Redo2 className="w-4 h-4" />
            </button>

            <div className="h-5 w-px bg-stone-200 dark:bg-slate-700 mx-0.5" />

            {/* Style / Heading */}
            <select
              value={
                editor.isActive('heading', { level: 1 })
                  ? 'h1'
                  : editor.isActive('heading', { level: 2 })
                    ? 'h2'
                    : editor.isActive('heading', { level: 3 })
                      ? 'h3'
                      : 'p'
              }
              onChange={(e) => {
                const v = e.target.value;
                if (v === 'p') editor.chain().focus().setParagraph().run();
                else if (v === 'h1') editor.chain().focus().toggleHeading({ level: 1 }).run();
                else if (v === 'h2') editor.chain().focus().toggleHeading({ level: 2 }).run();
                else if (v === 'h3') editor.chain().focus().toggleHeading({ level: 3 }).run();
              }}
              className="text-xs px-2 py-1.5 rounded-lg border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium"
              title="Paragraph Style"
            >
              <option value="p">Normal Text</option>
              <option value="h1">Title / H1</option>
              <option value="h2">Heading 2</option>
              <option value="h3">Heading 3</option>
            </select>

            {/* Font Family */}
            <select
              value={editor.getAttributes('textStyle').fontFamily || ''}
              onChange={(e) => {
                const f = e.target.value;
                if (!f) editor.chain().focus().unsetFontFamily().run();
                else editor.chain().focus().setFontFamily(f).run();
              }}
              className="text-xs px-2 py-1.5 rounded-lg border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
              title="Font Family"
            >
              <option value="">Default Sans</option>
              <option value="'Newsreader', Georgia, serif">Academic Serif</option>
              <option value="'Times New Roman', serif">Times New Roman</option>
              <option value="'JetBrains Mono', monospace">Monospace</option>
              <option value="'Caveat', cursive">Handwriting</option>
            </select>

            <div className="h-5 w-px bg-stone-200 dark:bg-slate-700 mx-0.5" />

            <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={btn(editor.isActive('bold'))} title="Bold (Ctrl+B)">
              <Bold className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={btn(editor.isActive('italic'))} title="Italic (Ctrl+I)">
              <Italic className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} className={btn(editor.isActive('underline'))} title="Underline (Ctrl+U)">
              <Underline className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} className={btn(editor.isActive('strike'))} title="Strikethrough">
              <Strikethrough className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => editor.chain().focus().toggleSubscript().run()} className={btn(editor.isActive('subscript'))} title="Subscript (H₂O)">
              <Subscript className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => editor.chain().focus().toggleSuperscript().run()} className={btn(editor.isActive('superscript'))} title="Superscript (x²)">
              <Superscript className="w-4 h-4" />
            </button>

            <label className="inline-flex items-center gap-0.5 px-1.5 py-1 rounded-lg hover:bg-stone-100 dark:hover:bg-slate-800 cursor-pointer" title="Text Color">
              <span className="text-xs font-bold underline decoration-2" style={{ textDecorationColor: textColor }}>
                A
              </span>
              <input
                type="color"
                value={textColor}
                onChange={(e) => {
                  setTextColor(e.target.value);
                  editor.chain().focus().setColor(e.target.value).run();
                }}
                className="w-3.5 h-3.5 opacity-80 cursor-pointer border-0 bg-transparent p-0"
              />
            </label>

            <label className="inline-flex items-center gap-0.5 px-1.5 py-1 rounded-lg hover:bg-stone-100 dark:hover:bg-slate-800 cursor-pointer" title="Highlight Color">
              <Highlighter className="w-3.5 h-3.5" style={{ color: highlightColor === '#FEF08A' ? '#CA8A04' : highlightColor }} />
              <input
                type="color"
                value={highlightColor}
                onChange={(e) => {
                  setHighlightColor(e.target.value);
                  editor.chain().focus().toggleHighlight({ color: e.target.value }).run();
                }}
                className="w-3.5 h-3.5 opacity-80 cursor-pointer border-0 bg-transparent p-0"
              />
            </label>

            <div className="h-5 w-px bg-stone-200 dark:bg-slate-700 mx-0.5" />

            <button type="button" onClick={() => editor.chain().focus().setTextAlign('left').run()} className={btn(editor.isActive({ textAlign: 'left' }))} title="Align Left">
              <AlignLeft className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => editor.chain().focus().setTextAlign('center').run()} className={btn(editor.isActive({ textAlign: 'center' }))} title="Align Center">
              <AlignCenter className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => editor.chain().focus().setTextAlign('right').run()} className={btn(editor.isActive({ textAlign: 'right' }))} title="Align Right">
              <AlignRight className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => editor.chain().focus().setTextAlign('justify').run()} className={btn(editor.isActive({ textAlign: 'justify' }))} title="Justify">
              <AlignJustify className="w-4 h-4" />
            </button>

            <div className="h-5 w-px bg-stone-200 dark:bg-slate-700 mx-0.5" />

            <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={btn(editor.isActive('bulletList'))} title="Bulleted List">
              <List className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btn(editor.isActive('orderedList'))} title="Numbered List">
              <ListOrdered className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => editor.chain().focus().toggleTaskList().run()} className={btn(editor.isActive('taskList'))} title="Checklist">
              <CheckSquare className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
              className={btn(false)}
              title="Clear Formatting"
            >
              <Eraser className="w-4 h-4" />
            </button>
          </>
        )}

        {tab === 'insert' && editor && (
          <>
            <button
              type="button"
              onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
              className={pillBtn(inTable)}
            >
              <Table className="w-3.5 h-3.5" /> Table (3×3)
            </button>
            {inTable && (
              <>
                <button type="button" onClick={() => editor.chain().focus().addRowAfter().run()} className={pillBtn()}>
                  <Rows3 className="w-3.5 h-3.5" /> +Row
                </button>
                <button type="button" onClick={() => editor.chain().focus().addColumnAfter().run()} className={pillBtn()}>
                  <Columns3 className="w-3.5 h-3.5" /> +Col
                </button>
                <button type="button" onClick={() => editor.chain().focus().deleteTable().run()} className={pillBtn()}>
                  <Trash2 className="w-3.5 h-3.5 text-rose-500" /> Del Table
                </button>
              </>
            )}
            <button type="button" onClick={onOpenImagePicker} className={pillBtn()}>
              <ImageIcon className="w-3.5 h-3.5" /> Image
            </button>
            <button type="button" onClick={onEmbedDrawing} className={pillBtn()}>
              <PenTool className="w-3.5 h-3.5 text-indigo-600" /> Embed Sketch
            </button>
            <button type="button" onClick={onOpenMathModal} className={pillBtn()}>
              <Sigma className="w-3.5 h-3.5 text-indigo-600" /> Math Equation
            </button>
            <button type="button" onClick={promptLink} className={pillBtn(editor.isActive('link'))}>
              <Link2 className="w-3.5 h-3.5" /> Link
            </button>
            <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={pillBtn(editor.isActive('blockquote'))}>
              <Quote className="w-3.5 h-3.5" /> Callout
            </button>
            <button type="button" onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={pillBtn(editor.isActive('codeBlock'))}>
              <Code2 className="w-3.5 h-3.5" /> Code Block
            </button>
            <button type="button" onClick={() => editor.chain().focus().setHorizontalRule().run()} className={pillBtn()}>
              <Minus className="w-3.5 h-3.5" /> Divider
            </button>
          </>
        )}

        {tab === 'layout' && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 w-full">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-semibold text-slate-500">Page Style:</span>
              <select
                value={paperStyle}
                onChange={(e) => onChangePaperStyle(e.target.value as PaperStyle)}
                className="px-2.5 py-1.5 rounded-lg border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium"
              >
                <option value="plain">Blank Paper</option>
                <option value="lined">Lined Paper</option>
                <option value="wide_ruled">Wide Ruled Paper</option>
                <option value="grid">Grid Paper</option>
                <option value="dot">Dotted Paper</option>
                <option value="cornell">Cornell Lecture Sheet</option>
                <option value="cream">Warm Cream Sheet</option>
                <option value="dark_board">Chalkboard Grid</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-semibold text-slate-500">Paper Color:</span>
              <div className="flex items-center gap-1">
                {PAPER_BG_SWATCHES.map((sw) => {
                  const active = paperBgColor === sw.value;
                  return (
                    <button
                      key={sw.value || 'auto'}
                      type="button"
                      onClick={() => onChangePaperBgColor(sw.value)}
                      title={sw.label}
                      aria-label={`Paper background ${sw.label}`}
                      className={`w-5 h-5 rounded-full border transition cursor-pointer ${
                        active
                          ? 'ring-2 ring-violet-600 ring-offset-1 border-violet-600 scale-110'
                          : 'border-stone-300 dark:border-slate-600 hover:scale-105'
                      }`}
                      style={
                        'preview' in sw
                          ? { background: sw.preview }
                          : { backgroundColor: sw.value }
                      }
                    />
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-semibold text-slate-500">Page Size:</span>
              <select
                value={pageSize}
                onChange={(e) => onChangePageSize(e.target.value as PageSize)}
                className="px-2.5 py-1.5 rounded-lg border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
              >
                <option value="compact">Compact (B5)</option>
                <option value="a4">A4 Standard</option>
                <option value="letter">US Letter</option>
                <option value="wide">Wide Studio</option>
                <option value="fluid">Full Fluid Width</option>
              </select>
            </div>

            {!paperBgColor && (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="font-semibold text-slate-500">Tone:</span>
                <select
                  value={paperTone}
                  onChange={(e) => onChangePaperTone(e.target.value as 'light' | 'cream' | 'adaptive')}
                  className="px-2 py-1.5 rounded-lg border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                >
                  <option value="light">Crisp Paper</option>
                  <option value="adaptive">Adapt to Dark Theme</option>
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={onToggleWorkspaceTheme}
              className={pillBtn(workspaceTheme === 'dark')}
              title="Toggle light or dark workspace theme"
            >
              {workspaceTheme === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" /> Dark Theme
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-violet-600" /> Light Theme
                </>
              )}
            </button>

            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-slate-500">Zoom:</span>
              <input
                type="range"
                min={80}
                max={130}
                step={5}
                value={zoom}
                onChange={(e) => onChangeZoom(Number(e.target.value))}
                className="w-20 accent-indigo-600"
              />
              <span className="font-mono w-9">{zoom}%</span>
            </div>
          </div>
        )}

        {tab === 'review' && (
          <>
            <button type="button" onClick={onToggleFind} className={pillBtn()}>
              <Search className="w-3.5 h-3.5" /> Find & Replace
            </button>
            <button type="button" onClick={onSaveSnapshot} className={pillBtn()}>
              <Save className="w-3.5 h-3.5 text-emerald-600" /> Save Snapshot
            </button>
            <button type="button" onClick={onOpenVersions} className={pillBtn()}>
              <History className="w-3.5 h-3.5 text-indigo-600" /> Version History
            </button>
            <div className="h-5 w-px bg-stone-200 dark:bg-slate-700 mx-1" />
            <button type="button" onClick={onPrintPdf} className={pillBtn()}>
              <Printer className="w-3.5 h-3.5" /> Print / Save PDF
            </button>
            <button type="button" onClick={onExportHtml} className={pillBtn()}>
              <FileDown className="w-3.5 h-3.5" /> Export HTML
            </button>
            <button type="button" onClick={onExportMarkdown} className={pillBtn()}>
              <Download className="w-3.5 h-3.5" /> Export .MD
            </button>
            <button type="button" onClick={onOpenShare} className={pillBtn()}>
              <Share2 className="w-3.5 h-3.5 text-indigo-600" /> Share Link
            </button>
          </>
        )}
      </div>
    </div>
  );
};
