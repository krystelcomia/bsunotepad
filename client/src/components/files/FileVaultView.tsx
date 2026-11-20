import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Download,
  Eye,
  File,
  FileText,
  FolderOpen,
  Trash2,
  Upload,
} from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Attachment, Subject } from '../../types';
import { formatBytes, formatRelativeTime } from '../../utils/format';
import { Modal } from '../common/Modal';

interface FileVaultViewProps {
  subjects: Subject[];
  onNotify: (type: 'success' | 'error' | 'info', text: string) => void;
}

export const FileVaultView: React.FC<FileVaultViewProps> = ({ subjects, onNotify }) => {
  const { setStorageUsedBytes } = useAuth();
  const [files, setFiles] = useState<Attachment[]>([]);
  const [storage, setStorage] = useState({ usedBytes: 0, quotaBytes: 262144000 });
  const [category, setCategory] = useState<string>('all');
  const [subjectId, setSubjectId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [previewFile, setPreviewFile] = useState<Attachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.listFiles(category !== 'all' ? { category } : undefined);
      setFiles(res.files);
      setStorage(res.storage);
      setStorageUsedBytes(res.storage.usedBytes);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Nabigong i-load ang mga file');
    } finally {
      setLoading(false);
    }
  }, [category, onNotify, setStorageUsedBytes]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const handleUploadFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    try {
      for (const f of Array.from(fileList)) {
        await api.uploadFile(f, { subjectId: subjectId || null });
      }
      onNotify('success', `Na-upload ang ${fileList.length} file sa baul!`);
      await loadFiles();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Nabigo ang pag-upload');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (f: Attachment) => {
    if (!window.confirm(`Permanenteng burahin ang "${f.original_name}" mula sa iyong Baul ng File?`)) return;
    try {
      const res = await api.deleteFile(f.id);
      setStorage(res.storage);
      setStorageUsedBytes(res.storage.usedBytes);
      setFiles((prev) => prev.filter((x) => x.id !== f.id));
      onNotify('info', 'Nabura ang file');
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Nabigong burahin');
    }
  };

  const pct = Math.min(100, Math.round((storage.usedBytes / (storage.quotaBytes || 1)) * 100));

  return (
    <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            Akademikong Baul ng File
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Ligtas na mag-imbak ng mga silabus, PDF, slide ng lektura, dayagram, at datos ng pag-aaral.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="text-xs px-3 py-2.5 rounded-xl border border-blue-200 dark:border-blue-800 bg-white dark:bg-[#0D1930]"
          >
            <option value="">I-tag sa asignatura (opsiyonal)</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code ? `${s.code} · ${s.name}` : s.name}
              </option>
            ))}
          </select>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              handleUploadFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold shadow-sm cursor-pointer disabled:opacity-60"
          >
            <Upload className="w-4 h-4" />
            {uploading ? 'Ina-upload...' : 'Mag-upload ng mga File'}
          </button>
        </div>
      </div>

      {/* Limitasyon at Dropzone */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleUploadFiles(e.dataTransfer.files);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`lg:col-span-2 rounded-2xl border-2 border-dashed p-6 flex items-center justify-center gap-4 cursor-pointer transition ${
            dragging
              ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/30'
              : 'border-blue-200 dark:border-blue-800 bg-white dark:bg-[#0D1930] hover:border-blue-400'
          }`}
        >
          <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-sky-300">
            <Upload className="w-6 h-6" />
          </div>
          <div>
            <div className="font-semibold text-sm text-slate-900 dark:text-white">
              I-drag at i-drop ang mga file rito o pindutin upang pumili
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              Tumatanggap ng PDF, larawan, Markdown, dokumentong Office, CSV, at iba pang file hanggang 20 MB bawat isa.
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-[#0D1930] border border-blue-200/80 dark:border-blue-800/70 p-5 flex flex-col justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Limitasyon sa Storage</div>
            <div className="font-display text-xl font-extrabold text-slate-900 dark:text-white mt-1">
              {formatBytes(storage.usedBytes)}{' '}
              <span className="text-xs font-normal text-slate-400">/ {formatBytes(storage.quotaBytes)}</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="h-2 rounded-full bg-blue-100 dark:bg-blue-950 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-700 to-sky-500 rounded-full transition-all" style={{ width: `${Math.max(2, pct)}%` }} />
            </div>
            <div className="text-[11px] text-slate-400 mt-1.5">{pct}% ang nagamit sa {files.length} file</div>
          </div>
        </div>
      </div>

      {/* Filter ng Kategorya */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-white dark:bg-[#0D1930] border border-blue-200/80 dark:border-blue-800/70 w-fit">
        {[
          { id: 'all', label: 'Lahat ng File' },
          { id: 'image', label: 'Mga Larawan' },
          { id: 'pdf', label: 'Mga PDF' },
          { id: 'document', label: 'Mga Dokumento' },
          { id: 'other', label: 'Iba pa' },
        ].map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategory(c.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              category === c.id
                ? 'bg-blue-700 text-white'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Grid ng mga File */}
      {loading ? (
        <div className="py-12 text-center text-sm text-slate-400">Nilo-load ang mga file...</div>
      ) : files.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-[#0D1930] border border-dashed border-blue-200 dark:border-blue-800 p-12 text-center">
          <FolderOpen className="w-10 h-10 text-blue-300 dark:text-blue-700 mx-auto mb-3" />
          <div className="font-semibold text-sm text-slate-700 dark:text-slate-200">Walang file sa kategoryang ito</div>
          <p className="text-xs text-slate-400 mt-1">Mag-upload ng mga PDF, larawan, o kagamitan sa pag-aaral upang maisaayos dito.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {files.map((f) => (
            <div
              key={f.id}
              className="rounded-2xl bg-white dark:bg-[#0D1930] border border-blue-200/80 dark:border-blue-800/70 p-4 flex flex-col justify-between gap-3 hover:shadow-md transition"
            >
              <div className="flex items-start gap-3">
                {f.category === 'image' ? (
                  <img
                    src={`/api/files/${f.id}/content`}
                    alt={f.original_name}
                    className="w-14 h-14 rounded-xl object-cover border border-blue-200 dark:border-blue-800 shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-sky-300 flex items-center justify-center shrink-0">
                    {f.category === 'pdf' ? (
                      <FileText className="w-6 h-6 text-rose-500" />
                    ) : f.category === 'document' ? (
                      <FileText className="w-6 h-6" />
                    ) : (
                      <File className="w-6 h-6" />
                    )}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-slate-900 dark:text-white truncate" title={f.original_name}>
                    {f.original_name}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {formatBytes(f.size_bytes)} · {formatRelativeTime(f.created_at)}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {f.subject_code && (
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white"
                        style={{ backgroundColor: f.subject_color || '#2563EB' }}
                      >
                        {f.subject_code}
                      </span>
                    )}
                    {f.note_title && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-[#132340] text-blue-700 dark:text-blue-200 truncate max-w-[140px]">
                        {f.note_title}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-2.5 border-t border-blue-100 dark:border-blue-900/60 flex items-center justify-end gap-2">
                {(f.category === 'image' || f.category === 'pdf' || f.mime_type.startsWith('text/')) && (
                  <button
                    type="button"
                    onClick={() => setPreviewFile(f)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-blue-600 dark:text-sky-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" /> Tingnan
                  </button>
                )}
                <a
                  href={`/api/files/${f.id}/content?download=1`}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-[#132340]"
                >
                  <Download className="w-3.5 h-3.5" /> I-download
                </a>
                <button
                  type="button"
                  onClick={() => handleDelete(f)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                  title="Burahin ang file"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal ng Preview ng File */}
      <Modal
        open={Boolean(previewFile)}
        onClose={() => setPreviewFile(null)}
        title={previewFile?.original_name || 'Preview ng File'}
        subtitle={previewFile ? `${formatBytes(previewFile.size_bytes)} · ${previewFile.mime_type}` : ''}
        maxWidthClass="max-w-4xl"
      >
        {previewFile && (
          <div className="space-y-4">
            {previewFile.category === 'image' ? (
              <div className="flex justify-center bg-blue-50/50 dark:bg-[#132340] rounded-xl p-4">
                <img
                  src={`/api/files/${previewFile.id}/content`}
                  alt={previewFile.original_name}
                  className="max-h-[65vh] rounded-lg object-contain"
                />
              </div>
            ) : (
              <iframe
                src={`/api/files/${previewFile.id}/content`}
                title={previewFile.original_name}
                className="w-full h-[65vh] rounded-xl border border-blue-200 dark:border-blue-800 bg-white"
              />
            )}
            <div className="flex justify-end">
              <a
                href={`/api/files/${previewFile.id}/content?download=1`}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-700 text-white text-xs font-semibold"
              >
                <Download className="w-4 h-4" /> I-download ang Orihinal
              </a>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
