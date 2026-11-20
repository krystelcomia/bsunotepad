import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  Ban,
  CheckCircle2,
  FolderKanban,
  HardDrive,
  LogOut,
  MessageSquareWarning,
  Moon,
  PauseCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  Sun,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { AccountConcern, AccountStatus, AdminStats, AdminStudentRow } from '../../types';
import { formatBytes, formatRelativeTime } from '../../utils/format';
import { BrandLogo } from '../common/BrandLogo';
import { Modal } from '../common/Modal';

interface AdminDashboardProps {
  onOpenAccount: () => void;
  onNotify: (type: 'success' | 'error' | 'info', text: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onOpenAccount, onNotify }) => {
  const { user, logout } = useAuth();
  const { resolved, toggle: toggleTheme } = useTheme();

  const [tab, setTab] = useState<'students' | 'concerns'>('students');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [students, setStudents] = useState<AdminStudentRow[]>([]);
  const [concerns, setConcerns] = useState<AccountConcern[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [concernFilter, setConcernFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  const [statusModal, setStatusModal] = useState<{
    student: AdminStudentRow;
    targetStatus: AccountStatus;
  } | null>(null);
  const [statusReason, setStatusReason] = useState('');

  const [concernModal, setConcernModal] = useState<AccountConcern | null>(null);
  const [adminNoteDraft, setAdminNoteDraft] = useState('');
  const [concernStatusDraft, setConcernStatusDraft] = useState<'open' | 'in_review' | 'resolved'>('resolved');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, stuRes, conRes] = await Promise.all([
        api.adminStats(),
        api.adminListStudents({ q: searchQuery.trim() || undefined, status: statusFilter }),
        api.adminListConcerns(concernFilter === 'all' ? undefined : concernFilter),
      ]);
      setStats(statsRes.stats);
      setStudents(stuRes.students);
      setConcerns(conRes.concerns);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Failed to load admin data');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter, concernFilter, onNotify]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadData();
    }, 150);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const applyStatusChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusModal) return;
    try {
      await api.adminUpdateStudentStatus(
        statusModal.student.id,
        statusModal.targetStatus,
        statusReason.trim()
      );
      onNotify(
        'success',
        `Updated ${statusModal.student.full_name} to ${statusModal.targetStatus}.`
      );
      setStatusModal(null);
      setStatusReason('');
      await loadData();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Could not update status');
    }
  };

  const quickActivate = async (student: AdminStudentRow) => {
    try {
      await api.adminUpdateStudentStatus(student.id, 'active', '');
      onNotify('success', `Reactivated ${student.full_name}`);
      await loadData();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Could not activate account');
    }
  };

  const handleDeleteStudent = async (student: AdminStudentRow) => {
    if (
      !window.confirm(
        `Permanently delete student account "${student.full_name}" (${student.email}) and all associated storage?`
      )
    ) {
      return;
    }
    try {
      await api.adminDeleteStudent(student.id);
      onNotify('info', `Deleted account ${student.email}`);
      await loadData();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleSaveConcern = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!concernModal) return;
    try {
      await api.adminUpdateConcern(concernModal.id, {
        status: concernStatusDraft,
        admin_note: adminNoteDraft,
      });
      onNotify('success', 'Concern ticket updated.');
      setConcernModal(null);
      await loadData();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Update failed');
    }
  };

  const statusBadge = (st: AccountStatus) => {
    if (st === 'active') {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800';
    }
    if (st === 'suspended') {
      return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800';
    }
    return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800';
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F4FB] dark:bg-[#0B0914] text-slate-900 dark:text-slate-100">
      {/* Top Admin Header */}
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-[#141024]/90 backdrop-blur-md border-b border-violet-200/70 dark:border-violet-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BrandLogo size="sm" badge="Admin Console" showTagline={false} />
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={loadData}
              className="p-2 rounded-xl border border-violet-200 dark:border-violet-800/60 bg-white dark:bg-[#1C1633] text-slate-600 dark:text-violet-200 hover:border-violet-400 cursor-pointer"
              title="Refresh statistics"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-xl border border-violet-200 dark:border-violet-800/60 bg-white dark:bg-[#1C1633] text-slate-600 dark:text-violet-200 hover:border-violet-400 cursor-pointer"
              title="Toggle theme"
            >
              {resolved === 'dark' ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onOpenAccount}
              className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-violet-200 dark:border-violet-800/60 bg-white dark:bg-[#1C1633] text-xs font-semibold cursor-pointer"
            >
              {user?.full_name}
            </button>
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-900 hover:bg-violet-800 text-white text-xs font-semibold cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-8 space-y-7">
        {/* Privacy Isolation Notice */}
        <div className="rounded-2xl bg-gradient-to-r from-violet-950 via-purple-900 to-blue-900 text-white p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-lg shadow-violet-950/15">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-white/15 text-sky-300 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="font-display font-bold text-sm">
                Privacy-First Administration Active
              </div>
              <p className="text-xs text-violet-100/85 mt-0.5 max-w-3xl">
                Admin access is strictly scoped to student account status, login activity, aggregate
                usage metrics, and account concerns. Private student notes, drawings, and uploaded
                files are isolated and hidden by default.
              </p>
            </div>
          </div>
          <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-white/10 border border-white/15">
            Role: ADMIN
          </span>
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
          <div className="rounded-2xl bg-white dark:bg-[#141024] border border-violet-200/70 dark:border-violet-900/50 p-4">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-violet-200/70">
              <span>Total Students</span>
              <Users className="w-4 h-4 text-violet-600" />
            </div>
            <div className="font-display text-2xl font-extrabold mt-1.5">{stats?.totalStudents ?? 0}</div>
            <div className="text-[11px] text-violet-600 dark:text-violet-300 mt-1">
              +{stats?.newRegistrations7d ?? 0} last 7 days
            </div>
          </div>

          <div className="rounded-2xl bg-white dark:bg-[#141024] border border-violet-200/70 dark:border-violet-900/50 p-4">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-violet-200/70">
              <span>Active Accounts</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="font-display text-2xl font-extrabold text-emerald-600 mt-1.5">
              {stats?.activeAccounts ?? 0}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {stats?.activeLogins24h ?? 0} logged in (24h)
            </div>
          </div>

          <div className="rounded-2xl bg-white dark:bg-[#141024] border border-violet-200/70 dark:border-violet-900/50 p-4">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-violet-200/70">
              <span>Suspended</span>
              <Ban className="w-4 h-4 text-rose-600" />
            </div>
            <div className="font-display text-2xl font-extrabold text-rose-600 mt-1.5">
              {stats?.suspendedAccounts ?? 0}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {stats?.deactivatedAccounts ?? 0} deactivated
            </div>
          </div>

          <div className="rounded-2xl bg-white dark:bg-[#141024] border border-violet-200/70 dark:border-violet-900/50 p-4">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-violet-200/70">
              <span>Open Concerns</span>
              <MessageSquareWarning className="w-4 h-4 text-amber-500" />
            </div>
            <div className="font-display text-2xl font-extrabold text-amber-600 mt-1.5">
              {stats?.openConcerns ?? 0}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Account requests</div>
          </div>

          <div className="rounded-2xl bg-white dark:bg-[#141024] border border-violet-200/70 dark:border-violet-900/50 p-4">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-violet-200/70">
              <span>Platform Usage</span>
              <Activity className="w-4 h-4 text-blue-500" />
            </div>
            <div className="font-display text-2xl font-extrabold mt-1.5">{stats?.totalNotes ?? 0}</div>
            <div className="text-[11px] text-slate-400 mt-1">
              {stats?.totalFolders ?? 0} folders · {stats?.totalNotebooks ?? 0} books
            </div>
          </div>

          <div className="rounded-2xl bg-white dark:bg-[#141024] border border-violet-200/70 dark:border-violet-900/50 p-4">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-violet-200/70">
              <span>Vault Storage</span>
              <HardDrive className="w-4 h-4 text-violet-600" />
            </div>
            <div className="font-display text-xl font-extrabold mt-1.5">
              {formatBytes(stats?.totalStorageUsedBytes ?? 0)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">{stats?.totalFiles ?? 0} total files</div>
          </div>
        </div>

        {/* Section Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white dark:bg-[#141024] border border-violet-200/70 dark:border-violet-900/50">
            <button
              type="button"
              onClick={() => setTab('students')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                tab === 'students'
                  ? 'bg-gradient-to-r from-violet-800 to-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-violet-200/75 hover:text-violet-800'
              }`}
            >
              <Users className="w-4 h-4" /> Student Accounts ({students.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('concerns')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                tab === 'concerns'
                  ? 'bg-gradient-to-r from-violet-800 to-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-violet-200/75 hover:text-violet-800'
              }`}
            >
              <FolderKanban className="w-4 h-4" /> Account Concerns ({concerns.length})
            </button>
          </div>
        </div>

        {/* Students Table */}
        {tab === 'students' && (
          <div className="rounded-3xl bg-white dark:bg-[#141024] border border-violet-200/70 dark:border-violet-900/50 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-violet-100 dark:border-violet-900/50 flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[220px] max-w-md">
                <Search className="w-4 h-4 text-violet-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search students by name, email, or university..."
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-violet-200 dark:border-violet-800/60 bg-violet-50/40 dark:bg-[#1C1633] focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {(['all', 'active', 'suspended', 'deactivated'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition cursor-pointer ${
                      statusFilter === st
                        ? 'bg-violet-700 text-white'
                        : 'bg-violet-50 dark:bg-[#1C1633] text-slate-600 dark:text-violet-200/80 hover:bg-violet-100'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="p-10 text-center text-sm text-slate-400">Loading student accounts...</div>
            ) : students.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-400">
                No student accounts match your filter.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-violet-50/70 dark:bg-[#1B1531] text-slate-500 dark:text-violet-300/75 uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="px-4 py-3 font-bold">Student</th>
                      <th className="px-4 py-3 font-bold">Status</th>
                      <th className="px-4 py-3 font-bold">Registered</th>
                      <th className="px-4 py-3 font-bold">Last Login & Activity</th>
                      <th className="px-4 py-3 font-bold">Usage Counts</th>
                      <th className="px-4 py-3 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-violet-100 dark:divide-violet-900/40">
                    {students.map((stu) => (
                      <tr key={stu.id} className="hover:bg-violet-50/40 dark:hover:bg-[#1C1633]/50">
                        <td className="px-4 py-3.5">
                          <div className="font-bold text-sm text-slate-900 dark:text-white">
                            {stu.full_name}
                          </div>
                          <div className="text-slate-500 dark:text-violet-200/70">{stu.email}</div>
                          {stu.university && (
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              {stu.university} {stu.major ? `· ${stu.major}` : ''}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full border font-bold capitalize text-[11px] ${statusBadge(
                              stu.status
                            )}`}
                          >
                            {stu.status}
                          </span>
                          {stu.status_reason && (
                            <div className="text-[11px] text-slate-400 mt-1 max-w-[190px] truncate" title={stu.status_reason}>
                              {stu.status_reason}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-slate-600 dark:text-violet-200/80">
                          <div>{new Date(stu.created_at).toLocaleDateString()}</div>
                          <div className="text-[11px] text-slate-400">{formatRelativeTime(stu.created_at)}</div>
                        </td>
                        <td className="px-4 py-3.5 text-slate-600 dark:text-violet-200/80">
                          <div>
                            {stu.last_login_at ? formatRelativeTime(stu.last_login_at) : 'Never'}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {stu.login_count} login(s) · {stu.active_session_count} active session(s)
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-slate-600 dark:text-violet-200/80">
                          <div>
                            {stu.note_count} notes · {stu.file_count} files
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {formatBytes(stu.storage_used_bytes)} used
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center justify-end gap-1.5">
                            {stu.status !== 'active' && (
                              <button
                                type="button"
                                onClick={() => quickActivate(stu)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold cursor-pointer"
                                title="Activate account"
                              >
                                <UserCheck className="w-3.5 h-3.5" /> Activate
                              </button>
                            )}
                            {stu.status !== 'deactivated' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setStatusModal({ student: stu, targetStatus: 'deactivated' });
                                  setStatusReason(stu.status_reason || '');
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 font-semibold cursor-pointer"
                                title="Deactivate account"
                              >
                                <PauseCircle className="w-3.5 h-3.5" /> Deactivate
                              </button>
                            )}
                            {stu.status !== 'suspended' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setStatusModal({ student: stu, targetStatus: 'suspended' });
                                  setStatusReason(stu.status_reason || '');
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold cursor-pointer"
                                title="Suspend account"
                              >
                                <Ban className="w-3.5 h-3.5" /> Suspend
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteStudent(stu)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                              title="Delete account"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Account Concerns Tab */}
        {tab === 'concerns' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-1.5">
              {(['all', 'open', 'in_review', 'resolved'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setConcernFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize cursor-pointer ${
                    concernFilter === st
                      ? 'bg-violet-700 text-white'
                      : 'bg-white dark:bg-[#141024] border border-violet-200 dark:border-violet-800/50 text-slate-600 dark:text-violet-200'
                  }`}
                >
                  {st.replace('_', ' ')}
                </button>
              ))}
            </div>

            {concerns.length === 0 ? (
              <div className="rounded-3xl bg-white dark:bg-[#141024] border border-violet-200/70 p-10 text-center text-sm text-slate-400">
                No account concerns found.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {concerns.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-2xl bg-white dark:bg-[#141024] border border-violet-200/70 dark:border-violet-900/50 p-5 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span
                          className={`inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded-full mb-1.5 ${
                            c.status === 'resolved'
                              ? 'bg-emerald-100 text-emerald-700'
                              : c.status === 'in_review'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {c.status.replace('_', ' ')}
                        </span>
                        <h3 className="font-display font-bold text-sm text-slate-900 dark:text-white">
                          {c.subject}
                        </h3>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {c.student_name || c.email} · {formatRelativeTime(c.created_at)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setConcernModal(c);
                          setConcernStatusDraft(c.status);
                          setAdminNoteDraft(c.admin_note || '');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-violet-100 dark:bg-violet-900/50 text-violet-800 dark:text-violet-200 text-xs font-semibold cursor-pointer"
                      >
                        Manage
                      </button>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-violet-200/80 leading-relaxed">
                      {c.message}
                    </p>
                    {c.admin_note && (
                      <div className="p-2.5 rounded-xl bg-violet-50 dark:bg-[#1C1633] text-xs text-violet-900 dark:text-violet-200">
                        <strong>Admin note:</strong> {c.admin_note}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Change Status Modal */}
      <Modal
        open={Boolean(statusModal)}
        onClose={() => setStatusModal(null)}
        title={
          statusModal
            ? `${statusModal.targetStatus === 'suspended' ? 'Suspend' : 'Deactivate'} Student Account`
            : ''
        }
        subtitle={statusModal ? `${statusModal.student.full_name} (${statusModal.student.email})` : ''}
      >
        <form onSubmit={applyStatusChange} className="space-y-4">
          <p className="text-xs text-slate-600 dark:text-violet-200/80">
            Active sessions will be revoked immediately and the student will be blocked from signing
            in until reactivated.
          </p>
          <div>
            <label className="block text-xs font-semibold mb-1">Reason / Note (shown to student)</label>
            <textarea
              rows={3}
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value)}
              placeholder="e.g., Pending email verification or policy review..."
              className="w-full px-3 py-2 text-sm rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50/40 dark:bg-[#1C1633]"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setStatusModal(null)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer"
            >
              Confirm {statusModal?.targetStatus}
            </button>
          </div>
        </form>
      </Modal>

      {/* Manage Concern Modal */}
      <Modal
        open={Boolean(concernModal)}
        onClose={() => setConcernModal(null)}
        title="Manage Account Concern"
        subtitle={concernModal?.email}
      >
        <form onSubmit={handleSaveConcern} className="space-y-4">
          <div className="p-3 rounded-xl bg-violet-50 dark:bg-[#1C1633] text-xs space-y-1">
            <div className="font-bold">{concernModal?.subject}</div>
            <p className="text-slate-600 dark:text-violet-200/80">{concernModal?.message}</p>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Resolution Status</label>
            <select
              value={concernStatusDraft}
              onChange={(e) => setConcernStatusDraft(e.target.value as 'open' | 'in_review' | 'resolved')}
              className="w-full px-3 py-2 text-sm rounded-xl border border-violet-200 dark:border-violet-800 bg-white dark:bg-[#1C1633]"
            >
              <option value="open">Open</option>
              <option value="in_review">In Review</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Admin Response Note</label>
            <textarea
              rows={3}
              value={adminNoteDraft}
              onChange={(e) => setAdminNoteDraft(e.target.value)}
              placeholder="Write resolution details for this student..."
              className="w-full px-3 py-2 text-sm rounded-xl border border-violet-200 dark:border-violet-800 bg-white dark:bg-[#1C1633]"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConcernModal(null)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-violet-700 hover:bg-violet-800 text-white text-xs font-semibold cursor-pointer"
            >
              Save Update
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
