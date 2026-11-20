import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FileText,
  FolderOpen,
  GraduationCap,
  Home,
  LogOut,
  Menu,
  Moon,
  Search,
  Sun,
  User as UserIcon,
} from 'lucide-react';
import { api } from './api/client';
import { AccountModal } from './components/account/AccountModal';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AuthPage } from './components/auth/AuthPage';
import { ToastContainer, ToastMessage } from './components/common/Toast';
import { DashboardView } from './components/dashboard/DashboardView';
import { NoteWorkspace } from './components/editor/NoteWorkspace';
import { FileVaultView } from './components/files/FileVaultView';
import { CommandPalette } from './components/layout/CommandPalette';
import { NavSection, Sidebar } from './components/layout/Sidebar';
import { SharedNoteView } from './components/shared/SharedNoteView';
import { PomodoroWidget } from './components/study/PomodoroWidget';
import { StudyHubView } from './components/study/StudyHubView';
import { FolderModal, NotebookModal, SubjectModal } from './components/workspace/Modals';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { Folder, Notebook, Note, NoteSortOption, Subject, WorkspaceSummary } from './types';

function parseShareToken(pathname: string, search: string): string | null {
  const qs = new URLSearchParams(search);
  const queryShare = qs.get('share');
  if (queryShare) return queryShare;
  const clean = pathname.replace(/\/+$/, '');
  if (clean.startsWith('/shared/')) {
    return decodeURIComponent(clean.slice('/shared/'.length)) || null;
  }
  return null;
}

function parseWorkspaceLocation(pathname: string): { nav: NavSection; noteId: string | null } {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean.startsWith('/studio/')) {
    const id = decodeURIComponent(clean.slice('/studio/'.length));
    return { nav: { kind: 'notes', filter: 'all' }, noteId: id || null };
  }
  if (clean === '/files') return { nav: { kind: 'files' }, noteId: null };
  if (clean === '/study') return { nav: { kind: 'study' }, noteId: null };
  if (clean === '/notes/starred') return { nav: { kind: 'notes', filter: 'starred' }, noteId: null };
  if (clean === '/notes/trash') return { nav: { kind: 'notes', filter: 'trash' }, noteId: null };
  if (clean.startsWith('/notes/folder/')) {
    return {
      nav: { kind: 'notes', folderId: decodeURIComponent(clean.slice('/notes/folder/'.length)) },
      noteId: null,
    };
  }
  if (clean.startsWith('/notes/course/')) {
    return {
      nav: { kind: 'notes', subjectId: decodeURIComponent(clean.slice('/notes/course/'.length)) },
      noteId: null,
    };
  }
  if (clean.startsWith('/notes/notebook/')) {
    return {
      nav: { kind: 'notes', notebookId: decodeURIComponent(clean.slice('/notes/notebook/'.length)) },
      noteId: null,
    };
  }
  if (clean === '/notes') return { nav: { kind: 'notes', filter: 'all' }, noteId: null };
  return { nav: { kind: 'dashboard' }, noteId: null };
}

function buildWorkspacePath(nav: NavSection, noteId: string | null): string {
  if (noteId) return `/studio/${encodeURIComponent(noteId)}`;
  if (nav.kind === 'files') return '/files';
  if (nav.kind === 'study') return '/study';
  if (nav.kind === 'notes') {
    if (nav.filter === 'starred') return '/notes/starred';
    if (nav.filter === 'trash') return '/notes/trash';
    if (nav.folderId) return `/notes/folder/${encodeURIComponent(nav.folderId)}`;
    if (nav.subjectId) return `/notes/course/${encodeURIComponent(nav.subjectId)}`;
    if (nav.notebookId) return `/notes/notebook/${encodeURIComponent(nav.notebookId)}`;
    return '/notes';
  }
  return '/dashboard';
}

