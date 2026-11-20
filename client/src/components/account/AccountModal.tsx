import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Download,
  HardDrive,
  KeyRound,
  LogOut,
  MessageSquarePlus,
  MonitorSmartphone,
  ShieldAlert,
  Trash2,
  User as UserIcon,
} from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { AccountConcern, AccountOverview } from '../../types';
import { formatBytes, formatRelativeTime } from '../../utils/format';
import { Modal } from '../common/Modal';

interface AccountModalProps {
  open: boolean;
  onClose: () => void;
  onNotify: (type: 'success' | 'error' | 'info', text: string) => void;
}

function getConcernStatusLabel(status: string): string {
  if (status === 'resolved') return 'Nalutas';
  if (status === 'in_review') return 'Sinusuri';
  return 'Bukas';
}

export const AccountModal: React.FC<AccountModalProps> = ({ open, onClose, onNotify }) => {
  const { user, setUser, logout } = useAuth();
  const { setMode } = useTheme();
  const [tab, setTab] = useState<'profile' | 'security' | 'storage' | 'support' | 'danger'>('profile');
  const [overview, setOverview] = useState<AccountOverview | null>(null);
  const [concerns, setConcerns] = useState<AccountConcern[]>([]);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [university, setUniversity] = useState('');
  const [major, setMajor] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [bio, setBio] = useState('');
  const [themePref, setThemePref] = useState<'system' | 'light' | 'dark'>('light');
  const [accentPref, setAccentPref] = useState<'blue' | 'sky' | 'navy'>('blue');

  const [concernSubject, setConcernSubject] = useState('');
  const [concernCategory, setConcernCategory] = useState('account_access');
  const [concernMessage, setConcernMessage] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [revokeOthers, setRevokeOthers] = useState(true);
  const [deleteConfirmPassword, setDeleteConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const loadOverview = async () => {
    try {
      const [ov, con] = await Promise.all([api.accountOverview(), api.listAccountConcerns()]);
      setOverview(ov);
      setConcerns(con.concerns);
    } catch {
      // huwag pansinin
    }
  };

  useEffect(() => {
    if (!open || !user) return;
    setFullName(user.full_name);
    setEmail(user.email);
    setUniversity(user.university || '');
    setMajor(user.major || '');
    setAcademicYear(user.academic_year || '');
    setBio(user.bio || '');
    setThemePref(user.theme_preference || 'light');
    const savedAccent = user.workspace_accent;
    setAccentPref(savedAccent === 'sky' || savedAccent === 'navy' ? savedAccent : 'blue');
    setTab('profile');
    loadOverview();
  }, [open, user]);

  if (!user) return null;

  const isAdmin = user.role === 'admin';
  const roleLabel = isAdmin ? 'ADMIN' : 'MAG-AARAL';

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.updateProfile({
        full_name: fullName,
        email,
        university,
        major,
        academic_year: academicYear,
        bio,
        theme_preference: themePref,
        workspace_accent: accentPref,
      });
      setUser(res.user);
      setMode(themePref);
      onNotify('success', 'Na-update ang mga kagustuhan sa account at workspace!');
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Nabigo ang pag-update');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = async (file: File) => {
    try {
      const res = await api.uploadAvatar(file);
      setUser(res.user);
      onNotify('success', 'Na-update ang larawan sa profile!');
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Nabigo ang pag-upload ng avatar');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.changePassword(currentPassword, newPassword, revokeOthers);
      setCurrentPassword('');
      setNewPassword('');
      onNotify('success', 'Matagumpay na napalitan ang password!');
      loadOverview();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Nabigo ang pagpapalit ng password');
    } finally {
      setSaving(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await api.revokeSession(sessionId);
      onNotify('info', 'Tinapos ang session');
      loadOverview();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Nabigong tapusin ang session');
    }
  };

  const handleSubmitConcern = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.createAccountConcern({
        subject: concernSubject,
        category: concernCategory,
        message: concernMessage,
      });
      setConcernSubject('');
      setConcernMessage('');
      onNotify('success', 'Naipadala ang alalahanin sa suporta ng Admin.');
      await loadOverview();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Nabigong ipadala ang alalahanin');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm('Sigurado ka na ba? Ang lahat ng folder, kuwaderno, tala, guhit, at na-upload na file ay permanenteng mabubura.')) {
      return;
    }
    try {
      await api.deleteAccount(deleteConfirmPassword);
      onClose();
      setUser(null);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Hindi mabura ang account');
    }
  };

  const tabs = [
    { id: 'profile', label: 'Profile at Workspace', icon: <UserIcon className="w-3.5 h-3.5" /> },
    { id: 'security', label: 'Seguridad at mga Session', icon: <KeyRound className="w-3.5 h-3.5" /> },
    ...(!isAdmin
      ? [
          { id: 'storage', label: 'Storage at Backup', icon: <HardDrive className="w-3.5 h-3.5" /> },
          { id: 'support', label: 'Mga Alalahanin sa Account', icon: <MessageSquarePlus className="w-3.5 h-3.5" /> },
          { id: 'danger', label: 'Burahin ang Account', icon: <ShieldAlert className="w-3.5 h-3.5" /> },
        ]
      : []),
  ] as const;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Mga Setting ng Account at Workspace"
      subtitle={`Naka-sign in bilang ${roleLabel} · ${user.email}`}
      maxWidthClass="max-w-2xl"
    >
      <div className="space-y-5">
        <div className="flex flex-wrap gap-1.5 p-1 rounded-xl bg-blue-50 dark:bg-[#132340]">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as typeof tab)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                tab === t.id
                  ? 'bg-white dark:bg-[#0D1930] text-blue-700 dark:text-sky-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-blue-900'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {tab === 'profile' && (
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-blue-50/70 dark:bg-[#132340] border border-blue-200/70 dark:border-blue-800">
              <div className="relative">
                {user.avatar_file ? (
                  <img
                    src={`/api/account/avatar/${user.id}/${user.avatar_file}`}
                    alt={user.full_name}
                    className="w-16 h-16 rounded-2xl object-cover ring-2 ring-blue-500/30"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-800 to-sky-500 text-white font-display font-bold text-xl flex items-center justify-center">
                    {user.full_name.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  {user.full_name}
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200">
                    {roleLabel}
                  </span>
                </div>
                <div className="text-xs text-slate-400">{user.email}</div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleAvatarChange(f);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-[#0D1930] border border-blue-200 dark:border-blue-800 text-xs font-semibold hover:border-blue-400 cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" /> Palitan ang Larawan
                </button>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await logout();
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-blue-200 dark:border-blue-800 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-white cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" /> Mag-sign Out
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Buong Pangalan
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-[#132340]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Beripikadong Gmail Address
                </label>
                <input
                  type="email"
                  readOnly
                  value={email}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-blue-200 dark:border-blue-800 bg-slate-100 dark:bg-[#0B172E] text-slate-500 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Unibersidad / Paaralan
                </label>
                <input
                  type="text"
                  value={university}
                  onChange={(e) => setUniversity(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-[#132340]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Kurso / Departamento
                </label>
                <input
                  type="text"
                  value={major}
                  onChange={(e) => setMajor(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-[#132340]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Tema ng Workspace
                </label>
                <select
                  value={themePref}
                  onChange={(e) => setThemePref(e.target.value as 'system' | 'light' | 'dark')}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-[#132340]"
                >
                  <option value="light">Maliwanag (Asul at Puti)</option>
                  <option value="dark">Madilim na Tema</option>
                  <option value="system">Sundin ang Sistema</option>
                </select>
              </div>
              {!isAdmin && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Kulay ng Accent
                  </label>
                  <select
                    value={accentPref}
                    onChange={(e) => setAccentPref(e.target.value as 'blue' | 'sky' | 'navy')}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-[#132340]"
                  >
                    <option value="blue">Asul at Puti (Karaniwan)</option>
                    <option value="sky">Maliwanag na Sky Blue</option>
                    <option value="navy">Akademikong Navy Blue</option>
                  </select>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Akademikong Bio / Mga Layunin sa Pag-aaral
              </label>
              <textarea
                rows={2}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-[#132340]"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-800 to-sky-600 hover:brightness-110 text-white text-sm font-semibold cursor-pointer"
              >
                {saving ? 'Sini-save...' : 'I-save ang mga Pagbabago'}
              </button>
            </div>
          </form>
        )}

        {tab === 'security' && (
          <div className="space-y-6">
            <form onSubmit={handleChangePassword} className="space-y-3 p-4 rounded-2xl border border-blue-200 dark:border-blue-800">
              <h4 className="font-display font-bold text-sm">Palitan ang Password</h4>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Kasalukuyang password"
                className="w-full px-3 py-2 text-sm rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-[#132340]"
              />
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Bagong password (min 8 karakter)"
                className="w-full px-3 py-2 text-sm rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-[#132340]"
              />
              <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={revokeOthers}
                  onChange={(e) => setRevokeOthers(e.target.checked)}
                  className="accent-blue-700"
                />
                I-sign out ang iba pang aktibong device pagkatapos palitan ang password
              </label>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold cursor-pointer"
              >
                I-update ang Password
              </button>
            </form>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-display font-bold text-sm flex items-center gap-1.5">
                  <MonitorSmartphone className="w-4 h-4 text-blue-600 dark:text-sky-400" /> Mga Aktibong Session
                </h4>
                <button
                  type="button"
                  onClick={async () => {
                    await api.logoutAll();
                    onClose();
                    window.location.reload();
                  }}
                  className="text-xs font-semibold text-rose-600 hover:underline cursor-pointer"
                >
                  I-sign out lahat ng device
                </button>
              </div>
              <div className="space-y-2">
                {overview?.sessions.map((s) => (
                  <div
                    key={s.id}
                    className="p-3 rounded-xl border border-blue-200/70 dark:border-blue-800 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                        {s.user_agent || 'Session ng Browser'}
                        {s.isCurrent && (
                          <span className="ml-2 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px]">
                            Kasalukuyang Device
                          </span>
                        )}
                      </div>
                      <div className="text-slate-400 mt-0.5">
                        Huling aktibo {formatRelativeTime(s.last_active_at)}
                      </div>
                    </div>
                    {!s.isCurrent && (
                      <button
                        type="button"
                        onClick={() => handleRevokeSession(s.id)}
                        className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-600 font-semibold cursor-pointer"
                      >
                        Tapusin
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'storage' && !isAdmin && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-[#132340]">
                <div className="text-[11px] text-slate-400">Mga Folder</div>
                <div className="font-display font-bold text-lg">{overview?.counts.folders ?? 0}</div>
              </div>
              <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-[#132340]">
                <div className="text-[11px] text-slate-400">Asignatura</div>
                <div className="font-display font-bold text-lg">{overview?.counts.subjects ?? 0}</div>
              </div>
              <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-[#132340]">
                <div className="text-[11px] text-slate-400">Kuwaderno</div>
                <div className="font-display font-bold text-lg">{overview?.counts.notebooks ?? 0}</div>
              </div>
              <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-[#132340]">
                <div className="text-[11px] text-slate-400">Mga Tala</div>
                <div className="font-display font-bold text-lg">{overview?.counts.notes ?? 0}</div>
              </div>
              <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-[#132340]">
                <div className="text-[11px] text-slate-400">Mga File</div>
                <div className="font-display font-bold text-lg">{overview?.counts.files ?? 0}</div>
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-blue-200 dark:border-blue-800 space-y-2">
              <div className="flex justify-between text-xs font-semibold">
                <span>Nagamit na Espasyo</span>
                <span>
                  {formatBytes(overview?.storage.usedBytes || 0)} /{' '}
                  {formatBytes(overview?.storage.quotaBytes || user.storage_quota_bytes)}
                </span>
              </div>
              <div className="h-2 rounded-full bg-blue-100 dark:bg-blue-950 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-700 to-sky-500 rounded-full"
                  style={{
                    width: `${Math.max(
                      2,
                      Math.min(
                        100,
                        Math.round(
                          ((overview?.storage.usedBytes || 0) /
                            (overview?.storage.quotaBytes || user.storage_quota_bytes)) *
                            100
                        )
                      )
                    )}%`,
                  }}
                />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 flex items-center justify-between gap-4">
              <div>
                <div className="font-semibold text-sm text-slate-900 dark:text-white">
                  Buong Backup ng Workspace
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  I-download ang lahat ng iyong folder, asignatura, kuwaderno, tala, guhit, at flashcards bilang JSON.
                </div>
              </div>
              <a
                href="/api/account/export"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-700 text-white text-xs font-semibold shrink-0"
              >
                <Download className="w-3.5 h-3.5" /> I-export na JSON
              </a>
            </div>
          </div>
        )}

        {tab === 'support' && !isAdmin && (
          <div className="space-y-5">
            <form onSubmit={handleSubmitConcern} className="space-y-3 p-4 rounded-2xl border border-blue-200 dark:border-blue-800">
              <h4 className="font-display font-bold text-sm">Magpadala ng Alalahanin sa Account</h4>
              <p className="text-xs text-slate-500">
                Makipag-ugnayan sa Administrator tungkol sa pag-access sa account, espasyo sa storage, o pag-update ng profile.
                Mananatiling nakatago ang iyong mga pribadong tala at file.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <select
                  value={concernCategory}
                  onChange={(e) => setConcernCategory(e.target.value)}
                  className="px-3 py-2 text-xs rounded-xl border border-blue-200 dark:border-blue-800 bg-white dark:bg-[#132340]"
                >
                  <option value="account_access">Pag-access sa Account</option>
                  <option value="storage_quota">Espasyo sa Storage</option>
                  <option value="billing_profile">Profile / Email</option>
                  <option value="other">Iba pa</option>
                </select>
                <input
                  type="text"
                  required
                  value={concernSubject}
                  onChange={(e) => setConcernSubject(e.target.value)}
                  placeholder="Paksa ng alalahanin..."
                  className="sm:col-span-2 px-3 py-2 text-sm rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-[#132340]"
                />
              </div>
              <textarea
                required
                rows={3}
                value={concernMessage}
                onChange={(e) => setConcernMessage(e.target.value)}
                placeholder="Ilarawan ang iyong alalahanin sa account..."
                className="w-full px-3 py-2 text-sm rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-[#132340]"
              />
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold cursor-pointer"
              >
                Ipadala sa Admin
              </button>
            </form>

            {concerns.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-display font-bold text-xs uppercase tracking-wider text-slate-400">
                  Iyong mga Kamakailang Ticket
                </h4>
                {concerns.map((c) => (
                  <div
                    key={c.id}
                    className="p-3 rounded-xl border border-blue-200/70 dark:border-blue-800 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold">{c.subject}</span>
                      <span className="uppercase text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200">
                        {getConcernStatusLabel(c.status)}
                      </span>
                    </div>
                    <p className="text-slate-500">{c.message}</p>
                    {c.admin_note && (
                      <div className="text-blue-700 dark:text-sky-300 font-medium pt-1">
                        Tugon ng Admin: {c.admin_note}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'danger' && !isAdmin && (
          <div className="p-5 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 space-y-4">
            <h4 className="font-display font-bold text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <Trash2 className="w-4 h-4" /> Permanenteng Burahin ang Account
            </h4>
            <p className="text-xs text-rose-700/80 dark:text-rose-200/80 leading-relaxed">
              Ang pagbura ng iyong account ay magtatanggal nang permanente ng iyong profile, lahat ng folder,
              kuwaderno, dokumento, guhit, flashcards, at lahat ng na-upload na file mula sa server.
            </p>
            {!user.is_demo && (
              <input
                type="password"
                value={deleteConfirmPassword}
                onChange={(e) => setDeleteConfirmPassword(e.target.value)}
                placeholder="Ilagay ang iyong password upang kumpirmahin"
                className="w-full px-3 py-2 text-sm rounded-xl border border-rose-300 dark:border-rose-800 bg-white dark:bg-[#0D1930]"
              />
            )}
            <button
              type="button"
              onClick={handleDeleteAccount}
              className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
            >
              Permanenteng Burahin ang Aking Account
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
};
