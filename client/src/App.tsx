import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Menu, Moon, Search, Sun } from 'lucide-react';
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

const WorkspaceShell: React.FC = () => {
  const { user, loading: authLoading, setStorageUsedBytes } = useAuth();
  const { resolved, toggle: toggleTheme } = useTheme();

  const [shareToken, setShareToken] = useState<string | null>(() => {
    const qs = new URLSearchParams(window.location.search);
    return qs.get('share');
  });

  const [summary, setSummary] = useState<WorkspaceSummary | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNav, setActiveNav] = useState<NavSection>({ kind: 'dashboard' });
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
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
      setActiveNoteId(res.note.id);
      refreshWorkspace();
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Could not create note');
    }
  };

  const viewHeaderInfo = useMemo(() => {
    if (activeNav.kind !== 'notes') return { title: 'Notes', subtitle: '' };
    if (activeNav.filter === 'starred') return { title: 'Starred Notes', subtitle: 'Your pinned & favorite study sheets' };
    if (activeNav.filter === 'trash') return { title: 'Trash', subtitle: 'Restore deleted pages or erase them permanently' };
    if (activeNav.folderId) {
      const f = summary?.folders.find((x) => x.id === activeNav.folderId);
      return { title: f ? `Folder: ${f.name}` : 'Folder Notes', subtitle: 'Organized notes inside this folder' };
    }
    if (activeNav.notebookId) {
      const nb = summary?.notebooks.find((n) => n.id === activeNav.notebookId);
      return { title: nb?.title || 'Notebook', subtitle: nb?.description || '' };
    }
    if (activeNav.subjectId) {
      const sub = summary?.subjects.find((s) => s.id === activeNav.subjectId);
      return {
        title: sub ? `${sub.code ? `${sub.code} — ` : ''}${sub.name}` : 'Course Notes',
        subtitle: [sub?.instructor, sub?.semester].filter(Boolean).join(' · '),
      };
    }
    return { title: 'All Academic Notes', subtitle: 'Documents, Cornell notebooks, and sketchpads' };
  }, [activeNav, summary]);

  if (shareToken) {
    return (
      <SharedNoteView
        token={shareToken}
        onExit={() => {
          setShareToken(null);
          window.history.replaceState({}, '', '/');
        }}
      />
    );
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F6F4FB] dark:bg-[#0B0914] text-sm text-violet-600 dark:text-violet-300">
        Loading INKORA Workspace...
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
    <div className="h-screen flex overflow-hidden bg-[#F6F4FB] dark:bg-[#0B0914]">
      <Sidebar
        openMobile={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        activeNav={activeNav}
        onNavigate={(nav) => {
          setActiveNoteId(null);
          setActiveNav(nav);
        }}
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
        <header className="no-print h-13 px-4 border-b border-violet-200/70 dark:border-violet-900/50 bg-white/85 dark:bg-[#141024]/90 backdrop-blur-xs flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-violet-200 hover:bg-violet-50 dark:hover:bg-violet-950"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-xs font-medium text-slate-500 dark:text-violet-200/75 truncate">
              {activeNoteId ? 'INKORA Studio Editor' : viewHeaderInfo.title}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-violet-200 dark:border-violet-800/60 bg-violet-50/50 dark:bg-[#1C1633] text-xs text-slate-500 dark:text-violet-200/75 hover:border-violet-400 cursor-pointer"
            >
              <Search className="w-3.5 h-3.5 text-violet-600" /> Search
            </button>

            <PomodoroWidget
              activeNoteId={activeNoteId}
              onSessionLogged={refreshWorkspace}
              onNotify={notify}
            />

            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-xl border border-violet-200 dark:border-violet-800/60 bg-white dark:bg-[#1C1633] text-slate-600 dark:text-violet-200 hover:bg-violet-50 dark:hover:bg-violet-900/40 cursor-pointer"
              title="Toggle light/dark mode"
            >
              {resolved === 'dark' ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4" />}
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
              setActiveNoteId(null);
              refreshWorkspace();
            }}
            onOpenNote={(id) => {
              setActiveNoteId(id);
              refreshWorkspace();
            }}
            onNewNote={() => handleCreateNote({ template: 'lined-notebook' })}
            onNoteUpdated={() => refreshWorkspace()}
            onNoteDeleted={() => {
              setActiveNoteId(null);
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
            onOpenNote={(id) => setActiveNoteId(id)}
            onCreateFromTemplate={(tpl) => handleCreateNote({ template: tpl })}
            onRefresh={refreshWorkspace}
            onOpenStudyHub={() => setActiveNav({ kind: 'study' })}
            onOpenFiles={() => setActiveNav({ kind: 'files' })}
            onSelectNotebook={(nbId) => setActiveNav({ kind: 'notes', notebookId: nbId })}
            onNewFolder={() => setFolderModal({ open: true, editing: null })}
            onSelectFolder={(fldId) => setActiveNav({ kind: 'notes', folderId: fldId })}
            onOpenAccount={() => setAccountOpen(true)}
            onNotify={notify}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
            Loading workspace...
          </div>
        )}
      </div>

      {/* Modals & Drawers */}
      <CommandPalette
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelectNote={(id) => setActiveNoteId(id)}
        onSelectFolder={(fldId) => {
          setActiveNoteId(null);
          setActiveNav({ kind: 'notes', folderId: fldId });
        }}
        onSelectNotebook={(nbId) => {
          setActiveNoteId(null);
          setActiveNav({ kind: 'notes', notebookId: nbId });
        }}
        onSelectSubject={(subId) => {
          setActiveNoteId(null);
          setActiveNav({ kind: 'notes', subjectId: subId });
        }}
        onOpenFiles={() => {
          setActiveNoteId(null);
          setActiveNav({ kind: 'files' });
        }}
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