const WorkspaceShell: React.FC = () => {
  const { user, loading: authLoading, setStorageUsedBytes, logout } = useAuth();
  const { resolved, toggle: toggleTheme } = useTheme();

  const [shareToken, setShareToken] = useState<string | null>(() =>
    parseShareToken(window.location.pathname, window.location.search)
  );

  const initialRoute = useMemo(() => parseWorkspaceLocation(window.location.pathname), []);
  const [summary, setSummary] = useState<WorkspaceSummary | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNav, setActiveNav] = useState<NavSection>(initialRoute.nav);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(initialRoute.noteId);
  const [noteListQuery, setNoteListQuery] = useState('');
  const [noteCategoryFilter, setNoteCategoryFilter] = useState('all');
  const [noteSort, setNoteSort] = useState<NoteSortOption>('updated_desc');

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const [folderModal, setFolderModal] = useState<{ open: boolean; editing: Folder | null }>({
    open: false,
    editing: null,
  });
  const [subjectModal, setSubjectModal] = useState<{ open: boolean; editing: Subject | null }>({
    open: false,
    editing: null,
  });
  const [notebookModal, setNotebookModal] = useState<{ open: boolean; editing: Notebook | null }>({
    open: false,
    editing: null,
  });

  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const notify = useCallback((type: 'success' | 'error' | 'info', text: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, type, text }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3600);
  }, []);

  const fetchFilteredNotes = useCallback(async () => {
    if (!user || user.role !== 'student') return;
    try {
      const commonFilters = {
        q: noteListQuery.trim() || undefined,
        category: noteCategoryFilter !== 'all' ? noteCategoryFilter : undefined,
        sort: noteSort,
      };
      if (activeNav.kind === 'notes') {
        const listRes = await api.listNotes({
          folderId: activeNav.folderId,
          notebookId: activeNav.notebookId,
          subjectId: activeNav.subjectId,
          starred: activeNav.filter === 'starred',
          trashed: activeNav.filter === 'trash',
          ...commonFilters,
        });
        setNotes(listRes.notes);
      } else {
        const listRes = await api.listNotes(commonFilters);
        setNotes(listRes.notes);
      }
    } catch {
      // ignore fetch errors during rapid typing
    }
  }, [user, activeNav, noteListQuery, noteCategoryFilter, noteSort]);

  const refreshWorkspace = useCallback(async () => {
    if (!user || user.role !== 'student') return;
    try {
      const sum = await api.workspaceSummary();
      setSummary(sum);
      setStorageUsedBytes(sum.stats.storageUsedBytes);
      await fetchFilteredNotes();
    } catch {
      // ignore initial errors
    }
  }, [user, setStorageUsedBytes, fetchFilteredNotes]);

  useEffect(() => {
    if (!user || user.role !== 'student') return;
    api
      .workspaceSummary()
      .then((sum) => {
        setSummary(sum);
        setStorageUsedBytes(sum.stats.storageUsedBytes);
      })
      .catch(() => {
        // ignore initial errors
      });
  }, [user, setStorageUsedBytes]);

  useEffect(() => {
    if (!user || user.role !== 'student') return;
    const timer = window.setTimeout(() => {
      fetchFilteredNotes();
    }, noteListQuery.trim() ? 180 : 0);
    return () => window.clearTimeout(timer);
  }, [user, noteListQuery, fetchFilteredNotes]);

  const navigateTo = useCallback((nav: NavSection, noteId: string | null = null, replace = false) => {
    setActiveNav(nav);
    setActiveNoteId(noteId);
    const nextPath = buildWorkspacePath(nav, noteId);
    if (window.location.pathname !== nextPath) {
      if (replace) {
        window.history.replaceState({}, '', nextPath);
      } else {
        window.history.pushState({}, '', nextPath);
      }
    }
  }, []);

  const openNoteStudio = useCallback(
    (noteId: string) => {
      navigateTo(activeNav, noteId);
    },
    [activeNav, navigateTo]
  );

  // Sync browser Back / Forward buttons across all pages
  useEffect(() => {
    const onPopState = () => {
      const token = parseShareToken(window.location.pathname, window.location.search);
      if (token) {
        setShareToken(token);
        return;
      }
      setShareToken(null);
      const parsed = parseWorkspaceLocation(window.location.pathname);
      setActiveNav(parsed.nav);
      setActiveNoteId(parsed.noteId);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Synchronize URL path after auth state resolves
  useEffect(() => {
    if (authLoading || !user || shareToken) return;
    const p = window.location.pathname.replace(/\/+$/, '') || '/';
    if (user.role === 'admin') {
      if (p !== '/admin') {
        window.history.replaceState({}, '', '/admin');
      }
      return;
    }
    const authOrRootPaths = new Set([
      '/',
      '/login',
      '/register',
      '/signup',
      '/verify-email',
      '/forgot-password',
      '/reset-password',
      '/admin',
    ]);
    if (authOrRootPaths.has(p)) {
      window.history.replaceState({}, '', buildWorkspacePath(activeNav, activeNoteId));
    }
  }, [authLoading, user, shareToken, activeNav, activeNoteId]);

  // Global Ctrl+K Search shortcut (for students)
  useEffect(() => {
    if (!user || user.role !== 'student') return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [user]);

  const handleCreateNote = async (opts?: {
    template?: string;
    folderId?: string;
    notebookId?: string;
    subjectId?: string;
  }) => {
    try {
      const fldId =
        opts?.folderId ?? (activeNav.kind === 'notes' ? activeNav.folderId : undefined);
      const nbId =
        opts?.notebookId ??
        (activeNav.kind === 'notes' ? activeNav.notebookId : undefined);
      const subId =
        opts?.subjectId ??
        (activeNav.kind === 'notes' ? activeNav.subjectId : undefined);

      const res = await api.createNote({
        template: opts?.template || 'blank',
        folder_id: fldId || null,
        notebook_id: nbId || null,
        subject_id: subId || null,
      });
      openNoteStudio(res.note.id);
      refreshWorkspace();
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Hindi nagawang gawin ang tala.');
    }
  };

  const viewHeaderInfo = useMemo(() => {
    if (activeNav.kind !== 'notes') return { title: 'Mga Tala', subtitle: '' };
    if (activeNav.filter === 'starred') return { title: 'Mga May Bituing Tala', subtitle: 'Ang iyong mga naka-pin at paboritong tala sa pag-aaral' };
    if (activeNav.filter === 'trash') return { title: 'Basurahan', subtitle: 'Ibalik ang mga naburang pahina o burahin nang permanente' };
    if (activeNav.folderId) {
      const f = summary?.folders.find((x) => x.id === activeNav.folderId);
      return { title: f ? `Folder: ${f.name}` : 'Mga Tala sa Folder', subtitle: 'Nakaayos na mga tala sa loob ng folder na ito' };
    }
    if (activeNav.notebookId) {
      const nb = summary?.notebooks.find((n) => n.id === activeNav.notebookId);
      return { title: nb?.title || 'Kuwaderno', subtitle: nb?.description || '' };
    }
    if (activeNav.subjectId) {
      const sub = summary?.subjects.find((s) => s.id === activeNav.subjectId);
      return {
        title: sub ? `${sub.code ? `${sub.code} — ` : ''}${sub.name}` : 'Mga Tala sa Asignatura',
        subtitle: [sub?.instructor, sub?.semester].filter(Boolean).join(' · '),
      };
    }
    return { title: 'Lahat ng Akademikong Tala', subtitle: 'Mga dokumento, kuwadernong Cornell, at guhit-kamay' };
  }, [activeNav, summary]);

  if (shareToken) {
    return (
      <SharedNoteView
        token={shareToken}
        onExit={() => {
          setShareToken(null);
          const nextPath = user
            ? user.role === 'admin'
              ? '/admin'
              : buildWorkspacePath(activeNav, null)
            : '/';
          window.history.replaceState({}, '', nextPath);
        }}
      />
    );
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F8FF] dark:bg-[#071021] text-sm text-blue-700 dark:text-sky-300">
        Nilo-load ang Workspace ng INKORA...
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  // Separate Administrative Dashboard for ADMIN Role
  if (user.role === 'admin') {
    return (
      <>
        <AdminDashboard
          onOpenAccount={() => setAccountOpen(true)}
          onNotify={notify}
        />
        <AccountModal
          open={accountOpen}
          onClose={() => setAccountOpen(false)}
          onNotify={notify}
        />
        <ToastContainer
          toasts={toasts}
          onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
        />
      </>
    );
  }

  const folders = summary?.folders || [];
  const subjects = summary?.subjects || [];
  const notebooks = summary?.notebooks || [];

  return (
    <div className="h-screen flex overflow-hidden bg-[#F4F8FF] dark:bg-[#071021]">
      <Sidebar
        openMobile={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        activeNav={activeNav}
        onNavigate={(nav) => navigateTo(nav, null)}
        folders={folders}
        subjects={subjects}
        notebooks={notebooks}
        trashedCount={summary?.trashedCount || 0}
        onOpenSearch={() => setSearchOpen(true)}
        onNewNote={(opts) => handleCreateNote(opts)}
        onNewFolder={() => setFolderModal({ open: true, editing: null })}
        onEditFolder={(fld) => setFolderModal({ open: true, editing: fld })}
        onNewSubject={() => setSubjectModal({ open: true, editing: null })}
        onEditSubject={(sub) => setSubjectModal({ open: true, editing: sub })}
        onNewNotebook={() => setNotebookModal({ open: true, editing: null })}
        onEditNotebook={(nb) => setNotebookModal({ open: true, editing: nb })}
        onOpenAccount={() => setAccountOpen(true)}
      />

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Global Top Header (hidden in print) */}
        <header className="no-print h-14 px-4 border-b border-blue-200/70 dark:border-blue-900/50 bg-white/95 dark:bg-[#0D1930]/95 backdrop-blur-xs flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-blue-200 hover:bg-blue-50 dark:hover:bg-blue-950"
              aria-label="Buksan ang menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Mabilisang Nabigasyon sa Mga Pahina */}
            <nav className="hidden md:flex items-center gap-1 p-1 rounded-xl bg-blue-50/80 dark:bg-[#132340] border border-blue-200/60 dark:border-blue-800/50">
              <button
                type="button"
                onClick={() => navigateTo({ kind: 'dashboard' }, null)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  !activeNoteId && activeNav.kind === 'dashboard'
                    ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-sky-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-blue-700'
                }`}
              >
                <Home className="w-3.5 h-3.5" /> Dashboard
              </button>
              <button
                type="button"
                onClick={() => navigateTo({ kind: 'notes', filter: 'all' }, null)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  !activeNoteId && activeNav.kind === 'notes'
                    ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-sky-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-blue-700'
                }`}
              >
                <FileText className="w-3.5 h-3.5" /> Mga Tala
              </button>
              <button
                type="button"
                onClick={() => navigateTo({ kind: 'files' }, null)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  !activeNoteId && activeNav.kind === 'files'
                    ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-sky-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-blue-700'
                }`}
              >
                <FolderOpen className="w-3.5 h-3.5" /> Baul ng File
              </button>
              <button
                type="button"
                onClick={() => navigateTo({ kind: 'study' }, null)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  !activeNoteId && activeNav.kind === 'study'
                    ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-sky-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-blue-700'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" /> Sentro ng Pag-aaral
              </button>
            </nav>

            <div className="md:hidden text-xs font-semibold text-slate-600 dark:text-blue-200/80 truncate">
              {activeNoteId ? 'Studio ng Tala' : activeNav.kind === 'dashboard' ? 'Dashboard ng Mag-aaral' : viewHeaderInfo.title}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-200 dark:border-blue-800/60 bg-blue-50/50 dark:bg-[#132340] text-xs text-slate-500 dark:text-blue-200/75 hover:border-blue-400 cursor-pointer"
            >
              <Search className="w-3.5 h-3.5 text-blue-600 dark:text-sky-400" /> Maghanap
            </button>

            <PomodoroWidget
              activeNoteId={activeNoteId}
              onSessionLogged={refreshWorkspace}
              onNotify={notify}
            />

            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-xl border border-blue-200 dark:border-blue-800/60 bg-white dark:bg-[#132340] text-slate-600 dark:text-blue-200 hover:bg-blue-50 dark:hover:bg-blue-900/40 cursor-pointer"
              title="Lumipat ng maliwanag/madilim na tema"
            >
              {resolved === 'dark' ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-blue-700" />}
            </button>

            <button
              type="button"
              onClick={() => setAccountOpen(true)}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-blue-200 dark:border-blue-800/60 bg-white dark:bg-[#132340] text-xs font-semibold text-slate-700 dark:text-blue-100 hover:border-blue-400 cursor-pointer"
              title="Mga Setting ng Account"
            >
              <UserIcon className="w-3.5 h-3.5 text-blue-600 dark:text-sky-400" />
              <span className="max-w-[90px] truncate">{user.full_name.split(' ')[0]}</span>
            </button>

            <button
              type="button"
              onClick={() => logout()}
              className="p-2 rounded-xl border border-blue-200 dark:border-blue-800/60 bg-white dark:bg-[#132340] text-slate-500 hover:text-rose-600 hover:border-rose-300 transition cursor-pointer"
              title="Mag-sign Out"
              aria-label="Mag-sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Active View */}
        {activeNoteId ? (
          <NoteWorkspace
            noteId={activeNoteId}
            folders={folders}
            subjects={subjects}
            notebooks={notebooks}
            onBack={() => {
              navigateTo(activeNav, null);
              refreshWorkspace();
            }}
            onOpenNote={(id) => {
              openNoteStudio(id);
              refreshWorkspace();
            }}
            onNewNote={() => handleCreateNote({ template: 'lined-notebook' })}
            onNoteUpdated={() => refreshWorkspace()}
            onNoteDeleted={() => {
              navigateTo(activeNav, null, true);
              refreshWorkspace();
            }}
            onNotify={notify}
          />
        ) : activeNav.kind === 'files' ? (
          <FileVaultView subjects={subjects} onNotify={notify} />
        ) : activeNav.kind === 'study' ? (
          <StudyHubView
            subjects={subjects}
            onRefreshSummary={refreshWorkspace}
            onNotify={notify}
          />
        ) : summary ? (
          <DashboardView
            mode={activeNav.kind === 'dashboard' ? 'dashboard' : 'list'}
            title={viewHeaderInfo.title}
            subtitle={viewHeaderInfo.subtitle}
            isTrashView={activeNav.kind === 'notes' && activeNav.filter === 'trash'}
            summary={summary}
            notes={notes}
            noteListQuery={noteListQuery}
            onChangeNoteListQuery={setNoteListQuery}
            noteCategoryFilter={noteCategoryFilter}
            onChangeNoteCategoryFilter={setNoteCategoryFilter}
            noteSort={noteSort}
            onChangeNoteSort={setNoteSort}
            onOpenNote={(id) => openNoteStudio(id)}
            onCreateFromTemplate={(tpl) => handleCreateNote({ template: tpl })}
            onRefresh={refreshWorkspace}
            onOpenStudyHub={() => navigateTo({ kind: 'study' })}
            onOpenFiles={() => navigateTo({ kind: 'files' })}
            onOpenAllNotes={() => navigateTo({ kind: 'notes', filter: 'all' })}
            onSelectNotebook={(nbId) => navigateTo({ kind: 'notes', notebookId: nbId })}
            onNewFolder={() => setFolderModal({ open: true, editing: null })}
            onSelectFolder={(fldId) => navigateTo({ kind: 'notes', folderId: fldId })}
            onOpenAccount={() => setAccountOpen(true)}
            onNotify={notify}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
            Nilo-load ang workspace...
          </div>
        )}
      </div>

      {/* Modals & Drawers */}
      <CommandPalette
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelectNote={(id) => openNoteStudio(id)}
        onSelectFolder={(fldId) => navigateTo({ kind: 'notes', folderId: fldId })}
        onSelectNotebook={(nbId) => navigateTo({ kind: 'notes', notebookId: nbId })}
        onSelectSubject={(subId) => navigateTo({ kind: 'notes', subjectId: subId })}
        onOpenFiles={() => navigateTo({ kind: 'files' })}
      />

      <FolderModal
        open={folderModal.open}
        editing={folderModal.editing}
        onClose={() => setFolderModal({ open: false, editing: null })}
        onSaved={refreshWorkspace}
        onNotify={notify}
      />

      <SubjectModal
        open={subjectModal.open}
        editing={subjectModal.editing}
        onClose={() => setSubjectModal({ open: false, editing: null })}
        onSaved={refreshWorkspace}
        onNotify={notify}
      />

      <NotebookModal
        open={notebookModal.open}
        editing={notebookModal.editing}
        subjects={subjects}
        onClose={() => setNotebookModal({ open: false, editing: null })}
        onSaved={refreshWorkspace}
        onNotify={notify}
      />

      <AccountModal
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        onNotify={notify}
      />

      <ToastContainer
        toasts={toasts}
        onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
      />
    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <WorkspaceShell />
      </AuthProvider>
    </ThemeProvider>
  );
}
