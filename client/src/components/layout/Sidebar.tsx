import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Folder as FolderIcon,
  FolderOpen,
  GraduationCap,
  Home,
  LogOut,
  NotebookPen,
  Plus,
  Search,
  Settings,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Folder, Notebook, Subject } from '../../types';
import { formatBytes } from '../../utils/format';
import { BrandLogo } from '../common/BrandLogo';

export type NavSection =
  | { kind: 'dashboard' }
  | {
      kind: 'notes';
      filter?: 'all' | 'starred' | 'trash';
      folderId?: string;
      subjectId?: string;
      notebookId?: string;
    }
  | { kind: 'files' }
  | { kind: 'study' };

interface SidebarProps {
  openMobile: boolean;
  onCloseMobile: () => void;
  activeNav: NavSection;
  onNavigate: (nav: NavSection) => void;
  folders: Folder[];
  subjects: Subject[];
  notebooks: Notebook[];
  trashedCount: number;
  onOpenSearch: () => void;
  onNewNote: (opts?: { folderId?: string; notebookId?: string; subjectId?: string }) => void;
  onNewFolder: () => void;
  onEditFolder: (folder: Folder) => void;
  onNewSubject: () => void;
  onEditSubject: (subject: Subject) => void;
  onNewNotebook: () => void;
  onEditNotebook: (notebook: Notebook) => void;
  onOpenAccount: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  openMobile,
  onCloseMobile,
  activeNav,
  onNavigate,
  folders,
  subjects,
  notebooks,
  trashedCount,
  onOpenSearch,
  onNewNote,
  onNewFolder,
  onEditFolder,
  onNewSubject,
  onEditSubject,
  onNewNotebook,
  onEditNotebook,
  onOpenAccount,
}) => {
  const { user, storageUsedBytes, logout } = useAuth();
  const [foldersExpanded, setFoldersExpanded] = useState(true);
  const [coursesExpanded, setCoursesExpanded] = useState(true);
  const [notebooksExpanded, setNotebooksExpanded] = useState(true);

  const quota = user?.storage_quota_bytes || 262144000;
  const pct = Math.min(100, Math.round((storageUsedBytes / quota) * 100));

  const accentGradient =
    user?.workspace_accent === 'blue'
      ? 'from-blue-700 to-sky-500 shadow-blue-600/20'
      : user?.workspace_accent === 'lavender'
        ? 'from-purple-600 to-violet-400 shadow-purple-500/20'
        : 'from-violet-800 via-purple-700 to-blue-600 shadow-violet-700/20';

  const isNavActive = (check: NavSection) => {
    if (activeNav.kind !== check.kind) return false;
    if (check.kind === 'notes' && activeNav.kind === 'notes') {
      return (
        activeNav.filter === check.filter &&
        activeNav.folderId === check.folderId &&
        activeNav.subjectId === check.subjectId &&
        activeNav.notebookId === check.notebookId
      );
    }
    return true;
  };

  const navBtn = (active: boolean) =>
    `w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition cursor-pointer ${
      active
        ? `bg-gradient-to-r ${accentGradient} text-white shadow-sm`
        : 'text-slate-600 dark:text-violet-100/75 hover:bg-violet-100/70 dark:hover:bg-violet-950/60'
    }`;

  const content = (
    <aside className="w-72 h-full flex flex-col bg-[#F1EEFA] dark:bg-[#110D22] border-r border-violet-200/80 dark:border-violet-900/50 select-none">
      {/* Header */}
      <div className="px-4 py-4 flex items-center justify-between border-b border-violet-200/60 dark:border-violet-900/40">
        <button
          type="button"
          onClick={() => {
            onNavigate({ kind: 'dashboard' });
            onCloseMobile();
          }}
          className="text-left cursor-pointer"
          title="Go to Student Dashboard"
        >
          <BrandLogo size="sm" showTagline={false} />
        </button>
        <button
          type="button"
          onClick={onCloseMobile}
          className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-violet-100 dark:hover:bg-violet-900/50"
          aria-label="Close sidebar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Primary Action + Search */}
      <div className="p-3 space-y-2">
        <button
          type="button"
          onClick={() => onNewNote()}
          className={`w-full py-2.5 px-3.5 rounded-xl bg-gradient-to-r ${accentGradient} hover:brightness-110 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-md transition cursor-pointer`}
        >
          <Plus className="w-4 h-4" />
          New Note / Document
        </button>

        <button
          type="button"
          onClick={onOpenSearch}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white/90 dark:bg-[#1A1533] border border-violet-200/80 dark:border-violet-800/60 text-xs text-slate-500 dark:text-violet-200/70 hover:border-violet-400 transition cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-violet-500" />
            Quick Search...
          </span>
          <kbd className="px-1.5 py-0.5 rounded bg-violet-50 dark:bg-[#251E45] text-[10px] font-mono">
            Ctrl K
          </kbd>
        </button>
      </div>

      {/* Main Nav */}
      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-5">
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => {
              onNavigate({ kind: 'dashboard' });
              onCloseMobile();
            }}
            className={navBtn(isNavActive({ kind: 'dashboard' }))}
          >
            <Home className="w-4 h-4 shrink-0" />
            <span>Dashboard</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onNavigate({ kind: 'notes', filter: 'all' });
              onCloseMobile();
            }}
            className={navBtn(isNavActive({ kind: 'notes', filter: 'all' }))}
          >
            <FileText className="w-4 h-4 shrink-0" />
            <span>All Notes</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onNavigate({ kind: 'notes', filter: 'starred' });
              onCloseMobile();
            }}
            className={navBtn(isNavActive({ kind: 'notes', filter: 'starred' }))}
          >
            <Star className="w-4 h-4 shrink-0" />
            <span>Starred</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onNavigate({ kind: 'study' });
              onCloseMobile();
            }}
            className={navBtn(isNavActive({ kind: 'study' }))}
          >
            <GraduationCap className="w-4 h-4 shrink-0" />
            <span>Study Hub & Flashcards</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onNavigate({ kind: 'files' });
              onCloseMobile();
            }}
            className={navBtn(isNavActive({ kind: 'files' }))}
          >
            <FolderOpen className="w-4 h-4 shrink-0" />
            <span>File Vault</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onNavigate({ kind: 'notes', filter: 'trash' });
              onCloseMobile();
            }}
            className={navBtn(isNavActive({ kind: 'notes', filter: 'trash' }))}
          >
            <Trash2 className="w-4 h-4 shrink-0" />
            <span className="flex-1 text-left">Trash</span>
            {trashedCount > 0 && (
              <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-violet-200/80 dark:bg-violet-900 text-violet-900 dark:text-violet-200">
                {trashedCount}
              </span>
            )}
          </button>
        </div>

        {/* Folders */}
        <div>
          <div className="flex items-center justify-between px-2 mb-1.5">
            <button
              type="button"
              onClick={() => setFoldersExpanded((v) => !v)}
              className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-violet-300/70 hover:text-violet-800 cursor-pointer"
            >
              {foldersExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              Folders ({folders.length})
            </button>
            <button
              type="button"
              onClick={onNewFolder}
              className="p-1 rounded-md text-slate-500 hover:bg-violet-200/60 dark:hover:bg-violet-900/50 hover:text-violet-700 cursor-pointer"
              title="New Folder"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          {foldersExpanded && (
            <div className="space-y-0.5">
              {folders.map((folder) => {
                const active = isNavActive({ kind: 'notes', folderId: folder.id });
                return (
                  <div key={folder.id} className="group flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        onNavigate({ kind: 'notes', folderId: folder.id });
                        onCloseMobile();
                      }}
                      className={`flex-1 min-w-0 flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                        active
                          ? 'bg-violet-700 text-white'
                          : 'text-slate-700 dark:text-violet-100/80 hover:bg-violet-100/80 dark:hover:bg-violet-950/60'
                      }`}
                    >
                      <FolderIcon
                        className="w-3.5 h-3.5 shrink-0"
                        style={{ color: active ? '#FFFFFF' : folder.color }}
                      />
                      <span className="truncate flex-1 text-left">{folder.name}</span>
                      <span className="text-[10px] opacity-70">{folder.note_count ?? 0}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onEditFolder(folder)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-400 hover:text-violet-700 dark:hover:text-violet-200 cursor-pointer"
                      title="Edit folder"
                    >
                      <Settings className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
              {folders.length === 0 && (
                <p className="px-3 py-1.5 text-xs text-slate-400 italic">No folders yet</p>
              )}
            </div>
          )}
        </div>

        {/* Courses / Subjects */}
        <div>
          <div className="flex items-center justify-between px-2 mb-1.5">
            <button
              type="button"
              onClick={() => setCoursesExpanded((v) => !v)}
              className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-violet-300/70 hover:text-violet-800 cursor-pointer"
            >
              {coursesExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              Courses ({subjects.length})
            </button>
            <button
              type="button"
              onClick={onNewSubject}
              className="p-1 rounded-md text-slate-500 hover:bg-violet-200/60 dark:hover:bg-violet-900/50 hover:text-violet-700 cursor-pointer"
              title="Add Course"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          {coursesExpanded && (
            <div className="space-y-0.5">
              {subjects.map((sub) => {
                const active = isNavActive({ kind: 'notes', subjectId: sub.id });
                return (
                  <div key={sub.id} className="group flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        onNavigate({ kind: 'notes', subjectId: sub.id });
                        onCloseMobile();
                      }}
                      className={`flex-1 min-w-0 flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                        active
                          ? 'bg-violet-700 text-white'
                          : 'text-slate-700 dark:text-violet-100/80 hover:bg-violet-100/80 dark:hover:bg-violet-950/60'
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: active ? '#FFFFFF' : sub.color }}
                      />
                      <span className="truncate flex-1 text-left">
                        {sub.code ? `${sub.code} · ${sub.name}` : sub.name}
                      </span>
                      <span className="text-[10px] opacity-70">{sub.note_count ?? 0}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onEditSubject(sub)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-400 hover:text-violet-700 dark:hover:text-violet-200 cursor-pointer"
                      title="Edit course"
                    >
                      <Settings className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
              {subjects.length === 0 && (
                <p className="px-3 py-1.5 text-xs text-slate-400 italic">No courses yet</p>
              )}
            </div>
          )}
        </div>

        {/* Notebooks */}
        <div>
          <div className="flex items-center justify-between px-2 mb-1.5">
            <button
              type="button"
              onClick={() => setNotebooksExpanded((v) => !v)}
              className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-violet-300/70 hover:text-violet-800 cursor-pointer"
            >
              {notebooksExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              Notebooks ({notebooks.length})
            </button>
            <button
              type="button"
              onClick={onNewNotebook}
              className="p-1 rounded-md text-slate-500 hover:bg-violet-200/60 dark:hover:bg-violet-900/50 hover:text-violet-700 cursor-pointer"
              title="New Notebook"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          {notebooksExpanded && (
            <div className="space-y-0.5">
              {notebooks.map((nb) => {
                const active = isNavActive({ kind: 'notes', notebookId: nb.id });
                return (
                  <div key={nb.id} className="group flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        onNavigate({ kind: 'notes', notebookId: nb.id });
                        onCloseMobile();
                      }}
                      className={`flex-1 min-w-0 flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                        active
                          ? 'bg-violet-700 text-white'
                          : 'text-slate-700 dark:text-violet-100/80 hover:bg-violet-100/80 dark:hover:bg-violet-950/60'
                      }`}
                    >
                      <NotebookPen
                        className="w-3.5 h-3.5 shrink-0"
                        style={{ color: active ? '#FFFFFF' : nb.cover_color }}
                      />
                      <span className="truncate flex-1 text-left">{nb.title}</span>
                      <span className="text-[10px] opacity-70">{nb.note_count ?? 0}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onEditNotebook(nb)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-400 hover:text-violet-700 dark:hover:text-violet-200 cursor-pointer"
                      title="Notebook settings"
                    >
                      <Settings className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
              {notebooks.length === 0 && (
                <p className="px-3 py-1.5 text-xs text-slate-400 italic">No notebooks yet</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Storage & Profile */}
      <div className="p-3 border-t border-violet-200/70 dark:border-violet-900/50 space-y-2.5 bg-[#EAE5F7]/80 dark:bg-[#0D0A1A]">
        <div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-violet-200/70 mb-1">
            <span className="font-medium">Vault Storage</span>
            <span>
              {formatBytes(storageUsedBytes)} / {formatBytes(quota)}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-violet-200/70 dark:bg-violet-950 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-700 to-blue-500 transition-all"
              style={{ width: `${Math.max(2, pct)}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onOpenAccount}
            className="flex-1 min-w-0 flex items-center gap-2.5 p-2 rounded-xl hover:bg-white/80 dark:hover:bg-violet-950/70 transition text-left cursor-pointer"
            title="Account Settings & Profile"
          >
            {user?.avatar_file ? (
              <img
                src={`/api/account/avatar/${user.id}/${user.avatar_file}`}
                alt={user.full_name}
                className="w-8 h-8 rounded-full object-cover ring-1 ring-violet-300 dark:ring-violet-700 shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-700 to-blue-500 text-white text-xs font-bold flex items-center justify-center shrink-0">
                {(user?.full_name || 'S').slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                {user?.full_name}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-violet-200/70 truncate">
                {user?.major || user?.email}
              </div>
            </div>
            <Settings className="w-4 h-4 text-slate-400 shrink-0" />
          </button>
          <button
            type="button"
            onClick={() => logout()}
            className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer shrink-0"
            title="Sign Out"
            aria-label="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      <div className="hidden lg:block h-full shrink-0">{content}</div>
      {openMobile && (
        <div
          className="fixed inset-0 z-50 lg:hidden flex bg-slate-950/50 backdrop-blur-xs"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onCloseMobile();
          }}
        >
          <div className="h-full">{content}</div>
        </div>
      )}
    </>
  );
};
