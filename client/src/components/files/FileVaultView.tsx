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
      onNotify('error', err instanceof Error ? err.message : 'Failed to load files');
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
      onNotify('success', `Uploaded ${fileList.length} file(s) to vault!`);
      await loadFiles();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (f: Attachment) => {
    if (!window.confirm(`Delete "${f.original_name}" permanently from your File Vault?`)) return;
    try {
      const res = await api.deleteFile(f.id);
      setStorage(res.storage);
      setStorageUsedBytes(res.storage.usedBytes);
      setFiles((prev) => prev.filter((x) => x.id !== f.id));
      onNotify('info', 'File deleted');
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const pct = Math.min(100, Math.round((storage.usedBytes / (storage.quotaBytes || 1)) * 100));

  return (
    <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            Academic File Vault
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Store syllabi, PDFs, lecture slides, reference diagrams, and datasets securely.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="text-xs px-3 py-2.5 rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900"
          >
            <option value="">Tag course on upload (optional)</option>
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
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-sm cursor-pointer disabled:opacity-60"
          >
            <Upload className="w-4 h-4" />
            {uploading ? 'Uploading...' : 'Upload Files'}
          </button>
        </div>
      </div>

      {/* Quota + Dropzone */}
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
              ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/30'
              : 'border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-indigo-400'
          }`}
        >
          <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300">
            <Upload className="w-6 h-6" />
          </div>
          <div>
            <div className="font-semibold text-sm text-slate-900 dark:text-white">
              Drag & drop files here or click to browse
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              Supports PDFs, images, Markdown, Office docs, CSV, and datasets up to 20 MB each.
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 p-5 flex flex-col justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Storage Quota</div>
            <div className="font-display text-xl font-extrabold text-slate-900 dark:text-white mt-1">
              {formatBytes(storage.usedBytes)}{' '}
              <span className="text-xs font-normal text-slate-400">/ {formatBytes(storage.quotaBytes)}</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="h-2 rounded-full bg-stone-200 dark:bg-slate-800 overflow-hidden">
              <div className="h-full bg-indigo-600 rounded-full transition-all" style={{ width: `${Math.max(2, pct)}%` }} />
            </div>
            <div className="text-[11px] text-slate-400 mt-1.5">{pct}% used across {files.length} file(s)</div>
          </div>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 w-fit">
        {[
          { id: 'all', label: 'All Files' },
          { id: 'image', label: 'Images' },
          { id: 'pdf', label: 'PDFs' },
          { id: 'document', label: 'Documents' },
          { id: 'other', label: 'Other' },
        ].map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategory(c.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              category === c.id
                ? 'bg-indigo-600 text-white'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* File Grid */}
      {loading ? (
        <div className="py-12 text-center text-sm text-slate-400">Loading files...</div>
      ) : files.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-dashed border-stone-300 dark:border-slate-700 p-12 text-center">
          <FolderOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <div className="font-semibold text-sm text-slate-700 dark:text-slate-200">No files in this category</div>
          <p className="text-xs text-slate-400 mt-1">Upload PDFs, images, or study materials to organize them here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {files.map((f) => (
            <div
              key={f.id}
              className="rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 p-4 flex flex-col justify-between gap-3 hover:shadow-md transition"
            >
              <div className="flex items-start gap-3">
                {f.category === 'image' ? (
                  <img
                    src={`/api/files/${f.id}/content`}
                    alt={f.original_name}
                    className="w-14 h-14 rounded-xl object-cover border border-stone-200 dark:border-slate-700 shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 flex items-center justify-center shrink-0">
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
                        style={{ backgroundColor: f.subject_color || '#4F46E5' }}
                      >
                        {f.subject_code}
                      </span>
                    )}
                    {f.note_title && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 dark:bg-slate-800 text-slate-500 truncate max-w-[140px]">
                        {f.note_title}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-2.5 border-t border-stone-100 dark:border-slate-800 flex items-center justify-end gap-2">
                {(f.category === 'image' || f.category === 'pdf' || f.mime_type.startsWith('text/')) && (
                  <button
                    type="button"
                    onClick={() => setPreviewFile(f)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" /> Preview
                  </button>
                )}
                <a
                  href={`/api/files/${f.id}/content?download=1`}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-800"
                >
                  <Download className="w-3.5 h-3.5" /> Download
                </a>
                <button
                  type="button"
                  onClick={() => handleDelete(f)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                  title="Delete file"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview Modal */}
      <Modal
        open={Boolean(previewFile)}
        onClose={() => setPreviewFile(null)}
        title={previewFile?.original_name || 'File Preview'}
        subtitle={previewFile ? `${formatBytes(previewFile.size_bytes)} · ${previewFile.mime_type}` : ''}
        maxWidthClass="max-w-4xl"
      >
        {previewFile && (
          <div className="space-y-4">
            {previewFile.category === 'image' ? (
              <div className="flex justify-center bg-stone-100 dark:bg-slate-800 rounded-xl p-4">
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
                className="w-full h-[65vh] rounded-xl border border-stone-200 dark:border-slate-700 bg-white"
              />
            )}
            <div className="flex justify-end">
              <a
                href={`/api/files/${previewFile.id}/content?download=1`}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold"
              >
                <Download className="w-4 h-4" /> Download Original
              </a>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
