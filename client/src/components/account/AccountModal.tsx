import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Download,
  HardDrive,
  KeyRound,
  LogOut,
  MonitorSmartphone,
  ShieldAlert,
  Trash2,
  User as UserIcon,
} from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { AccountOverview } from '../../types';
import { formatBytes, formatRelativeTime } from '../../utils/format';
import { Modal } from '../common/Modal';

interface AccountModalProps {
  open: boolean;
  onClose: () => void;
  onNotify: (type: 'success' | 'error' | 'info', text: string) => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({ open, onClose, onNotify }) => {
  const { user, setUser, logout } = useAuth();
  const { setMode } = useTheme();
  const [tab, setTab] = useState<'profile' | 'security' | 'storage' | 'danger'>('profile');
  const [overview, setOverview] = useState<AccountOverview | null>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [university, setUniversity] = useState('');
  const [major, setMajor] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [bio, setBio] = useState('');
  const [themePref, setThemePref] = useState<'system' | 'light' | 'dark'>('light');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [revokeOthers, setRevokeOthers] = useState(true);
  const [deleteConfirmPassword, setDeleteConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const loadOverview = async () => {
    try {
      const res = await api.accountOverview();
      setOverview(res);
    } catch {
      // ignore
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
    setThemePref(user.theme_preference || 'system');
    loadOverview();
  }, [open, user]);

  if (!user) return null;

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
      });
      setUser(res.user);
      setMode(themePref);
      onNotify('success', 'Account profile updated!');
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = async (file: File) => {
    try {
      const res = await api.uploadAvatar(file);
      setUser(res.user);
      onNotify('success', 'Profile photo updated!');
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Avatar upload failed');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.changePassword(currentPassword, newPassword, revokeOthers);
      setCurrentPassword('');
      setNewPassword('');
      onNotify('success', 'Password changed successfully!');
      loadOverview();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Password change failed');
    } finally {
      setSaving(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await api.revokeSession(sessionId);
      onNotify('info', 'Session revoked');
      loadOverview();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Failed to revoke session');
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm('Are you absolutely sure? All notebooks, notes, drawings, and uploaded files will be permanently erased.')) {
      return;
    }
    try {
      await api.deleteAccount(deleteConfirmPassword);
      onClose();
      setUser(null);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Could not delete account');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Student Account & Preferences"
      subtitle="Manage your academic profile, security, active sessions, and storage"
      maxWidthClass="max-w-2xl"
    >
      <div className="space-y-5">
        {/* Tabs */}
        <div className="flex flex-wrap gap-1.5 p-1 rounded-xl bg-stone-100 dark:bg-slate-800">
          {[
            { id: 'profile', label: 'Profile', icon: <UserIcon className="w-3.5 h-3.5" /> },
            { id: 'security', label: 'Security & Sessions', icon: <KeyRound className="w-3.5 h-3.5" /> },
            { id: 'storage', label: 'Storage & Backup', icon: <HardDrive className="w-3.5 h-3.5" /> },
            { id: 'danger', label: 'Delete Account', icon: <ShieldAlert className="w-3.5 h-3.5" /> },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as typeof tab)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                tab === t.id
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {tab === 'profile' && (
          <form onSubmit={handleSaveProfile} className="space-y-4">
            {/* Avatar */}
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-stone-50 dark:bg-slate-800/60 border border-stone-200 dark:border-slate-700">
              <div className="relative">
                {user.avatar_file ? (
                  <img
                    src={`/api/account/avatar/${user.id}/${user.avatar_file}`}
                    alt={user.full_name}
                    className="w-16 h-16 rounded-2xl object-cover ring-2 ring-indigo-500/30"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white font-display font-bold text-xl flex items-center justify-center">
                    {user.full_name.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-sm text-slate-900 dark:text-white">
                  {user.full_name}
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
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-700 text-xs font-semibold hover:border-indigo-400 cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" /> Change Photo
                </button>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await logout();
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign Out
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  University / School
                </label>
                <input
                  type="text"
                  value={university}
                  onChange={(e) => setUniversity(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Major / Department
                </label>
                <input
                  type="text"
                  value={major}
                  onChange={(e) => setMajor(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Academic Year
                </label>
                <input
                  type="text"
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Interface Theme
                </label>
                <select
                  value={themePref}
                  onChange={(e) => setThemePref(e.target.value as 'system' | 'light' | 'dark')}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800"
                >
                  <option value="light">Light Academic Paper</option>
                  <option value="dark">Midnight Study (Dark)</option>
                  <option value="system">Match System</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Academic Bio / Study Goals
              </label>
              <textarea
                rows={2}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold cursor-pointer"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}

        {tab === 'security' && (
          <div className="space-y-6">
            <form onSubmit={handleChangePassword} className="space-y-3 p-4 rounded-2xl border border-stone-200 dark:border-slate-800">
              <h4 className="font-display font-bold text-sm">Update Password</h4>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Current password"
                className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800"
              />
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password (min 8 characters)"
                className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800"
              />
              <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={revokeOthers}
                  onChange={(e) => setRevokeOthers(e.target.checked)}
                  className="accent-indigo-600"
                />
                Sign out all other active devices after changing password
              </label>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold cursor-pointer"
              >
                Update Password
              </button>
            </form>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-display font-bold text-sm flex items-center gap-1.5">
                  <MonitorSmartphone className="w-4 h-4 text-indigo-600" /> Active Sessions
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
                  Sign out all devices
                </button>
              </div>
              <div className="space-y-2">
                {overview?.sessions.map((s) => (
                  <div
                    key={s.id}
                    className="p-3 rounded-xl border border-stone-200 dark:border-slate-800 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                        {s.user_agent || 'Browser Session'}
                        {s.isCurrent && (
                          <span className="ml-2 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px]">
                            This Device
                          </span>
                        )}
                      </div>
                      <div className="text-slate-400 mt-0.5">
                        Last active {formatRelativeTime(s.last_active_at)}
                      </div>
                    </div>
                    {!s.isCurrent && (
                      <button
                        type="button"
                        onClick={() => handleRevokeSession(s.id)}
                        className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-600 font-semibold cursor-pointer"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'storage' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-stone-50 dark:bg-slate-800/70">
                <div className="text-[11px] text-slate-400">Courses</div>
                <div className="font-display font-bold text-lg">{overview?.counts.subjects ?? 0}</div>
              </div>
              <div className="p-3 rounded-xl bg-stone-50 dark:bg-slate-800/70">
                <div className="text-[11px] text-slate-400">Notebooks</div>
                <div className="font-display font-bold text-lg">{overview?.counts.notebooks ?? 0}</div>
              </div>
              <div className="p-3 rounded-xl bg-stone-50 dark:bg-slate-800/70">
                <div className="text-[11px] text-slate-400">Notes</div>
                <div className="font-display font-bold text-lg">{overview?.counts.notes ?? 0}</div>
              </div>
              <div className="p-3 rounded-xl bg-stone-50 dark:bg-slate-800/70">
                <div className="text-[11px] text-slate-400">Vault Files</div>
                <div className="font-display font-bold text-lg">{overview?.counts.files ?? 0}</div>
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-stone-200 dark:border-slate-800 space-y-2">
              <div className="flex justify-between text-xs font-semibold">
                <span>Storage Used</span>
                <span>
                  {formatBytes(overview?.storage.usedBytes || 0)} /{' '}
                  {formatBytes(overview?.storage.quotaBytes || user.storage_quota_bytes)}
                </span>
              </div>
              <div className="h-2 rounded-full bg-stone-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-indigo-600 rounded-full"
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

            <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 flex items-center justify-between gap-4">
              <div>
                <div className="font-semibold text-sm text-slate-900 dark:text-white">
                  Full Workspace Backup
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Download all your courses, notebooks, notes, drawings, and flashcards as JSON.
                </div>
              </div>
              <a
                href="/api/account/export"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold shrink-0"
              >
                <Download className="w-3.5 h-3.5" /> Export JSON
              </a>
            </div>
          </div>
        )}

        {tab === 'danger' && (
          <div className="p-5 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 space-y-4">
            <h4 className="font-display font-bold text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <Trash2 className="w-4 h-4" /> Permanently Delete Account
            </h4>
            <p className="text-xs text-rose-700/80 dark:text-rose-200/80 leading-relaxed">
              Deleting your account erases your profile, all notebooks, rich documents, vector drawings,
              flashcards, and all uploaded files from server disk storage.
            </p>
            {!user.is_demo && (
              <input
                type="password"
                value={deleteConfirmPassword}
                onChange={(e) => setDeleteConfirmPassword(e.target.value)}
                placeholder="Enter your password to confirm deletion"
                className="w-full px-3 py-2 text-sm rounded-xl border border-rose-300 dark:border-rose-800 bg-white dark:bg-slate-900"
              />
            )}
            <button
              type="button"
              onClick={handleDeleteAccount}
              className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
            >
              Permanently Delete My Account
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
};
