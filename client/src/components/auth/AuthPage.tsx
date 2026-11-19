import React, { useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  FileText,
  GraduationCap,
  Lock,
  Mail,
  PenTool,
  Sparkles,
  User as UserIcon,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { BrandLogo } from '../common/BrandLogo';

export const AuthPage: React.FC = () => {
  const { login, register, demoLogin } = useAuth();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [university, setUniversity] = useState('');
  const [major, setMajor] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (tab === 'login') {
        await login(email, password);
      } else {
        await register({
          email,
          password,
          full_name: fullName,
          university,
          major,
          academic_year: academicYear,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemo = async () => {
    setError('');
    setSubmitting(true);
    try {
      await demoLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enter demo workspace');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#F5F3EE] dark:bg-[#0B0F17]">
      {/* Left Showcase Panel */}
      <div className="lg:w-[52%] relative overflow-hidden bg-gradient-to-br from-[#1E1B4B] via-[#312E81] to-[#1E293B] text-white p-8 sm:p-12 lg:p-16 flex flex-col justify-between">
        <div
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(rgba(255,255,255,0.45) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2.5 bg-white/10 border border-white/15 px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide text-amber-200 mb-8">
            <Sparkles className="w-3.5 h-3.5" />
            All-in-One Academic Workspace
          </div>
          <h1 className="font-display text-3xl sm:text-5xl font-extrabold tracking-tight leading-[1.1] max-w-xl">
            Write like a scholar. <br />
            <span className="text-amber-300">Sketch like an artist.</span>
          </h1>
          <p className="mt-5 text-indigo-100/85 text-base sm:text-lg max-w-lg leading-relaxed">
            INKORA unifies traditional ruled & Cornell notebooks, a pressure-aware digital drawing pad,
            and a full Word-class document editor—backed by persistent academic storage.
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-4 mt-10">
          <div className="rounded-2xl bg-white/10 border border-white/15 p-4 backdrop-blur-xs">
            <div className="w-9 h-9 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center mb-3">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-sm">Document Studio</h3>
            <p className="text-xs text-indigo-100/75 mt-1 leading-relaxed">
              Word-style ribbon, tables, checklists, KaTeX math, and PDF/HTML export.
            </p>
          </div>
          <div className="rounded-2xl bg-white/10 border border-white/15 p-4 backdrop-blur-xs">
            <div className="w-9 h-9 rounded-xl bg-emerald-400/20 text-emerald-300 flex items-center justify-center mb-3">
              <BookOpen className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-sm">Cornell & Ruled</h3>
            <p className="text-xs text-indigo-100/75 mt-1 leading-relaxed">
              College-ruled, dot grid, and Cornell lecture sheets with live ink overlays.
            </p>
          </div>
          <div className="rounded-2xl bg-white/10 border border-white/15 p-4 backdrop-blur-xs">
            <div className="w-9 h-9 rounded-xl bg-sky-400/20 text-sky-300 flex items-center justify-center mb-3">
              <PenTool className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-sm">Digital Drawing Pad</h3>
            <p className="text-xs text-indigo-100/75 mt-1 leading-relaxed">
              Pen, calligraphy, highlighter, shapes, layers, and side-by-side split view.
            </p>
          </div>
        </div>

        <div className="relative z-10 mt-10 pt-6 border-t border-white/15 flex flex-wrap items-center justify-between gap-4 text-xs text-indigo-200/80">
          <span>SQLite-backed notebooks, file vault, flashcards & version history</span>
          <span className="font-mono">INKORA v1.0</span>
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 lg:p-14">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <BrandLogo size="lg" />
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-stone-200 dark:border-slate-800 shadow-xl shadow-slate-900/5 p-6 sm:p-8">
            <div className="grid grid-cols-2 p-1 rounded-xl bg-stone-100 dark:bg-slate-800 mb-6">
              <button
                type="button"
                onClick={() => {
                  setTab('login');
                  setError('');
                }}
                className={`py-2 text-sm font-semibold rounded-lg transition ${
                  tab === 'login'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('register');
                  setError('');
                }}
                className={`py-2 text-sm font-semibold rounded-lg transition ${
                  tab === 'register'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                }`}
              >
                Create Account
              </button>
            </div>

            {error && (
              <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-200 text-xs font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {tab === 'register' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Full Name
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Alex Rivera"
                      className="w-full pl-9 pr-3.5 py-2.5 text-sm rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50/50 dark:bg-slate-800/70 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="student@university.edu"
                    className="w-full pl-9 pr-3.5 py-2.5 text-sm rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50/50 dark:bg-slate-800/70 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Password {tab === 'register' && <span className="text-slate-400 font-normal">(min 8 chars)</span>}
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    minLength={tab === 'register' ? 8 : 1}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3.5 py-2.5 text-sm rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50/50 dark:bg-slate-800/70 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {tab === 'register' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      University / School
                    </label>
                    <input
                      type="text"
                      value={university}
                      onChange={(e) => setUniversity(e.target.value)}
                      placeholder="Bridgewater State"
                      className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50/50 dark:bg-slate-800/70 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Major / Program
                    </label>
                    <input
                      type="text"
                      value={major}
                      onChange={(e) => setMajor(e.target.value)}
                      placeholder="Computer Science"
                      className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50/50 dark:bg-slate-800/70 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Year / Level
                    </label>
                    <input
                      type="text"
                      value={academicYear}
                      onChange={(e) => setAcademicYear(e.target.value)}
                      placeholder="Sophomore / Year 2"
                      className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50/50 dark:bg-slate-800/70 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold text-sm shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 transition cursor-pointer"
              >
                {submitting
                  ? 'Please wait...'
                  : tab === 'login'
                    ? 'Open My Workspace'
                    : 'Create Student Workspace'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <div className="my-5 flex items-center gap-3">
              <div className="flex-1 h-px bg-stone-200 dark:bg-slate-800" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Or explore instantly
              </span>
              <div className="flex-1 h-px bg-stone-200 dark:bg-slate-800" />
            </div>

            <button
              type="button"
              onClick={handleDemo}
              disabled={submitting}
              className="w-full py-2.5 px-4 rounded-xl border border-indigo-200 dark:border-indigo-800/70 bg-indigo-50/70 dark:bg-indigo-950/40 hover:bg-indigo-100/80 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-200 font-semibold text-sm flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <GraduationCap className="w-4 h-4" />
              Try Demo Student Account (Alex Rivera)
            </button>
            <p className="text-[11px] text-center text-slate-400 mt-2.5">
              Pre-loaded with Biology lab reports, CS Cornell notes, diagrams & flashcards.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
