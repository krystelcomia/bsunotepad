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
  ShieldPlus,
  Sun,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { AccountConcern, AccountStatus, AdminStats, AdminStudentRow, User } from '../../types';
import { formatBytes, formatRelativeTime } from '../../utils/format';
import { BrandLogo } from '../common/BrandLogo';
import { Modal } from '../common/Modal';

interface AdminDashboardProps {
  onOpenAccount: () => void;
  onNotify: (type: 'success' | 'error' | 'info', text: string) => void;
}

function getStatusLabel(status: AccountStatus): string {
  if (status === 'active') return 'Aktibo';
  if (status === 'suspended') return 'Suspendido';
  return 'Naka-deactivate';
}

function getConcernStatusLabel(status: AccountConcern['status']): string {
  if (status === 'resolved') return 'Nalutas';
  if (status === 'in_review') return 'Sinusuri';
  return 'Bukas';
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onOpenAccount, onNotify }) => {
  const { user, logout } = useAuth();
  const { resolved, toggle: toggleTheme } = useTheme();

  const [tab, setTab] = useState<'students' | 'concerns' | 'admins'>('students');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [students, setStudents] = useState<AdminStudentRow[]>([]);
  const [concerns, setConcerns] = useState<AccountConcern[]>([]);
  const [admins, setAdmins] = useState<User[]>([]);
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
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
      const [statsRes, stuRes, conRes, admRes] = await Promise.all([
        api.adminStats(),
        api.adminListStudents({ q: searchQuery.trim() || undefined, status: statusFilter }),
        api.adminListConcerns(concernFilter === 'all' ? undefined : concernFilter),
        api.adminListAdmins(),
      ]);
      setStats(statsRes.stats);
      setStudents(stuRes.students);
      setConcerns(conRes.concerns);
      setAdmins(admRes.admins);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Nabigong i-load ang datos ng admin');
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
        `Na-update si ${statusModal.student.full_name} bilang ${getStatusLabel(statusModal.targetStatus)}.`
      );
      setStatusModal(null);
      setStatusReason('');
      await loadData();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Hindi ma-update ang status');
    }
  };

  const quickActivate = async (student: AdminStudentRow) => {
    try {
      await api.adminUpdateStudentStatus(student.id, 'active', '');
      onNotify('success', `Muling na-activate ang account ni ${student.full_name}`);
      await loadData();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Hindi ma-activate ang account');
    }
  };

  const handleDeleteStudent = async (student: AdminStudentRow) => {
    if (
      !window.confirm(
        `Permanenteng burahin ang account ng mag-aaral na "${student.full_name}" (${student.email}) at ang lahat ng naka-save nitong data?`
      )
    ) {
      return;
    }
    try {
      await api.adminDeleteStudent(student.id);
      onNotify('info', `Nabura ang account na ${student.email}`);
      await loadData();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Nabigong burahin');
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
      onNotify('success', 'Na-update ang concern ticket.');
      setConcernModal(null);
      await loadData();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Nabigo ang pag-update');
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
    <div className="min-h-screen flex flex-col bg-[#F4F8FF] dark:bg-[#071021] text-slate-900 dark:text-slate-100">
      {/* Tuktok na Header ng Admin */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#0D1930]/95 backdrop-blur-md border-b border-blue-200/70 dark:border-blue-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BrandLogo size="sm" badge="Console ng Admin" showTagline={false} />
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={loadData}
              className="p-2 rounded-xl border border-blue-200 dark:border-blue-800/60 bg-white dark:bg-[#132340] text-slate-600 dark:text-blue-200 hover:border-blue-400 cursor-pointer"
              title="I-refresh ang mga istatistika"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-xl border border-blue-200 dark:border-blue-800/60 bg-white dark:bg-[#132340] text-slate-600 dark:text-blue-200 hover:border-blue-400 cursor-pointer"
              title="Magpalit ng tema"
            >
              {resolved === 'dark' ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-blue-700" />}
            </button>
            <button
              type="button"
              onClick={onOpenAccount}
              className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-blue-200 dark:border-blue-800/60 bg-white dark:bg-[#132340] text-xs font-semibold cursor-pointer"
            >
              {user?.full_name}
            </button>
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-800 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" /> Mag-sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-8 space-y-7">
        {/* Paunawa sa Pribasiya */}
        <div className="rounded-2xl bg-gradient-to-r from-[#0F275C] via-[#1D4ED8] to-[#0284C7] text-white p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-lg shadow-blue-950/15">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-white/15 text-sky-200 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="font-display font-bold text-sm">
                Aktibo ang Pangangasiwang Inuuna ang Pribasiya
              </div>
              <p className="text-xs text-blue-100/90 mt-0.5 max-w-3xl">
                Ang access ng Admin ay limitado lamang sa status ng account ng mag-aaral, aktibidad sa
                pag-login, pangkalahatang sukatan ng paggamit, at mga alalahanin sa account. Ang mga pribadong
                tala, guhit, at na-upload na file ng mag-aaral ay nakahiwalay at nakatago bilang default.
              </p>
            </div>
          </div>
          <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-white/10 border border-white/15">
            Tungkulin: ADMIN
          </span>
        </div>

        {/* Grid ng Istatistika */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
          <div className="rounded-2xl bg-white dark:bg-[#0D1930] border border-blue-200/80 dark:border-blue-800/70 p-4">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-blue-200/70">
              <span>Kabuuang Mag-aaral</span>
              <Users className="w-4 h-4 text-blue-600 dark:text-sky-400" />
            </div>
            <div className="font-display text-2xl font-extrabold mt-1.5">{stats?.totalStudents ?? 0}</div>
            <div className="text-[11px] text-blue-600 dark:text-sky-300 mt-1">
              +{stats?.newRegistrations7d ?? 0} huling 7 araw
            </div>
          </div>

          <div className="rounded-2xl bg-white dark:bg-[#0D1930] border border-blue-200/80 dark:border-blue-800/70 p-4">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-blue-200/70">
              <span>Aktibong Account</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="font-display text-2xl font-extrabold text-emerald-600 mt-1.5">
              {stats?.activeAccounts ?? 0}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {stats?.activeLogins24h ?? 0} nag-login (24h)
            </div>
          </div>

          <div className="rounded-2xl bg-white dark:bg-[#0D1930] border border-blue-200/80 dark:border-blue-800/70 p-4">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-blue-200/70">
              <span>Suspendido</span>
              <Ban className="w-4 h-4 text-rose-600" />
            </div>
            <div className="font-display text-2xl font-extrabold text-rose-600 mt-1.5">
              {stats?.suspendedAccounts ?? 0}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {stats?.deactivatedAccounts ?? 0} naka-deactivate
            </div>
          </div>

          <div className="rounded-2xl bg-white dark:bg-[#0D1930] border border-blue-200/80 dark:border-blue-800/70 p-4">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-blue-200/70">
              <span>Bukás na Alalahanin</span>
              <MessageSquareWarning className="w-4 h-4 text-amber-500" />
            </div>
            <div className="font-display text-2xl font-extrabold text-amber-600 mt-1.5">
              {stats?.openConcerns ?? 0}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Mga kahilingan sa account</div>
          </div>

          <div className="rounded-2xl bg-white dark:bg-[#0D1930] border border-blue-200/80 dark:border-blue-800/70 p-4">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-blue-200/70">
              <span>Paggamit ng Platform</span>
              <Activity className="w-4 h-4 text-sky-600" />
            </div>
            <div className="font-display text-2xl font-extrabold mt-1.5">{stats?.totalNotes ?? 0}</div>
            <div className="text-[11px] text-slate-400 mt-1">
              {stats?.totalFolders ?? 0} folder · {stats?.totalNotebooks ?? 0} kuwaderno
            </div>
          </div>

          <div className="rounded-2xl bg-white dark:bg-[#0D1930] border border-blue-200/80 dark:border-blue-800/70 p-4">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-blue-200/70">
              <span>Espasyo sa Baul</span>
              <HardDrive className="w-4 h-4 text-blue-600 dark:text-sky-400" />
            </div>
            <div className="font-display text-xl font-extrabold mt-1.5">
              {formatBytes(stats?.totalStorageUsedBytes ?? 0)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">{stats?.totalFiles ?? 0} kabuuang file</div>
          </div>
        </div>

        {/* Mga Tab ng Seksyon */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white dark:bg-[#0D1930] border border-blue-200/80 dark:border-blue-900/50">
            <button
              type="button"
              onClick={() => setTab('students')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                tab === 'students'
                  ? 'bg-gradient-to-r from-blue-800 to-sky-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-blue-200/75 hover:text-blue-800'
              }`}
            >
              <Users className="w-4 h-4" /> Mga Account ng Mag-aaral ({students.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('concerns')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                tab === 'concerns'
                  ? 'bg-gradient-to-r from-blue-800 to-sky-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-blue-200/75 hover:text-blue-800'
              }`}
            >
              <FolderKanban className="w-4 h-4" /> Mga Alalahanin sa Account ({concerns.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('admins')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                tab === 'admins'
                  ? 'bg-gradient-to-r from-blue-800 to-sky-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-blue-200/75 hover:text-blue-800'
              }`}
            >
              <ShieldPlus className="w-4 h-4" /> Mga Administrator ({admins.length})
            </button>
          </div>
        </div>

        {/* Talahanayan ng mga Mag-aaral */}
        {tab === 'students' && (
          <div className="rounded-3xl bg-white dark:bg-[#0D1930] border border-blue-200/80 dark:border-blue-900/50 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-blue-100 dark:border-blue-900/50 flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[220px] max-w-md">
                <Search className="w-4 h-4 text-blue-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Maghanap ng mag-aaral ayon sa pangalan, email, o unibersidad..."
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-blue-200 dark:border-blue-800/60 bg-blue-50/40 dark:bg-[#132340] focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { id: 'all', label: 'Lahat' },
                    { id: 'active', label: 'Aktibo' },
                    { id: 'suspended', label: 'Suspendido' },
                    { id: 'deactivated', label: 'Naka-deactivate' },
                  ] as const
                ).map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setStatusFilter(st.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                      statusFilter === st.id
                        ? 'bg-blue-700 text-white'
                        : 'bg-blue-50 dark:bg-[#132340] text-slate-600 dark:text-blue-200/80 hover:bg-blue-100'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="p-10 text-center text-sm text-slate-400">Nilo-load ang mga account ng mag-aaral...</div>
            ) : students.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-400">
                Walang account ng mag-aaral na tumutugma sa iyong filter.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-blue-50/70 dark:bg-[#132340] text-slate-500 dark:text-blue-200/75 uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="px-4 py-3 font-bold">Mag-aaral</th>
                      <th className="px-4 py-3 font-bold">Status</th>
                      <th className="px-4 py-3 font-bold">Petsa ng Rehistro</th>
                      <th className="px-4 py-3 font-bold">Huling Login at Aktibidad</th>
                      <th className="px-4 py-3 font-bold">Bilang ng Paggamit</th>
                      <th className="px-4 py-3 font-bold text-right">Mga Aksyon</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-100 dark:divide-blue-900/40">
                    {students.map((stu) => (
                      <tr key={stu.id} className="hover:bg-blue-50/40 dark:hover:bg-[#132340]/60">
                        <td className="px-4 py-3.5">
                          <div className="font-bold text-sm text-slate-900 dark:text-white">
                            {stu.full_name}
                          </div>
                          <div className="text-slate-500 dark:text-blue-200/70">{stu.email}</div>
                          {stu.university && (
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              {stu.university} {stu.major ? `· ${stu.major}` : ''}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full border font-bold text-[11px] ${statusBadge(
                              stu.status
                            )}`}
                          >
                            {getStatusLabel(stu.status)}
                          </span>
                          {stu.status_reason && (
                            <div className="text-[11px] text-slate-400 mt-1 max-w-[190px] truncate" title={stu.status_reason}>
                              {stu.status_reason}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-slate-600 dark:text-blue-200/80">
                          <div>{new Date(stu.created_at).toLocaleDateString()}</div>
                          <div className="text-[11px] text-slate-400">{formatRelativeTime(stu.created_at)}</div>
                        </td>
                        <td className="px-4 py-3.5 text-slate-600 dark:text-blue-200/80">
                          <div>
                            {stu.last_login_at ? formatRelativeTime(stu.last_login_at) : 'Hindi pa'}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {stu.login_count} pag-login · {stu.active_session_count} aktibong session
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-slate-600 dark:text-blue-200/80">
                          <div>
                            {stu.note_count} tala · {stu.file_count} file
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {formatBytes(stu.storage_used_bytes)} nagamit
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center justify-end gap-1.5">
                            {stu.status !== 'active' && (
                              <button
                                type="button"
                                onClick={() => quickActivate(stu)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold cursor-pointer"
                                title="I-activate ang account"
                              >
                                <UserCheck className="w-3.5 h-3.5" /> I-activate
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
                                title="I-deactivate ang account"
                              >
                                <PauseCircle className="w-3.5 h-3.5" /> I-deactivate
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
                                title="Suspindihin ang account"
                              >
                                <Ban className="w-3.5 h-3.5" /> Suspindihin
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteStudent(stu)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                              title="Burahin ang account"
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

        {/* Tab ng mga Alalahanin sa Account */}
        {tab === 'concerns' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: 'all', label: 'Lahat' },
                  { id: 'open', label: 'Bukas' },
                  { id: 'in_review', label: 'Sinusuri' },
                  { id: 'resolved', label: 'Nalutas' },
                ] as const
              ).map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setConcernFilter(st.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${
                    concernFilter === st.id
                      ? 'bg-blue-700 text-white'
                      : 'bg-white dark:bg-[#0D1930] border border-blue-200 dark:border-blue-800/50 text-slate-600 dark:text-blue-200'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            {concerns.length === 0 ? (
              <div className="rounded-3xl bg-white dark:bg-[#0D1930] border border-blue-200/70 p-10 text-center text-sm text-slate-400">
                Walang nahanap na alalahanin sa account.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {concerns.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-2xl bg-white dark:bg-[#0D1930] border border-blue-200/80 dark:border-blue-900/50 p-5 space-y-3"
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
                          {getConcernStatusLabel(c.status)}
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
                        className="px-3 py-1.5 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 text-xs font-semibold cursor-pointer"
                      >
                        Pamahalaan
                      </button>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-blue-200/80 leading-relaxed">
                      {c.message}
                    </p>
                    {c.admin_note && (
                      <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-[#132340] text-xs text-blue-900 dark:text-blue-200">
                        <strong>Tala ng Admin:</strong> {c.admin_note}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab ng Pangangasiwa ng mga Administrator */}
        {tab === 'admins' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await api.adminCreateAdmin({
                    full_name: newAdminName.trim(),
                    email: newAdminEmail.trim().toLowerCase(),
                    password: newAdminPassword,
                  });
                  setNewAdminName('');
                  setNewAdminEmail('');
                  setNewAdminPassword('');
                  onNotify('success', 'Nagawa ang bagong Administrator account.');
                  await loadData();
                } catch (err) {
                  onNotify('error', err instanceof Error ? err.message : 'Nabigong gumawa ng admin');
                }
              }}
              className="rounded-3xl bg-white dark:bg-[#0D1930] border border-blue-200/80 dark:border-blue-900/50 p-6 space-y-3.5 h-fit"
            >
              <h3 className="font-display font-bold text-base flex items-center gap-2">
                <ShieldPlus className="w-4 h-4 text-blue-600 dark:text-sky-400" /> Gumawa ng Admin Account
              </h3>
              <p className="text-xs text-slate-500">
                Mga awtorisadong administrator lamang ang maaaring gumawa o magtalaga ng mga bagong administrator account.
              </p>
              <input
                type="text"
                required
                value={newAdminName}
                onChange={(e) => setNewAdminName(e.target.value)}
                placeholder="Buong Pangalan ng Administrator"
                className="w-full px-3 py-2 text-sm rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-[#132340]"
              />
              <input
                type="email"
                required
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                placeholder="pangalan.admin@gmail.com"
                className="w-full px-3 py-2 text-sm rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-[#132340]"
              />
              <input
                type="password"
                required
                minLength={8}
                value={newAdminPassword}
                onChange={(e) => setNewAdminPassword(e.target.value)}
                placeholder="Matibay na Password (8+ karakter + numero)"
                className="w-full px-3 py-2 text-sm rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-[#132340]"
              />
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-800 to-sky-600 text-white text-xs font-semibold cursor-pointer"
              >
                Gumawa ng Administrator
              </button>
            </form>

            <div className="lg:col-span-2 rounded-3xl bg-white dark:bg-[#0D1930] border border-blue-200/80 dark:border-blue-900/50 p-6 space-y-3">
              <h3 className="font-display font-bold text-base">Mga Awtorisadong Administrator</h3>
              <div className="divide-y divide-blue-100 dark:divide-blue-900/40">
                {admins.map((adm) => (
                  <div key={adm.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="font-bold text-sm text-slate-900 dark:text-white">
                        {adm.full_name}
                      </div>
                      <div className="text-slate-500">{adm.email}</div>
                    </div>
                    <div className="text-right text-slate-400">
                      <span className="inline-block px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold text-[10px] uppercase">
                        Admin
                      </span>
                      <div className="mt-1">
                        Huling login: {adm.last_login_at ? formatRelativeTime(adm.last_login_at) : 'Hindi pa'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal ng Pagpapalit ng Status */}
      <Modal
        open={Boolean(statusModal)}
        onClose={() => setStatusModal(null)}
        title={
          statusModal
            ? `${statusModal.targetStatus === 'suspended' ? 'Suspindihin' : 'I-deactivate'} ang Account ng Mag-aaral`
            : ''
        }
        subtitle={statusModal ? `${statusModal.student.full_name} (${statusModal.student.email})` : ''}
      >
        <form onSubmit={applyStatusChange} className="space-y-4">
          <p className="text-xs text-slate-600 dark:text-blue-200/80">
            Agarang tatapusin ang mga aktibong session at hindi makakapag-sign in ang mag-aaral hanggang sa
            muling ma-activate ang account.
          </p>
          <div>
            <label className="block text-xs font-semibold mb-1">Dahilan / Tala (ipapakita sa mag-aaral)</label>
            <textarea
              rows={3}
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value)}
              placeholder="Hal., Nakabinbin ang beripikasyon ng email o pagsusuri ng patakaran..."
              className="w-full px-3 py-2 text-sm rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-[#132340]"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setStatusModal(null)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-blue-50 cursor-pointer"
            >
              Kanselahin
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer"
            >
              Kumpirmahin ({statusModal ? getStatusLabel(statusModal.targetStatus) : ''})
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal ng Pamamahala sa Alalahanin */}
      <Modal
        open={Boolean(concernModal)}
        onClose={() => setConcernModal(null)}
        title="Pamahalaan ang Alalahanin sa Account"
        subtitle={concernModal?.email}
      >
        <form onSubmit={handleSaveConcern} className="space-y-4">
          <div className="p-3 rounded-xl bg-blue-50 dark:bg-[#132340] text-xs space-y-1">
            <div className="font-bold">{concernModal?.subject}</div>
            <p className="text-slate-600 dark:text-blue-200/80">{concernModal?.message}</p>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Status ng Resolusyon</label>
            <select
              value={concernStatusDraft}
              onChange={(e) => setConcernStatusDraft(e.target.value as 'open' | 'in_review' | 'resolved')}
              className="w-full px-3 py-2 text-sm rounded-xl border border-blue-200 dark:border-blue-800 bg-white dark:bg-[#132340]"
            >
              <option value="open">Bukas</option>
              <option value="in_review">Sinusuri</option>
              <option value="resolved">Nalutas</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Tugon ng Administrator</label>
            <textarea
              rows={3}
              value={adminNoteDraft}
              onChange={(e) => setAdminNoteDraft(e.target.value)}
              placeholder="Isulat ang mga detalye ng resolusyon para sa mag-aaral..."
              className="w-full px-3 py-2 text-sm rounded-xl border border-blue-200 dark:border-blue-800 bg-white dark:bg-[#132340]"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConcernModal(null)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 cursor-pointer"
            >
              Kanselahin
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold cursor-pointer"
            >
              I-save ang Update
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
