import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  maxWidthClass?: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  subtitle,
  maxWidthClass = 'max-w-lg',
  children,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 backdrop-blur-xs p-4 overflow-y-auto"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`w-full ${maxWidthClass} bg-white dark:bg-[#0D1930] border border-blue-100 dark:border-blue-900/70 rounded-2xl shadow-2xl overflow-hidden my-auto`}
      >
        <div className="flex items-start justify-between px-6 py-4 border-b border-blue-100 dark:border-blue-900/60">
          <div>
            <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
            {subtitle && (
              <p className="text-xs text-slate-500 dark:text-blue-200/75 mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-700 dark:hover:text-blue-200 hover:bg-blue-50 dark:hover:bg-blue-950/60 transition cursor-pointer"
            aria-label="Isara"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};
