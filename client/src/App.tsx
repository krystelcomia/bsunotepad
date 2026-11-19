import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Menu, Moon, Search, Sun } from 'lucide-react';
import { api } from './api/client';
import { AccountModal } from './components/account/AccountModal';
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
import { NotebookModal, SubjectModal } from './components/workspace/Modals';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { Notebook, Note, Subject, WorkspaceSummary } from './types';

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

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

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

  const refreshWorkspace = useCallback(async () => {
    if (!user) return;
    try {
      const sum = await api.workspaceSummary();
      setSummary(sum);
      setStorageUsedBytes(sum.stats.storageUsedBytes);

      if (activeNav.kind === 'notes') {
        const listRes = await api.listNotes({
          notebookId: activeNav.notebookId,
          subjectId: activeNav.subjectId,
          starred: activeNav.filter === 'starred',
          trashed: activeNav.filter === 'trash',
        });
        setNotes(listRes.notes);
      } else {
        const listRes = await api.listNotes();
        setNotes(listRes.notes);
      }
    } catch {
      // ignore initial errors
    }
  }, [user, activeNav, setStorageUsedBytes]);

  useEffect(() => {
    if (user) refreshWorkspace();
  }, [user, refreshWorkspace]);

  // Global Ctrl+K Search shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleCreateNote = async (opts?: {
    template?: string;
    notebookId?: string;
    subjectId?: string;
  }) => {
    try {
      const nbId =
        opts?.notebookId ??
        (activeNav.kind === 'notes' ? activeNav.notebookId : undefined);
      const subId =
        opts?.subjectId ??
        (activeNav.kind === 'notes' ? activeNav.subjectId : undefined);

      const res = await api.createNote({
        template: opts?.template || 'blank',
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
      <div className="min-h-screen flex items-center justify-center bg-[#F5F3EE] dark:bg-[#0B0F17] text-sm text-slate-500">
        Loading INKORA Workspace...
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  const subjects = summary?.subjects || [];
  const notebooks = summary?.notebooks || [];

  return (
    <div className="h-screen flex overflow-hidden bg-[#F5F3EE] dark:bg-[#0B0F17]">
      <Sidebar
        openMobile={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        activeNav={activeNav}
        onNavigate={(nav) => {
          setActiveNoteId(null);
          setActiveNav(nav);
        }}
        subjects={subjects}
        notebooks={notebooks}
        trashedCount={summary?.trashedCount || 0}
        onOpenSearch={() => setSearchOpen(true)}
        onNewNote={(opts) => handleCreateNote(opts)}
        onNewSubject={() => setSubjectModal({ open: true, editing: null })}
        onEditSubject={(sub) => setSubjectModal({ open: true, editing: sub })}
        onNewNotebook={() => setNotebookModal({ open: true, editing: null })}
        onEditNotebook={(nb) => setNotebookModal({ open: true, editing: nb })}
        onOpenAccount={() => setAccountOpen(true)}
      />

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Global Top Header (hidden in print) */}
        <header className="no-print h-13 px-4 border-b border-stone-200/90 dark:border-slate-800 bg-white/85 dark:bg-slate-900/90 backdrop-blur-xs flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-800"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
              {activeNoteId ? 'INKORA Studio Editor' : viewHeaderInfo.title}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 text-xs text-slate-500 hover:border-indigo-400 cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" /> Search
            </button>

            <PomodoroWidget
              activeNoteId={activeNoteId}
              onSessionLogged={refreshWorkspace}
              onNotify={notify}
            />

            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-stone-50 dark:hover:bg-slate-700 cursor-pointer"
              title="Toggle light/dark mode"
            >
              {resolved === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* Active View */}
        {activeNoteId ? (
          <NoteWorkspace
            noteId={activeNoteId}
            subjects={subjects}
            notebooks={notebooks}
            onBack={() => {
              setActiveNoteId(null);
              refreshWorkspace();
            }}
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
            onOpenNote={(id) => setActiveNoteId(id)}
            onCreateFromTemplate={(tpl) => handleCreateNote({ template: tpl })}
            onRefresh={refreshWorkspace}
            onOpenStudyHub={() => setActiveNav({ kind: 'study' })}
            onOpenFiles={() => setActiveNav({ kind: 'files' })}
            onSelectNotebook={(nbId) => setActiveNav({ kind: 'notes', notebookId: nbId })}
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
