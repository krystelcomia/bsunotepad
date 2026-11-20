import React, { useState } from 'react';
import { Editor } from '@tiptap/react';
import type {} from '@tiptap/starter-kit';
import type {} from '@tiptap/extension-color';
import type {} from '@tiptap/extension-font-family';
import type {} from '@tiptap/extension-highlight';
import type {} from '@tiptap/extension-link';
import type {} from '@tiptap/extension-subscript';
import type {} from '@tiptap/extension-superscript';
import type {} from '@tiptap/extension-table';
import type {} from '@tiptap/extension-task-list';
import type {} from '@tiptap/extension-text-align';
import type {} from '@tiptap/extension-text-style';
import type {} from '@tiptap/extension-underline';
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
  { value: '', label: 'Awtomatikong Tema', preview: 'linear-gradient(135deg, #ffffff 50%, #0d1930 50%)' },
  { value: '#FFFFFF', label: 'Puting Malinis' },
  { value: '#F4F8FF', label: 'Puting Asul' },
  { value: '#EFF6FF', label: 'Pulbos na Asul' },
  { value: '#E0F2FE', label: 'Langit na Asul' },
  { value: '#FFFDF5', label: 'Maligamgam na Krema' },
  { value: '#ECFDF5', label: 'Preskong Berde' },
  { value: '#FFFBEB', label: 'Banayad na Amber' },
  { value: '#1E293B', label: 'Madilim na Slate' },
  { value: '#0B172E', label: 'Malalim na Gabi' },
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
  doodleActive: boolean;
  onToggleDoodle: () => void;
  onOpenDoodlePanel: () => void;
  onSaveSnapshot: () => void;
  onOpenVersions: () => void;
  onToggleFind: () => void;
  onExportDoc: () => void;
  onExportHtml: () => void;
  onExportMarkdown: () => void;
  onExportTxt: () => void;
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
  doodleActive,
  onToggleDoodle,
  onOpenDoodlePanel,
  onSaveSnapshot,
  onOpenVersions,
  onToggleFind,
  onExportDoc,
  onExportHtml,
  onExportMarkdown,
  onExportTxt,
  onPrintPdf,
  onOpenShare,
}) => {
  const [tab, setTab] = useState<RibbonTab>('home');
  const [textColor, setTextColor] = useState('#161925');
  const [highlightColor, setHighlightColor] = useState('#FEF08A');

  const btn = (active = false) =>
    `p-1.5 rounded-lg transition cursor-pointer ${
      active
        ? 'bg-blue-700 text-white shadow-xs'
        : 'text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950/60'
    }`;

  const pillBtn = (active = false) =>
    `inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
      active
        ? 'bg-blue-700 text-white'
        : 'text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/60 border border-blue-200 dark:border-blue-800 bg-white dark:bg-[#132340]'
    }`;

  const promptLink = () => {
    if (!editor) return;
    const prev = editor.getAttributes('link').href || '';
    const url = window.prompt('Ilagay ang URL ng link:', prev);
    if (url === null) return;
    if (!url.trim()) {
      editor.chain().focus().unsetLink().run();
    } else {
      editor.chain().focus().setLink({ href: url.trim() }).run();
    }
  };

  const inTable = Boolean(editor?.isActive('table'));

  return (
    <div className="no-print border-b border-blue-200/80 dark:border-blue-900/60 bg-white/95 dark:bg-[#0D1930]/95 backdrop-blur-xs">
      {/* Mga Tab ng Ribbon */}
      <div className="flex items-center justify-between px-4 pt-1.5 border-b border-blue-100 dark:border-blue-900/50">
        <div className="flex items-center gap-1">
          {(
            [
              { id: 'home', label: 'Tahanan' },
              { id: 'insert', label: 'Isingit' },
              { id: 'layout', label: 'Pahina at Papel' },
              { id: 'review', label: 'Suriin at I-export' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg border-b-2 transition cursor-pointer ${
                tab === t.id
                  ? 'border-blue-700 text-blue-700 dark:text-sky-300 bg-blue-50/70 dark:bg-blue-950/40'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3 text-[11px] text-slate-400 pb-1">
          <span>{wordCount} salita</span>
          <span>{charCount} karakter</span>
          <span>~{Math.max(1, Math.ceil(wordCount / 200))} min na pagbasa</span>
        </div>
      </div>

      {/* Katawan ng Ribbon */}
      <div className="px-3 py-2 flex flex-wrap items-center gap-1.5 min-h-[46px]">
        {tab === 'home' && editor && (
          <>
            <button
              type="button"
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
              className={`${btn()} disabled:opacity-35`}
              title="I-undo (Ctrl+Z)"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
              className={`${btn()} disabled:opacity-35`}
              title="I-redo (Ctrl+Y)"
            >
              <Redo2 className="w-4 h-4" />
            </button>

            <div className="h-5 w-px bg-blue-100 dark:bg-blue-900 mx-0.5" />

            {/* Estilo / Pamagat */}
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
              className="text-xs px-2 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-[#132340] text-slate-700 dark:text-slate-200 font-medium"
              title="Estilo ng Talata"
            >
              <option value="p">Karaniwang Teksto</option>
              <option value="h1">Pamagat / H1</option>
              <option value="h2">Pamagat 2</option>
              <option value="h3">Pamagat 3</option>
            </select>

            {/* Font Family */}
            <select
              value={editor.getAttributes('textStyle').fontFamily || ''}
              onChange={(e) => {
                const f = e.target.value;
                if (!f) editor.chain().focus().unsetFontFamily().run();
                else editor.chain().focus().setFontFamily(f).run();
              }}
              className="text-xs px-2 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-[#132340] text-slate-700 dark:text-slate-200"
              title="Uri ng Titik"
            >
              <option value="">Karaniwang Sans</option>
              <option value="'Newsreader', Georgia, serif">Akademikong Serif</option>
              <option value="'Times New Roman', serif">Times New Roman</option>
              <option value="'JetBrains Mono', monospace">Monospace</option>
              <option value="'Caveat', cursive">Sulat-Kamay</option>
            </select>

            <div className="h-5 w-px bg-blue-100 dark:bg-blue-900 mx-0.5" />

            <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={btn(editor.isActive('bold'))} title="Makapal (Ctrl+B)">
              <Bold className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={btn(editor.isActive('italic'))} title="Nakihilig (Ctrl+I)">
              <Italic className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} className={btn(editor.isActive('underline'))} title="May Salungguhit (Ctrl+U)">
              <Underline className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} className={btn(editor.isActive('strike'))} title="May Guhit sa Gitna">
              <Strikethrough className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => editor.chain().focus().toggleSubscript().run()} className={btn(editor.isActive('subscript'))} title="Subscript (H₂O)">
              <Subscript className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => editor.chain().focus().toggleSuperscript().run()} className={btn(editor.isActive('superscript'))} title="Superscript (x²)">
              <Superscript className="w-4 h-4" />
            </button>

            <label className="inline-flex items-center gap-0.5 px-1.5 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/60 cursor-pointer" title="Kulay ng Teksto">
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

            <label className="inline-flex items-center gap-0.5 px-1.5 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/60 cursor-pointer" title="Kulay ng Highlight">
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

            <div className="h-5 w-px bg-blue-100 dark:bg-blue-900 mx-0.5" />

            <button type="button" onClick={() => editor.chain().focus().setTextAlign('left').run()} className={btn(editor.isActive({ textAlign: 'left' }))} title="Ihanay sa Kaliwa">
              <AlignLeft className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => editor.chain().focus().setTextAlign('center').run()} className={btn(editor.isActive({ textAlign: 'center' }))} title="Igitna">
              <AlignCenter className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => editor.chain().focus().setTextAlign('right').run()} className={btn(editor.isActive({ textAlign: 'right' }))} title="Ihanay sa Kanan">
              <AlignRight className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => editor.chain().focus().setTextAlign('justify').run()} className={btn(editor.isActive({ textAlign: 'justify' }))} title="Pantayin ang Hanay">
              <AlignJustify className="w-4 h-4" />
            </button>

            <div className="h-5 w-px bg-blue-100 dark:bg-blue-900 mx-0.5" />

            <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={btn(editor.isActive('bulletList'))} title="Listahang May Tuldok">
              <List className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btn(editor.isActive('orderedList'))} title="Listahang May Bilang">
              <ListOrdered className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => editor.chain().focus().toggleTaskList().run()} className={btn(editor.isActive('taskList'))} title="Checklist">
              <CheckSquare className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
              className={btn(false)}
              title="Alisin ang Pag-format"
            >
              <Eraser className="w-4 h-4" />
            </button>

            <div className="h-5 w-px bg-blue-100 dark:bg-blue-900 mx-0.5" />

            <button
              type="button"
              onClick={onOpenImagePicker}
              className={pillBtn(false)}
              title="Magdagdag ng larawan sa tala"
            >
              <ImageIcon className="w-3.5 h-3.5 text-blue-600 dark:text-sky-400" /> Larawan
            </button>
            <button
              type="button"
              onClick={onToggleDoodle}
              className={pillBtn(doodleActive)}
              title="Gumuhit o mag-doodle gamit ang lapis, ballpen, at marker sa pahina"
            >
              <PenTool className="w-3.5 h-3.5" /> {doodleActive ? 'Gumuguhit (Isara)' : 'Guhit / Doodle'}
            </button>
            <button
              type="button"
              onClick={onExportDoc}
              className={pillBtn(false)}
              title="I-download ang talang ito bilang Word (.doc)"
            >
              <Download className="w-3.5 h-3.5 text-blue-600 dark:text-sky-400" /> I-download
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
              <Table className="w-3.5 h-3.5" /> Talahanayan (3×3)
            </button>
            {inTable && (
              <>
                <button type="button" onClick={() => editor.chain().focus().addRowAfter().run()} className={pillBtn()}>
                  <Rows3 className="w-3.5 h-3.5" /> +Hilera
                </button>
                <button type="button" onClick={() => editor.chain().focus().addColumnAfter().run()} className={pillBtn()}>
                  <Columns3 className="w-3.5 h-3.5" /> +Hanay
                </button>
                <button type="button" onClick={() => editor.chain().focus().deleteTable().run()} className={pillBtn()}>
                  <Trash2 className="w-3.5 h-3.5 text-rose-500" /> Burahin
                </button>
              </>
            )}
            <button type="button" onClick={onOpenImagePicker} className={pillBtn()}>
              <ImageIcon className="w-3.5 h-3.5" /> Larawan
            </button>
            <button type="button" onClick={onToggleDoodle} className={pillBtn(doodleActive)}>
              <PenTool className="w-3.5 h-3.5" /> Guhit sa Pahina
            </button>
            <button type="button" onClick={onOpenDoodlePanel} className={pillBtn()}>
              <PenTool className="w-3.5 h-3.5 text-blue-600 dark:text-sky-400" /> Panel ng Guhit (Ilakip)
            </button>
            <button type="button" onClick={onOpenMathModal} className={pillBtn()}>
              <Sigma className="w-3.5 h-3.5 text-blue-600 dark:text-sky-400" /> Pormulang Matematika
            </button>
            <button type="button" onClick={promptLink} className={pillBtn(editor.isActive('link'))}>
              <Link2 className="w-3.5 h-3.5" /> Link
            </button>
            <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={pillBtn(editor.isActive('blockquote'))}>
              <Quote className="w-3.5 h-3.5" /> Sipi / Tala
            </button>
            <button type="button" onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={pillBtn(editor.isActive('codeBlock'))}>
              <Code2 className="w-3.5 h-3.5" /> Kodigo
            </button>
            <button type="button" onClick={() => editor.chain().focus().setHorizontalRule().run()} className={pillBtn()}>
              <Minus className="w-3.5 h-3.5" /> Panghati
            </button>
          </>
        )}

        {tab === 'layout' && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 w-full">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-semibold text-slate-500">Estilo ng Papel:</span>
              <select
                value={paperStyle}
                onChange={(e) => onChangePaperStyle(e.target.value as PaperStyle)}
                className="px-2.5 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-[#132340] text-slate-700 dark:text-slate-200 font-medium"
              >
                <option value="plain">Blankong Papel</option>
                <option value="lined">Linyadong Papel</option>
                <option value="wide_ruled">Malawak na Linya</option>
                <option value="grid">Grid na Papel</option>
                <option value="dot">Papel na May Tuldok</option>
                <option value="cornell">Pahinang Lekturang Cornell</option>
                <option value="cream">Maligamgam na Krema</option>
                <option value="dark_board">Madilim na Pisara</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-semibold text-slate-500">Kulay ng Papel:</span>
              <div className="flex items-center gap-1">
                {PAPER_BG_SWATCHES.map((sw) => {
                  const active = paperBgColor === sw.value;
                  return (
                    <button
                      key={sw.value || 'auto'}
                      type="button"
                      onClick={() => onChangePaperBgColor(sw.value)}
                      title={sw.label}
                      aria-label={`Kulay ng papel ${sw.label}`}
                      className={`w-5 h-5 rounded-full border transition cursor-pointer ${
                        active
                          ? 'ring-2 ring-blue-600 ring-offset-1 border-blue-600 scale-110'
                          : 'border-blue-200 dark:border-blue-700 hover:scale-105'
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
              <span className="font-semibold text-slate-500">Laki ng Pahina:</span>
              <select
                value={pageSize}
                onChange={(e) => onChangePageSize(e.target.value as PageSize)}
                className="px-2.5 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-[#132340] text-slate-700 dark:text-slate-200"
              >
                <option value="compact">Siksik (B5)</option>
                <option value="a4">Pamantayang A4</option>
                <option value="letter">Liham (US Letter)</option>
                <option value="wide">Malawak na Studio</option>
                <option value="fluid">Buong Lapad</option>
              </select>
            </div>

            {!paperBgColor && (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="font-semibold text-slate-500">Tono:</span>
                <select
                  value={paperTone}
                  onChange={(e) => onChangePaperTone(e.target.value as 'light' | 'cream' | 'adaptive')}
                  className="px-2.5 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-[#132340] text-slate-700 dark:text-slate-200"
                >
                  <option value="light">Puting Malinis</option>
                  <option value="adaptive">Sumunod sa Madilim na Tema</option>
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={onToggleWorkspaceTheme}
              className={pillBtn(workspaceTheme === 'dark')}
              title="Lumipat sa maliwanag o madilim na tema ng workspace"
            >
              {workspaceTheme === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" /> Madilim na Tema
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-blue-600" /> Maliwanag na Tema
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
                className="w-20 accent-blue-600"
              />
              <span className="font-mono w-9">{zoom}%</span>
            </div>
          </div>
        )}

        {tab === 'review' && (
          <>
            <button type="button" onClick={onToggleFind} className={pillBtn()}>
              <Search className="w-3.5 h-3.5" /> Hanapin at Palitan
            </button>
            <button type="button" onClick={onSaveSnapshot} className={pillBtn()}>
              <Save className="w-3.5 h-3.5 text-emerald-600" /> I-save ang Bersyon
            </button>
            <button type="button" onClick={onOpenVersions} className={pillBtn()}>
              <History className="w-3.5 h-3.5 text-blue-600 dark:text-sky-400" /> Kasaysayan ng Bersyon
            </button>
            <div className="h-5 w-px bg-blue-100 dark:bg-blue-900 mx-1" />
            <button type="button" onClick={onExportDoc} className={pillBtn()}>
              <FileDown className="w-3.5 h-3.5 text-blue-600 dark:text-sky-400" /> I-download na Word (.doc)
            </button>
            <button type="button" onClick={onPrintPdf} className={pillBtn()}>
              <Printer className="w-3.5 h-3.5" /> I-print / I-save na PDF
            </button>
            <button type="button" onClick={onExportHtml} className={pillBtn()}>
              <FileDown className="w-3.5 h-3.5" /> I-export na HTML
            </button>
            <button type="button" onClick={onExportMarkdown} className={pillBtn()}>
              <Download className="w-3.5 h-3.5" /> I-export na .MD
            </button>
            <button type="button" onClick={onExportTxt} className={pillBtn()}>
              <Download className="w-3.5 h-3.5" /> I-export na .TXT
            </button>
            <button type="button" onClick={onOpenShare} className={pillBtn()}>
              <Share2 className="w-3.5 h-3.5 text-blue-600 dark:text-sky-400" /> Ibahagi ang Link
            </button>
          </>
        )}
      </div>
    </div>
  );
};
