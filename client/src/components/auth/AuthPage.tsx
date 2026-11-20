import React, { useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  FileText,
  FolderKanban,
  GraduationCap,
  Lock,
  Mail,
  Moon,
  PenTool,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  UploadCloud,
  User as UserIcon,
} from 'lucide-react';
import { ApiError, api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { BrandLogo } from '../common/BrandLogo';

export const AuthPage: React.FC = () => {
  const { login, register, demoLogin, demoAdminLogin } = useAuth();
  const { resolved, toggle: toggleTheme } = useTheme();

  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [university, setUniversity] = useState('');
  const [major, setMajor] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [error, setError] = useState('');
  const [lockedAccountStatus, setLockedAccountStatus] = useState<string | null>(null);
  const [appealMessage, setAppealMessage] = useState('');
  const [appealSent, setAppealSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const focusAuth = (mode: 'login' | 'register') => {
    setTab(mode);
    setError('');
    setLockedAccountStatus(null);
    const el = document.getElementById('inkora-auth-card');
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLockedAccountStatus(null);
    setAppealSent(false);
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
      if (err instanceof ApiError && err.accountStatus) {
        setLockedAccountStatus(err.accountStatus);
      }
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendAppeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appealMessage.trim()) return;
    setSubmitting(true);
    try {
      await api.submitAppeal({
        email,
        password,
        subject: `Account ${lockedAccountStatus || 'status'} review request`,
        message: appealMessage.trim(),
      });
      setAppealSent(true);
      setAppealMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit appeal');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoStudent = async () => {
    setError('');
    setLockedAccountStatus(null);
    setSubmitting(true);
    try {
      await demoLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enter demo workspace');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoAdmin = async () => {
    setError('');
    setLockedAccountStatus(null);
    setSubmitting(true);
    try {
      await demoAdminLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enter admin console');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F5F2FF] via-[#FAF9FE] to-[#EFF6FF] dark:from-[#0B0914] dark:via-[#110D22] dark:to-[#0C1222] text-slate-900 dark:text-slate-100">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-white/80 dark:bg-[#0E0B1A]/80 border-b border-violet-200/60 dark:border-violet-900/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
          <BrandLogo size="md" />

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600 dark:text-violet-100/75">
            <a href="#studios" className="hover:text-violet-700 dark:hover:text-violet-300 transition">
              Studios
            </a>
            <a href="#organization" className="hover:text-violet-700 dark:hover:text-violet-300 transition">
              Workspace
            </a>
            <a href="#privacy" className="hover:text-violet-700 dark:hover:text-violet-300 transition">
              Privacy & Roles
            </a>
          </nav>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-xl border border-violet-200/80 dark:border-violet-800/60 bg-white dark:bg-slate-900 text-slate-600 dark:text-violet-200 hover:border-violet-400 transition cursor-pointer"
              aria-label="Toggle theme"
            >
              {resolved === 'dark' ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => focusAuth('login')}
              className="hidden sm:inline-flex px-4 py-2 rounded-xl text-sm font-semibold text-violet-800 dark:text-violet-200 hover:bg-violet-100/70 dark:hover:bg-violet-900/40 transition cursor-pointer"
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => focusAuth('register')}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-violet-800 via-purple-700 to-blue-600 hover:brightness-110 shadow-md shadow-violet-700/20 transition cursor-pointer"
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none opacity-45 dark:opacity-20"
          style={{
            backgroundImage: 'radial-gradient(rgba(109, 40, 217, 0.16) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-violet-400/25 blur-3xl pointer-events-none" />
        <div className="absolute top-20 right-0 w-96 h-96 rounded-full bg-blue-400/20 blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-8 pt-12 pb-16 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* Hero Copy & Creative Preview */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/90 dark:bg-violet-950/70 border border-violet-200 dark:border-violet-800/70 text-xs font-semibold text-violet-800 dark:text-violet-200 shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-blue-500" />
              Designed for Students · Built for Academic Expression
            </div>

            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.06] text-slate-950 dark:text-white">
              Your Thoughts.{' '}
              <span className="bg-gradient-to-r from-violet-800 via-purple-600 to-blue-500 dark:from-violet-300 dark:via-purple-300 dark:to-sky-300 bg-clip-text text-transparent">
                Your Space.
              </span>{' '}
              <br />
              Your Ink.
            </h1>

            <p className="text-base sm:text-lg text-slate-600 dark:text-violet-100/80 max-w-2xl leading-relaxed">
              INKORA brings together the comfort of a traditional college-ruled notebook, a smooth
              digital drawing pad, and a Word-style document editor—organized with folders, full-text
              search, and private personal file storage.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleDemoStudent}
                disabled={submitting}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-violet-800 via-purple-700 to-blue-600 hover:brightness-110 text-white text-sm font-bold shadow-lg shadow-violet-800/25 transition cursor-pointer"
              >
                <GraduationCap className="w-4 h-4" />
                Try Demo Student Workspace
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => focusAuth('register')}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white/90 dark:bg-slate-900 border border-violet-200 dark:border-violet-800/80 text-violet-900 dark:text-violet-200 text-sm font-semibold hover:border-violet-400 transition cursor-pointer"
              >
                Create Free Account
              </button>
            </div>

            {/* Creative Layered Studio Preview */}
            <div className="pt-4">
              <div className="rounded-3xl bg-white/90 dark:bg-[#17122B]/90 border border-violet-200/80 dark:border-violet-800/70 shadow-2xl shadow-violet-950/10 p-4 sm:p-5 backdrop-blur-sm">
                <div className="flex items-center justify-between border-b border-violet-100 dark:border-violet-900/60 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-300" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    <span className="ml-2 text-xs font-semibold text-slate-500 dark:text-violet-300/70">
                      BIO 204 · Lecture & Lab Studio
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] font-semibold">
                    <span className="px-2.5 py-1 rounded-lg bg-violet-100 text-violet-800 dark:bg-violet-900/60 dark:text-violet-200">
                      Document
                    </span>
                    <span className="px-2.5 py-1 rounded-lg text-slate-400">Notebook</span>
                    <span className="px-2.5 py-1 rounded-lg text-slate-400">Draw Pad</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-2xl bg-gradient-to-br from-violet-50 to-white dark:from-[#211A3D] dark:to-[#18132E] border border-violet-100 dark:border-violet-800/50 p-4 space-y-2">
                    <div className="text-xs font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300">
                      Word Document + Cornell
                    </div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white">
                      Catalase Enzyme Kinetics
                    </div>
                    <p className="text-xs text-slate-500 dark:text-violet-200/75 leading-relaxed">
                      Format structured lab tables, checklists, citations, and KaTeX equations with clean A4 export.
                    </p>
                  </div>

                  <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-violet-50 dark:from-[#161E3A] dark:to-[#1E173B] border border-blue-100 dark:border-blue-900/50 p-4 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-sky-300">
                        Live Ink Sketchpad
                      </span>
                      <PenTool className="w-4 h-4 text-violet-600 dark:text-violet-300" />
                    </div>
                    <svg viewBox="0 0 220 72" className="w-full h-16 mt-2">
                      <ellipse cx="75" cy="36" rx="46" ry="24" stroke="#6D28D9" strokeWidth="2.4" fill="rgba(167,139,250,0.16)" />
                      <circle cx="75" cy="36" r="10" stroke="#3B82F6" strokeWidth="2.2" fill="rgba(96,165,250,0.22)" />
                      <path d="M126 36H170M162 29L170 36L162 43" stroke="#5B21B6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                      <rect x="176" y="20" width="32" height="32" rx="8" stroke="#3B82F6" strokeWidth="2.2" fill="rgba(59,130,246,0.12)" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Sign-In / Sign-Up Card */}
          <div id="inkora-auth-card" className="lg:col-span-5">
            <div className="bg-white/95 dark:bg-[#151128]/95 backdrop-blur-md rounded-3xl border border-violet-200/80 dark:border-violet-800/70 shadow-2xl shadow-violet-950/15 p-6 sm:p-8">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="font-display text-xl font-extrabold text-slate-950 dark:text-white">
                    {tab === 'login' ? 'Welcome Back' : 'Create Student Account'}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-violet-200/70 mt-0.5">
                    {tab === 'login'
                      ? 'Sign in to your personal workspace or admin portal.'
                      : 'Private student workspace with 250 MB file vault.'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 p-1 rounded-2xl bg-violet-50 dark:bg-[#1E1838] mb-5">
                <button
                  type="button"
                  onClick={() => {
                    setTab('login');
                    setError('');
                    setLockedAccountStatus(null);
                  }}
                  className={`py-2 text-sm font-semibold rounded-xl transition cursor-pointer ${
                    tab === 'login'
                      ? 'bg-white dark:bg-[#2A224D] text-violet-900 dark:text-white shadow-xs'
                      : 'text-slate-500 dark:text-violet-300/70 hover:text-violet-800'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTab('register');
                    setError('');
                    setLockedAccountStatus(null);
                  }}
                  className={`py-2 text-sm font-semibold rounded-xl transition cursor-pointer ${
                    tab === 'register'
                      ? 'bg-white dark:bg-[#2A224D] text-violet-900 dark:text-white shadow-xs'
                      : 'text-slate-500 dark:text-violet-300/70 hover:text-violet-800'
                  }`}
                >
                  Create Account
                </button>
              </div>

              {error && (
                <div className="mb-4 px-3.5 py-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-200 text-xs font-medium space-y-2">
                  <div>{error}</div>
                  {lockedAccountStatus && !appealSent && (
                    <form onSubmit={handleSendAppeal} className="pt-2 border-t border-rose-200/80 space-y-2">
                      <div className="font-semibold text-[11px]">
                        Need help? Submit an account review request to an Administrator:
                      </div>
                      <textarea
                        rows={2}
                        required
                        value={appealMessage}
                        onChange={(e) => setAppealMessage(e.target.value)}
                        placeholder="Explain your concern..."
                        className="w-full px-2.5 py-1.5 rounded-xl border border-rose-200 bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-xs"
                      />
                      <button
                        type="submit"
                        disabled={submitting}
                        className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-[11px] font-semibold cursor-pointer"
                      >
                        Send Account Concern
                      </button>
                    </form>
                  )}
                  {appealSent && (
                    <div className="text-emerald-700 dark:text-emerald-300 font-semibold">
                      Your account concern has been sent to the Admin team.
                    </div>
                  )}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3.5">
                {tab === 'register' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-violet-200 mb-1">
                      Full Name
                    </label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 text-violet-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Alex Rivera"
                        className="w-full pl-9 pr-3.5 py-2.5 text-sm rounded-xl border border-violet-200 dark:border-violet-800/70 bg-violet-50/30 dark:bg-[#1E1838]/60 focus:outline-none focus:ring-2 focus:ring-violet-500"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-violet-200 mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-violet-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="student@university.edu"
                      className="w-full pl-9 pr-3.5 py-2.5 text-sm rounded-xl border border-violet-200 dark:border-violet-800/70 bg-violet-50/30 dark:bg-[#1E1838]/60 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-violet-200 mb-1">
                    Password {tab === 'register' && <span className="text-slate-400 font-normal">(min 8 chars)</span>}
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-violet-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      minLength={tab === 'register' ? 8 : 1}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-3.5 py-2.5 text-sm rounded-xl border border-violet-200 dark:border-violet-800/70 bg-violet-50/30 dark:bg-[#1E1838]/60 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                </div>

                {tab === 'register' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-0.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-violet-200 mb-1">
                        University / School
                      </label>
                      <input
                        type="text"
                        value={university}
                        onChange={(e) => setUniversity(e.target.value)}
                        placeholder="Bridgewater State"
                        className="w-full px-3 py-2 text-sm rounded-xl border border-violet-200 dark:border-violet-800/70 bg-violet-50/30 dark:bg-[#1E1838]/60 focus:outline-none focus:ring-2 focus:ring-violet-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-violet-200 mb-1">
                        Major / Program
                      </label>
                      <input
                        type="text"
                        value={major}
                        onChange={(e) => setMajor(e.target.value)}
                        placeholder="Computer Science"
                        className="w-full px-3 py-2 text-sm rounded-xl border border-violet-200 dark:border-violet-800/70 bg-violet-50/30 dark:bg-[#1E1838]/60 focus:outline-none focus:ring-2 focus:ring-violet-500"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-violet-200 mb-1">
                        Academic Year
                      </label>
                      <input
                        type="text"
                        value={academicYear}
                        onChange={(e) => setAcademicYear(e.target.value)}
                        placeholder="Sophomore / Year 2"
                        className="w-full px-3 py-2 text-sm rounded-xl border border-violet-200 dark:border-violet-800/70 bg-violet-50/30 dark:bg-[#1E1838]/60 focus:outline-none focus:ring-2 focus:ring-violet-500"
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-violet-800 via-purple-700 to-blue-600 hover:brightness-110 disabled:opacity-60 text-white font-semibold text-sm shadow-md shadow-violet-700/25 flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  {submitting
                    ? 'Signing in...'
                    : tab === 'login'
                      ? 'Sign In to INKORA'
                      : 'Create Student Account'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              <div className="my-4 flex items-center gap-3">
                <div className="flex-1 h-px bg-violet-100 dark:bg-violet-900/60" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Instant Demo Access
                </span>
                <div className="flex-1 h-px bg-violet-100 dark:bg-violet-900/60" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={handleDemoStudent}
                  disabled={submitting}
                  className="py-2.5 px-3 rounded-xl border border-violet-200 dark:border-violet-800/70 bg-violet-50/80 dark:bg-violet-950/40 hover:bg-violet-100 text-violet-900 dark:text-violet-200 font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <GraduationCap className="w-4 h-4 text-violet-600 dark:text-violet-300" />
                  Demo Student
                </button>
                <button
                  type="button"
                  onClick={handleDemoAdmin}
                  disabled={submitting}
                  className="py-2.5 px-3 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/80 dark:bg-blue-950/30 hover:bg-blue-100 text-blue-900 dark:text-sky-200 font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-sky-300" />
                  Demo Admin
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Three Studios Showcase */}
      <section id="studios" className="max-w-7xl mx-auto px-4 sm:px-8 py-14">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-950 dark:text-white">
            Three Creative Studios. One Academic Flow.
          </h2>
          <p className="text-sm text-slate-600 dark:text-violet-200/75 mt-2">
            Switch between typing structured papers, annotating traditional notebook sheets, or
            sketching diagrams side-by-side.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-3xl bg-white dark:bg-[#151128] border border-violet-200/70 dark:border-violet-800/60 p-6 shadow-lg shadow-violet-950/5 hover:-translate-y-0.5 transition">
            <div className="w-11 h-11 rounded-2xl bg-violet-100 dark:bg-violet-900/60 text-violet-700 dark:text-violet-200 flex items-center justify-center mb-4">
              <BookOpen className="w-5 h-5" />
            </div>
            <h3 className="font-display font-bold text-lg text-slate-950 dark:text-white">
              Traditional & Cornell Notebooks
            </h3>
            <p className="text-sm text-slate-500 dark:text-violet-200/70 mt-2 leading-relaxed">
              Write on College-Ruled, Wide-Ruled, Dot Grid, Graph, or Cornell 3-zone lecture sheets
              with a live ink annotation layer directly on the paper.
            </p>
          </div>

          <div className="rounded-3xl bg-white dark:bg-[#151128] border border-violet-200/70 dark:border-violet-800/60 p-6 shadow-lg shadow-violet-950/5 hover:-translate-y-0.5 transition">
            <div className="w-11 h-11 rounded-2xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-sky-300 flex items-center justify-center mb-4">
              <PenTool className="w-5 h-5" />
            </div>
            <h3 className="font-display font-bold text-lg text-slate-950 dark:text-white">
              Digital Drawing Pad
            </h3>
            <p className="text-sm text-slate-500 dark:text-violet-200/70 mt-2 leading-relaxed">
              Sketch biology diagrams, circuit flows, and graphs with Ink Pen, Fountain Nib, Pencil,
              Highlighter, Shapes, Grid Snap, PNG/SVG export, and Split View.
            </p>
          </div>

          <div className="rounded-3xl bg-white dark:bg-[#151128] border border-violet-200/70 dark:border-violet-800/60 p-6 shadow-lg shadow-violet-950/5 hover:-translate-y-0.5 transition">
            <div className="w-11 h-11 rounded-2xl bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-200 flex items-center justify-center mb-4">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="font-display font-bold text-lg text-slate-950 dark:text-white">
              Word-Like Document Editor
            </h3>
            <p className="text-sm text-slate-500 dark:text-violet-200/70 mt-2 leading-relaxed">
              Multi-tab Ribbon toolbar with fonts, headings, checklists, resizable tables, KaTeX math
              equations, Find & Replace, version snapshots, and PDF/HTML/Markdown export.
            </p>
          </div>
        </div>
      </section>

      {/* Organization & Privacy Section */}
      <section id="organization" className="max-w-7xl mx-auto px-4 sm:px-8 pb-16">
        <div className="rounded-3xl bg-gradient-to-br from-[#2E1065] via-[#4C1D95] to-[#1D4ED8] text-white p-8 sm:p-12 shadow-2xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-xs font-semibold text-violet-100">
                <FolderKanban className="w-3.5 h-3.5" /> Organize · Search · Store
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold leading-tight">
                Built for Real Academic Work — With Strict Student Privacy
              </h2>
              <p className="text-sm sm:text-base text-violet-100/85 leading-relaxed">
                Group notes into Folders, Courses, and Notebooks. Retrieve anything instantly with
                full-text search, upload PDFs and reference files to your File Vault, and keep your
                work strictly private to your own account.
              </p>
            </div>

            <div id="privacy" className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {[
                { icon: <FolderKanban className="w-4 h-4 text-sky-300" />, title: 'Folders & Notebooks', desc: 'Organize notes across custom folders, courses, and tags.' },
                { icon: <Search className="w-4 h-4 text-violet-200" />, title: 'Instant Full-Text Search', desc: 'Find lecture formulas, keywords, and files in milliseconds.' },
                { icon: <UploadCloud className="w-4 h-4 text-sky-300" />, title: 'Personal File Vault', desc: 'Upload and download PDFs, images, and academic documents.' },
                { icon: <CheckCircle2 className="w-4 h-4 text-emerald-300" />, title: 'Private by Default', desc: 'Strict role-based isolation keeps student notes private—even from admins.' },
              ].map((item) => (
                <div key={item.title} className="rounded-2xl bg-white/10 border border-white/15 p-4 backdrop-blur-xs">
                  <div className="flex items-center gap-2 font-semibold text-sm">
                    {item.icon}
                    {item.title}
                  </div>
                  <p className="text-xs text-violet-100/75 mt-1.5 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-violet-200/70 dark:border-violet-900/50 py-6 px-4 sm:px-8 text-center text-xs text-slate-500 dark:text-violet-300/60">
        INKORA — "Your Thoughts. Your Space. Your Ink." · Role-Based Student Workspace & Admin Platform
      </footer>
    </div>
  );
};
