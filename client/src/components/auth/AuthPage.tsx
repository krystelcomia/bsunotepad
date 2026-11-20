import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Camera,
  CheckCircle2,
  FileText,
  FolderKanban,
  GraduationCap,
  KeyRound,
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
import { ApiError, api, EmailChallengeResponse } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { BrandLogo } from '../common/BrandLogo';

function isValidGmailFrontend(raw: string): boolean {
  const email = raw.trim().toLowerCase();
  const parts = email.split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (domain !== 'gmail.com') return false;
  if (!local || local.length < 3 || local.length > 64) return false;
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false;
  return /^[a-z0-9._+-]+$/.test(local);
}

type AuthPanelView = 'home' | 'login' | 'register' | 'verify' | 'forgot' | 'reset';

function authPathToView(pathname: string): AuthPanelView {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/login') return 'login';
  if (clean === '/register' || clean === '/signup') return 'register';
  if (clean === '/verify-email') return 'verify';
  if (clean === '/forgot-password') return 'forgot';
  if (clean === '/reset-password') return 'reset';
  return 'home';
}

function authViewToPath(view: AuthPanelView): string {
  switch (view) {
    case 'login':
      return '/login';
    case 'register':
      return '/register';
    case 'verify':
      return '/verify-email';
    case 'forgot':
      return '/forgot-password';
    case 'reset':
      return '/reset-password';
    default:
      return '/';
  }
}

export const AuthPage: React.FC = () => {
  const { login, register, verifyEmail, demoLogin } = useAuth();
  const { resolved, toggle: toggleTheme } = useTheme();

  const [view, setView] = useState<AuthPanelView>(() => authPathToView(window.location.pathname));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [university, setUniversity] = useState('');
  const [major, setMajor] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string>('');

  const [otp, setOtp] = useState('');
  const [urlToken, setUrlToken] = useState<string | null>(null);
  const [challengeInfo, setChallengeInfo] = useState<EmailChallengeResponse | null>(null);

  const [error, setError] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [lockedAccountStatus, setLockedAccountStatus] = useState<string | null>(null);
  const [appealMessage, setAppealMessage] = useState('');
  const [appealSent, setAppealSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const syncAuthRoute = (mode: AuthPanelView, replace = false) => {
    setView(mode);
    const targetPath = authViewToPath(mode);
    if (window.location.pathname !== targetPath) {
      if (replace) {
        window.history.replaceState({}, '', targetPath);
      } else {
        window.history.pushState({}, '', targetPath);
      }
    }
  };

  useEffect(() => {
    const onPop = () => {
      setView(authPathToView(window.location.pathname));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Handle verification or reset tokens in URL query (?verify_token=... or ?reset_token=...)
  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const verifyTok = qs.get('verify_token');
    const resetTok = qs.get('reset_token');

    if (verifyTok) {
      setSubmitting(true);
      verifyEmail({ token: verifyTok })
        .then((loggedUser) => {
          window.history.replaceState({}, '', loggedUser.role === 'admin' ? '/admin' : '/dashboard');
        })
        .catch((err) => {
          syncAuthRoute('verify', true);
          setError(err instanceof Error ? err.message : 'Hindi wasto o nag-expire na ang link ng beripikasyon.');
        })
        .finally(() => setSubmitting(false));
    } else if (resetTok) {
      setUrlToken(resetTok);
      syncAuthRoute('reset', true);
      setInfoMsg('Ilagay ang iyong bagong password sa ibaba upang makumpleto ang pag-reset ng password.');
    }
  }, [verifyEmail]);

  const focusAuth = (mode: AuthPanelView) => {
    syncAuthRoute(mode);
    setError('');
    setInfoMsg('');
    setLockedAccountStatus(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectAvatar = (file: File | null) => {
    if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    setAvatarFile(file);
    setAvatarPreviewUrl(file ? URL.createObjectURL(file) : '');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoMsg('');
    setLockedAccountStatus(null);
    setAppealSent(false);

    const normalized = email.trim().toLowerCase();
    if (!isValidGmailFrontend(normalized)) {
      setError('Mangyaring mag-sign in gamit ang wastong Gmail address na nagtatapos sa @gmail.com.');
      return;
    }

    setSubmitting(true);
    try {
      const loggedUser = await login(normalized, password);
      window.history.replaceState({}, '', loggedUser.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.emailVerificationRequired) {
          setEmail(err.email || normalized);
          syncAuthRoute('verify');
          setInfoMsg('Kailangang beripikahin muna ang iyong Gmail address bago makapasok sa workspace.');
          setError('');
          setSubmitting(false);
          return;
        }
        if (err.accountStatus) {
          setLockedAccountStatus(err.accountStatus);
        }
      }
      setError(err instanceof Error ? err.message : 'Nabigo ang pagpapatunay.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoMsg('');

    const normalized = email.trim().toLowerCase();
    if (fullName.trim().length < 2) {
      setError('Mangyaring ilagay ang iyong buong pangalan.');
      return;
    }
    if (!isValidGmailFrontend(normalized)) {
      setError('Ang pagpaparehistro ay tumatanggap LAMANG ng wastong Gmail address na nagtatapos sa @gmail.com.');
      return;
    }
    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError('Ang password ay dapat may hindi bababa sa 8 karakter at may titik at numero.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Hindi magkatugma ang Password at Kumpirmahin ang Password.');
      return;
    }

    setSubmitting(true);
    try {
      const challenge = await register({
        full_name: fullName.trim(),
        email: normalized,
        password,
        confirm_password: confirmPassword,
        university: university.trim(),
        major: major.trim(),
        avatar: avatarFile,
      });
      setEmail(normalized);
      setChallengeInfo(challenge);
      setOtp('');
      syncAuthRoute('verify');
      setInfoMsg(
        challenge.deliveryMode === 'smtp'
          ? `Nagpadala kami ng 6-digit na verification code at link sa ${normalized}.`
          : `Nagawa na ang verification code para sa ${normalized}. Tingnan ang preview box sa ibaba o ang iyong inbox.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nabigo ang pagpaparehistro.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const loggedUser = await verifyEmail({ email: email.trim().toLowerCase(), otp: otp.trim() });
      window.history.replaceState({}, '', loggedUser.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nabigo ang beripikasyon.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyLinkClick = async (previewLink: string) => {
    try {
      const url = new URL(previewLink);
      const token = url.searchParams.get('verify_token');
      if (!token) return;
      setSubmitting(true);
      const loggedUser = await verifyEmail({ token });
      window.history.replaceState({}, '', loggedUser.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nabigo ang beripikasyon gamit ang link.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    setError('');
    setSubmitting(true);
    try {
      const res = await api.resendVerification(email.trim().toLowerCase());
      setChallengeInfo(res);
      setInfoMsg(`Nagpadala ng bagong verification code sa ${res.email}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hindi maipadala muli ang code.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoMsg('');
    const normalized = email.trim().toLowerCase();
    if (!isValidGmailFrontend(normalized)) {
      setError('Mangyaring ilagay ang iyong beripikadong @gmail.com address.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.forgotPassword(normalized);
      setEmail(normalized);
      setChallengeInfo(res);
      setOtp('');
      setPassword('');
      setConfirmPassword('');
      setUrlToken(null);
      syncAuthRoute('reset');
      setInfoMsg(
        res.deliveryMode === 'smtp'
          ? `Nagpadala ng 6-digit password reset code at link sa ${normalized}.`
          : `Nagawa na ang password reset code para sa ${normalized}.`
      );
    } catch (err) {
      if (err instanceof ApiError && err.emailVerificationRequired) {
        syncAuthRoute('verify');
      }
      setError(err instanceof Error ? err.message : 'Hindi masimulan ang pag-reset ng password.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError('Ang password ay dapat may hindi bababa sa 8 karakter at may titik at numero.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Hindi magkatugma ang Password at Kumpirmahin ang Password.');
      return;
    }

    setSubmitting(true);
    try {
      await api.resetPassword(
        urlToken
          ? { token: urlToken, new_password: password, confirm_password: confirmPassword }
          : {
              email: email.trim().toLowerCase(),
              otp: otp.trim(),
              new_password: password,
              confirm_password: confirmPassword,
            }
      );
      setUrlToken(null);
      setChallengeInfo(null);
      setOtp('');
      setPassword('');
      setConfirmPassword('');
      syncAuthRoute('login');
      setInfoMsg('Tapos na ang pag-reset ng password! Mag-sign in gamit ang iyong bagong password.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nabigo ang pag-reset ng password.');
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
        email: email.trim().toLowerCase(),
        password,
        subject: `Kahilingan sa pagsusuri ng status ng account (${lockedAccountStatus || 'access'})`,
        message: appealMessage.trim(),
      });
      setAppealSent(true);
      setAppealMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hindi maipadala ang apela.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoStudent = async () => {
    setError('');
    setLockedAccountStatus(null);
    setSubmitting(true);
    try {
      const loggedUser = await demoLogin();
      window.history.replaceState({}, '', loggedUser.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nabigong pumasok sa demo workspace.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-white via-[#F4F8FF] to-[#EFF6FF] dark:from-[#071021] dark:via-[#0B172E] dark:to-[#0F1F3D] text-slate-900 dark:text-slate-100">
      {/* Tuktok na Navbar */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-white/90 dark:bg-[#091326]/90 border-b border-blue-200/70 dark:border-blue-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => focusAuth('home')}
            className="text-left cursor-pointer"
            aria-label="Home ng INKORA"
          >
            <BrandLogo size="md" />
          </button>

          {view === 'home' ? (
            <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600 dark:text-blue-100/80">
              <a href="#studios" className="hover:text-blue-700 dark:hover:text-sky-300 transition">
                Mga Tampok
              </a>
              <a href="#organization" className="hover:text-blue-700 dark:hover:text-sky-300 transition">
                Espasyo
              </a>
              <a href="#privacy" className="hover:text-blue-700 dark:hover:text-sky-300 transition">
                Pribasiya at Tungkulin
              </a>
            </nav>
          ) : (
            <button
              type="button"
              onClick={() => focusAuth('home')}
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-blue-200/80 hover:text-blue-700 dark:hover:text-sky-300 transition cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Bumalik sa Tahanan
            </button>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-xl border border-blue-200/80 dark:border-blue-800/60 bg-white dark:bg-[#0D1930] text-slate-600 dark:text-blue-200 hover:border-blue-400 transition cursor-pointer"
              aria-label="Magpalit ng tema"
            >
              {resolved === 'dark' ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-blue-700" />}
            </button>
            <button
              type="button"
              onClick={() => focusAuth('login')}
              className={`px-3.5 sm:px-4 py-2 rounded-xl text-sm font-semibold transition cursor-pointer ${
                view === 'login'
                  ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-900 dark:text-white'
                  : 'text-blue-800 dark:text-blue-200 hover:bg-blue-50 dark:hover:bg-blue-900/40'
              }`}
            >
              Mag-sign In
            </button>
            <button
              type="button"
              onClick={() => focusAuth('register')}
              className="px-3.5 sm:px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-800 via-blue-700 to-sky-600 hover:brightness-110 shadow-md shadow-blue-700/20 transition cursor-pointer"
            >
              Magsimula
            </button>
          </div>
        </div>
      </header>

      {view === 'home' ? (
        <>
          {/* Pangunahing Bahagi (Home Hero — Walang Login Form) */}
          <section className="relative overflow-hidden">
            <div
              className="absolute inset-0 pointer-events-none opacity-45 dark:opacity-20"
              style={{
                backgroundImage: 'radial-gradient(rgba(37, 99, 235, 0.16) 1px, transparent 1px)',
                backgroundSize: '24px 24px',
              }}
            />
            <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-blue-400/20 blur-3xl pointer-events-none" />
            <div className="absolute top-20 right-0 w-96 h-96 rounded-full bg-sky-400/20 blur-3xl pointer-events-none" />

            <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-8 pt-14 pb-16 lg:py-20">
              <div className="text-center max-w-3xl mx-auto space-y-6">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/95 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800/70 text-xs font-semibold text-blue-800 dark:text-blue-200 shadow-xs">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-sky-400" />
                  Personal na Talaan ng Mag-aaral · Ligtas na Gmail Authentication
                </div>

                <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.06] text-slate-950 dark:text-white">
                  Iyong mga Ideya.{' '}
                  <span className="bg-gradient-to-r from-blue-800 via-blue-600 to-sky-500 dark:from-blue-300 dark:via-sky-300 dark:to-cyan-200 bg-clip-text text-transparent">
                    Iyong Espasyo.
                  </span>{' '}
                  <br />
                  Iyong Tinta.
                </h1>

                <p className="text-base sm:text-lg text-slate-600 dark:text-blue-100/80 max-w-2xl mx-auto leading-relaxed">
                  Ang INKORA ay iyong sariling personal na kuwaderno at talaan. Lahat ng kagamitan ay pinagsama sa
                  iisang dokumento—magsulat nang may format na parang Word, magsingit ng larawan, gumuhit gamit ang
                  iba&apos;t ibang lapis at panulat, at i-download ang iyong file anumang oras.
                </p>

                {error && (
                  <div className="max-w-md mx-auto px-4 py-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-200 text-xs font-medium">
                    {error}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={handleDemoStudent}
                    disabled={submitting}
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-blue-800 via-blue-700 to-sky-600 hover:brightness-110 text-white text-sm font-bold shadow-lg shadow-blue-800/25 transition cursor-pointer"
                  >
                    <GraduationCap className="w-4 h-4" />
                    {submitting ? 'Binubuksan ang Demo...' : 'Subukan ang Demo ng Mag-aaral'}
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => focusAuth('register')}
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white/95 dark:bg-[#0D1930] border border-blue-200 dark:border-blue-800/80 text-blue-900 dark:text-blue-200 text-sm font-semibold hover:border-blue-400 transition cursor-pointer"
                  >
                    Gumawa ng Libreng Account
                  </button>
                </div>
              </div>

              {/* Malikhaing Studio Preview */}
              <div className="mt-12 max-w-5xl mx-auto">
                <div className="rounded-3xl bg-white/95 dark:bg-[#0D1930]/95 border border-blue-200/80 dark:border-blue-800/70 shadow-2xl shadow-blue-950/10 p-4 sm:p-6 backdrop-blur-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-100 dark:border-blue-900/60 pb-3 mb-5">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-300" />
                      <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                      <span className="ml-2 text-xs font-semibold text-slate-500 dark:text-blue-200/70">
                        Personal na Tala · Pinagsamang Dokumento
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] font-semibold">
                      <span className="px-2.5 py-1 rounded-lg bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200">
                        Teksto
                      </span>
                      <span className="px-2.5 py-1 rounded-lg text-slate-400">Larawan</span>
                      <span className="px-2.5 py-1 rounded-lg text-slate-400">Guhit / Doodle</span>
                      <span className="px-2.5 py-1 rounded-lg text-slate-400">I-download</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-white dark:from-[#132340] dark:to-[#0D1930] border border-blue-100 dark:border-blue-800/50 p-4 space-y-2">
                      <div className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-sky-300">
                        Teksto at Larawan
                      </div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white">
                        Pag-format na Parang Word
                      </div>
                      <p className="text-xs text-slate-500 dark:text-blue-200/75 leading-relaxed">
                        Bold, italic, pamagat, listahan, talahanayan, at pagsingit ng larawan sa loob ng iisang pahina.
                      </p>
                    </div>

                    <div className="rounded-2xl bg-gradient-to-br from-sky-50 to-white dark:from-[#10254A] dark:to-[#0D1930] border border-blue-100 dark:border-blue-900/50 p-4 flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-sky-300">
                          Guhit / Doodle Tool
                        </span>
                        <PenTool className="w-4 h-4 text-blue-600 dark:text-sky-300" />
                      </div>
                      <svg viewBox="0 0 220 72" className="w-full h-16 mt-2">
                        <ellipse cx="75" cy="36" rx="46" ry="24" stroke="#1D4ED8" strokeWidth="2.4" fill="rgba(59,130,246,0.14)" />
                        <circle cx="75" cy="36" r="10" stroke="#0284C7" strokeWidth="2.2" fill="rgba(96,165,250,0.24)" />
                        <path d="M126 36H170M162 29L170 36L162 43" stroke="#1E40AF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                        <rect x="176" y="20" width="32" height="32" rx="8" stroke="#3B82F6" strokeWidth="2.2" fill="rgba(59,130,246,0.12)" />
                      </svg>
                    </div>

                    <div className="rounded-2xl bg-gradient-to-br from-blue-50/70 to-white dark:from-[#132340] dark:to-[#0D1930] border border-blue-100 dark:border-blue-800/50 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-sky-300">
                          Instant na Pag-download
                        </span>
                        <FolderKanban className="w-4 h-4 text-blue-600 dark:text-sky-300" />
                      </div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white">
                        Word, PDF, HTML at Teksto
                      </div>
                      <p className="text-xs text-slate-500 dark:text-blue-200/75 leading-relaxed">
                        I-download agad ang iyong mga personal na tala kasama ang mga larawan at guhit sa isang pindot.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Pinagsamang mga Tampok sa Iisang Tala */}
          <section id="studios" className="max-w-7xl mx-auto px-4 sm:px-8 py-14">
            <div className="text-center max-w-2xl mx-auto mb-10">
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-950 dark:text-white">
                Lahat ng Kailangan Mo sa Iisang Personal na Dokumento.
              </h2>
              <p className="text-sm text-slate-600 dark:text-blue-200/75 mt-2">
                Walang nakakalitong palipat-lipat ng pahina—pagkagawa mo ng bagong tala, handa na agad ang lahat ng
                kagamitan sa pagsusulat, larawan, pagguhit, at pag-download.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="rounded-3xl bg-white dark:bg-[#0D1930] border border-blue-200/70 dark:border-blue-800/60 p-6 shadow-lg shadow-blue-950/5 hover:-translate-y-0.5 transition">
                <div className="w-11 h-11 rounded-2xl bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-200 flex items-center justify-center mb-4">
                  <FileText className="w-5 h-5" />
                </div>
                <h3 className="font-display font-bold text-lg text-slate-950 dark:text-white">
                  Pag-format ng Teksto at Larawan
                </h3>
                <p className="text-sm text-slate-500 dark:text-blue-200/70 mt-2 leading-relaxed">
                  Gumamit ng Bold, Italic, Salungguhit, mga Pamagat, Font, Checklist, Talahanayan, at magsingit ng
                  larawan direkta sa iyong personal na tala.
                </p>
              </div>

              <div className="rounded-3xl bg-white dark:bg-[#0D1930] border border-blue-200/70 dark:border-blue-800/60 p-6 shadow-lg shadow-blue-950/5 hover:-translate-y-0.5 transition">
                <div className="w-11 h-11 rounded-2xl bg-sky-100 dark:bg-sky-900/50 text-blue-600 dark:text-sky-300 flex items-center justify-center mb-4">
                  <PenTool className="w-5 h-5" />
                </div>
                <h3 className="font-display font-bold text-lg text-slate-950 dark:text-white">
                  Doodle Tool na May Iba&apos;t Ibang Lapis
                </h3>
                <p className="text-sm text-slate-500 dark:text-blue-200/70 mt-2 leading-relaxed">
                  Gumuhit direkta sa pahina o sa katabing panel gamit ang Ballpen, Lapis, Fountain Pen, Marker,
                  Highlighter, Pambura, mga hugis, at kulay.
                </p>
              </div>

              <div className="rounded-3xl bg-white dark:bg-[#0D1930] border border-blue-200/70 dark:border-blue-800/60 p-6 shadow-lg shadow-blue-950/5 hover:-translate-y-0.5 transition">
                <div className="w-11 h-11 rounded-2xl bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 flex items-center justify-center mb-4">
                  <BookOpen className="w-5 h-5" />
                </div>
                <h3 className="font-display font-bold text-lg text-slate-950 dark:text-white">
                  Pribadong Talaan at Madaling Pag-download
                </h3>
                <p className="text-sm text-slate-500 dark:text-blue-200/70 mt-2 leading-relaxed">
                  Isaayos ang iyong mga tala sa mga Folder at Kuwaderno, hanapin nang mabilis, at i-download bilang
                  Word (.doc), PDF, HTML, Markdown, o Teksto.
                </p>
              </div>
            </div>
          </section>

          {/* Seksyon ng Organisasyon at Pribasiya */}
          <section id="organization" className="max-w-7xl mx-auto px-4 sm:px-8 pb-16">
            <div className="rounded-3xl bg-gradient-to-br from-[#0F275C] via-[#1D4ED8] to-[#0284C7] text-white p-8 sm:p-12 shadow-2xl">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-xs font-semibold text-blue-100">
                    <FolderKanban className="w-3.5 h-3.5" /> Ayusin · Beripikahin · Protektahan
                  </div>
                  <h2 className="font-display text-2xl sm:text-3xl font-extrabold leading-tight">
                    Beripikadong Access sa Gmail at Mahigpit na Pribasiya ng Mag-aaral
                  </h2>
                  <p className="text-sm sm:text-base text-blue-100/90 leading-relaxed">
                    Bawat account ng mag-aaral ay nangangailangan ng natatangi at beripikadong Gmail
                    address. Pangkatin ang iyong mga personal na tala sa mga Folder at Kuwaderno, hanapin ang
                    anumang tala agad, at panatilihing ganap na pribado ang iyong mga gawa.
                  </p>
                </div>

                <div id="privacy" className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {[
                    { icon: <ShieldCheck className="w-4 h-4 text-sky-200" />, title: 'Beripikadong Gmail Lamang', desc: 'Isang natatanging account bawat beripikadong @gmail.com gamit ang OTP at link.' },
                    { icon: <FolderKanban className="w-4 h-4 text-blue-100" />, title: 'Mga Folder at Kuwaderno', desc: 'Ayusin ang iyong mga personal na tala sa sariling mga folder, kuwaderno, at tag.' },
                    { icon: <Search className="w-4 h-4 text-sky-200" />, title: 'Agarang Buong-Tekstong Paghahanap', desc: 'Hanapin ang mga pormula, salita, at file sa loob lamang ng ilang milisegundo.' },
                    { icon: <UploadCloud className="w-4 h-4 text-white" />, title: 'Pribadong Baul ng File', desc: 'Tinitiyak ng mahigpit na kontrol na pribado ang mga tala—maging sa mga admin.' },
                    { icon: <CheckCircle2 className="w-4 h-4 text-white" />, title: 'Ligtas na mga Session', desc: 'Tuloy-tuloy na HttpOnly session na may awtomatikong pag-ikot ng refresh token.' },
                  ].slice(0, 4).map((item) => (
                    <div key={item.title} className="rounded-2xl bg-white/10 border border-white/15 p-4 backdrop-blur-xs">
                      <div className="flex items-center gap-2 font-semibold text-sm">
                        {item.icon}
                        {item.title}
                      </div>
                      <p className="text-xs text-blue-100/80 mt-1.5 leading-relaxed">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </>
      ) : (
        /* Nakahiwalay na Pahina ng Pag-sign In / Pagpaparehistro */
        <main className="relative flex-1 flex items-center justify-center px-4 sm:px-8 py-10 sm:py-14 overflow-hidden">
          <div
            className="absolute inset-0 pointer-events-none opacity-45 dark:opacity-20"
            style={{
              backgroundImage: 'radial-gradient(rgba(37, 99, 235, 0.16) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />
          <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-blue-400/20 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-sky-400/20 blur-3xl pointer-events-none" />

          {/* Interaktibong Auth Card */}
          <div id="inkora-auth-card" className="relative z-10 w-full max-w-md space-y-4">
            <button
              type="button"
              onClick={() => focusAuth('home')}
              className="sm:hidden inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-blue-200/80 hover:text-blue-700 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Bumalik sa Tahanan
            </button>

            <div className="bg-white/95 dark:bg-[#0D1930]/95 backdrop-blur-md rounded-3xl border border-blue-200/80 dark:border-blue-800/70 shadow-2xl shadow-blue-950/15 p-6 sm:p-8">
              {(view === 'login' || view === 'register') && (
                <>
                  <div className="mb-5">
                    <h2 className="font-display text-xl font-extrabold text-slate-950 dark:text-white">
                      {view === 'login' ? 'Maligayang Pagbabalik' : 'Gumawa ng Account ng Mag-aaral'}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-blue-200/70 mt-0.5">
                      {view === 'login'
                        ? 'Mag-sign in gamit ang iyong Gmail at password (awtomatikong matutukoy ang tungkulin).'
                        : 'Magrehistro gamit ang beripikadong @gmail.com address (isang account bawat Gmail).'}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 p-1 rounded-2xl bg-blue-50 dark:bg-[#132340] mb-5">
                    <button
                      type="button"
                      onClick={() => focusAuth('login')}
                      className={`py-2 text-sm font-semibold rounded-xl transition cursor-pointer ${
                        view === 'login'
                          ? 'bg-white dark:bg-[#1D355E] text-blue-900 dark:text-white shadow-xs'
                          : 'text-slate-500 dark:text-blue-200/70 hover:text-blue-800'
                      }`}
                    >
                      Mag-sign In
                    </button>
                    <button
                      type="button"
                      onClick={() => focusAuth('register')}
                      className={`py-2 text-sm font-semibold rounded-xl transition cursor-pointer ${
                        view === 'register'
                          ? 'bg-white dark:bg-[#1D355E] text-blue-900 dark:text-white shadow-xs'
                          : 'text-slate-500 dark:text-blue-200/70 hover:text-blue-800'
                      }`}
                    >
                      Gumawa ng Account
                    </button>
                  </div>
                </>
              )}

              {infoMsg && (
                <div className="mb-4 px-3.5 py-2.5 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200 text-xs font-medium">
                  {infoMsg}
                </div>
              )}

              {error && (
                <div className="mb-4 px-3.5 py-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-200 text-xs font-medium space-y-2">
                  <div>{error}</div>
                  {lockedAccountStatus && !appealSent && (
                    <form onSubmit={handleSendAppeal} className="pt-2 border-t border-rose-200/80 space-y-2">
                      <div className="font-semibold text-[11px]">
                        Kailangan ng tulong? Magpadala ng kahilingan sa pagsusuri sa Administrator:
                      </div>
                      <textarea
                        rows={2}
                        required
                        value={appealMessage}
                        onChange={(e) => setAppealMessage(e.target.value)}
                        placeholder="Ipaliwanag ang iyong alalahanin..."
                        className="w-full px-2.5 py-1.5 rounded-xl border border-rose-200 bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-xs"
                      />
                      <button
                        type="submit"
                        disabled={submitting}
                        className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-[11px] font-semibold cursor-pointer"
                      >
                        Ipadala ang Alalahanin sa Account
                      </button>
                    </form>
                  )}
                  {appealSent && (
                    <div className="text-emerald-700 dark:text-emerald-300 font-semibold">
                      Naipadala na sa pangkat ng Admin ang iyong alalahanin sa account.
                    </div>
                  )}
                </div>
              )}

              {/* PORMA SA PAG-LOGIN */}
              {view === 'login' && (
                <form onSubmit={handleLogin} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-blue-200 mb-1">
                      Gmail Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-blue-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="pangalan@gmail.com"
                        className="w-full pl-9 pr-3.5 py-2.5 text-sm rounded-xl border border-blue-200 dark:border-blue-800/70 bg-blue-50/30 dark:bg-[#132340]/70 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-blue-200">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => focusAuth('forgot')}
                        className="text-xs font-semibold text-blue-700 dark:text-sky-300 hover:underline cursor-pointer"
                      >
                        Nakalimutan ang Password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-blue-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-9 pr-3.5 py-2.5 text-sm rounded-xl border border-blue-200 dark:border-blue-800/70 bg-blue-50/30 dark:bg-[#132340]/70 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-800 via-blue-700 to-sky-600 hover:brightness-110 disabled:opacity-60 text-white font-semibold text-sm shadow-md shadow-blue-700/25 flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    {submitting ? 'Pumapasok...' : 'Mag-sign In gamit ang Gmail'}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              )}

              {/* PORMA SA PAGPAPAREHISTRO */}
              {view === 'register' && (
                <form onSubmit={handleRegister} className="space-y-3">
                  {/* Opsyonal na Larawan sa Profile */}
                  <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-blue-50/80 dark:bg-[#132340]/70 border border-blue-200/70 dark:border-blue-800/60">
                    {avatarPreviewUrl ? (
                      <img
                        src={avatarPreviewUrl}
                        alt="Preview ng larawan sa profile"
                        className="w-11 h-11 rounded-xl object-cover ring-2 ring-blue-400/40 shrink-0"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-xl bg-blue-200/70 dark:bg-blue-900/60 text-blue-700 dark:text-blue-200 flex items-center justify-center shrink-0">
                        <UserIcon className="w-5 h-5" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-slate-800 dark:text-white">
                        Larawan sa Profile <span className="text-slate-400 font-normal">(Opsyonal)</span>
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {avatarFile ? avatarFile.name : 'PNG, JPG, WEBP, o GIF'}
                      </div>
                    </div>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="hidden"
                      onChange={(e) => handleSelectAvatar(e.target.files?.[0] || null)}
                    />
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-700 text-xs font-semibold text-blue-800 dark:text-blue-200 cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" /> {avatarFile ? 'Palitan' : 'I-upload'}
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-blue-200 mb-1">
                      Buong Pangalan *
                    </label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 text-blue-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Juan Dela Cruz"
                        className="w-full pl-9 pr-3.5 py-2 text-sm rounded-xl border border-blue-200 dark:border-blue-800/70 bg-blue-50/30 dark:bg-[#132340]/70 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-blue-200 mb-1">
                      Gmail Address * <span className="text-[11px] text-slate-400 font-normal">(@gmail.com lamang)</span>
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-blue-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="pangalan@gmail.com"
                        className="w-full pl-9 pr-3.5 py-2 text-sm rounded-xl border border-blue-200 dark:border-blue-800/70 bg-blue-50/30 dark:bg-[#132340]/70 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-blue-200 mb-1">
                        Password *
                      </label>
                      <input
                        type="password"
                        required
                        minLength={8}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Hindi bababa sa 8 karakter"
                        className="w-full px-3 py-2 text-sm rounded-xl border border-blue-200 dark:border-blue-800/70 bg-blue-50/30 dark:bg-[#132340]/70 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-blue-200 mb-1">
                        Kumpirmahin ang Password *
                      </label>
                      <input
                        type="password"
                        required
                        minLength={8}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Ulitin ang password"
                        className="w-full px-3 py-2 text-sm rounded-xl border border-blue-200 dark:border-blue-800/70 bg-blue-50/30 dark:bg-[#132340]/70 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      value={university}
                      onChange={(e) => setUniversity(e.target.value)}
                      placeholder="Unibersidad (opsiyonal)"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-blue-200 dark:border-blue-800/70 bg-blue-50/30 dark:bg-[#132340]/70"
                    />
                    <input
                      type="text"
                      value={major}
                      onChange={(e) => setMajor(e.target.value)}
                      placeholder="Kurso (opsiyonal)"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-blue-200 dark:border-blue-800/70 bg-blue-50/30 dark:bg-[#132340]/70"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-800 via-blue-700 to-sky-600 hover:brightness-110 disabled:opacity-60 text-white font-semibold text-sm shadow-md shadow-blue-700/25 flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    {submitting ? 'Ginagawa ang Account...' : 'Magrehistro at Ipadala ang Code'}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              )}

              {/* BERIPIKASYON NG EMAIL (OTP + LINK) */}
              {view === 'verify' && (
                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={() => focusAuth('login')}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-blue-700 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Bumalik sa Mag-sign In
                  </button>

                  <div>
                    <h2 className="font-display text-lg font-extrabold">Beripikahin ang Iyong Gmail</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Ilagay ang 6-digit na verification code na ipinadala sa <strong>{email}</strong>.
                    </p>
                  </div>

                  {challengeInfo?.previewOtp && (
                    <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-xs space-y-2">
                      <div className="font-bold text-blue-800 dark:text-sky-300">
                        Preview ng Email sa Beripikasyon (Walang Nakatakdang SMTP)
                      </div>
                      <div>
                        6-Digit na Code:{' '}
                        <span className="font-mono font-extrabold text-sm text-blue-800 dark:text-blue-200">
                          {challengeInfo.previewOtp}
                        </span>
                      </div>
                      {challengeInfo.previewLink && (
                        <button
                          type="button"
                          onClick={() => handleVerifyLinkClick(challengeInfo.previewLink!)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 text-white text-[11px] font-semibold cursor-pointer"
                        >
                          Pindutin Direktang Link ng Beripikasyon
                        </button>
                      )}
                    </div>
                  )}

                  <form onSubmit={handleVerifyOtp} className="space-y-3">
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="Ilagay ang 6-digit OTP"
                      className="w-full px-4 py-3 text-center font-mono text-lg tracking-[0.4em] rounded-xl border border-blue-200 dark:border-blue-700 bg-blue-50/40 dark:bg-[#132340]"
                    />
                    <button
                      type="submit"
                      disabled={submitting || otp.length !== 6}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-800 to-sky-600 text-white text-sm font-semibold disabled:opacity-50 cursor-pointer"
                    >
                      {submitting ? 'Bineberipika...' : 'Beripikahin at Buksan ang Workspace'}
                    </button>
                  </form>

                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={submitting}
                    className="w-full text-center text-xs font-semibold text-blue-700 dark:text-sky-300 hover:underline cursor-pointer"
                  >
                    Hindi natanggap ang code? Ipadala muli ang verification email
                  </button>
                </div>
              )}

              {/* NAKALIMUTAN ANG PASSWORD */}
              {view === 'forgot' && (
                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={() => focusAuth('login')}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-blue-700 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Bumalik sa Mag-sign In
                  </button>
                  <div>
                    <h2 className="font-display text-lg font-extrabold flex items-center gap-2">
                      <KeyRound className="w-4 h-4 text-blue-600" /> Nakalimutan ang Password
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Ilagay ang iyong beripikadong @gmail.com address upang makatanggap ng code at link sa pag-reset ng password.
                    </p>
                  </div>
                  <form onSubmit={handleForgotPassword} className="space-y-3">
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="pangalan@gmail.com"
                      className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-blue-200 dark:border-blue-700 bg-blue-50/30 dark:bg-[#132340]"
                    />
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-800 to-sky-600 text-white text-sm font-semibold cursor-pointer"
                    >
                      {submitting ? 'Ipinapadala...' : 'Ipadala ang Reset Code'}
                    </button>
                  </form>
                </div>
              )}

              {/* PAG-RESET NG PASSWORD */}
              {view === 'reset' && (
                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={() => focusAuth('login')}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-blue-700 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Bumalik sa Mag-sign In
                  </button>
                  <div>
                    <h2 className="font-display text-lg font-extrabold">I-reset ang Password</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Magtakda ng matibay na bagong password para sa iyong beripikadong Gmail account.
                    </p>
                  </div>

                  {challengeInfo?.previewOtp && !urlToken && (
                    <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-xs">
                      Preview ng Reset OTP:{' '}
                      <span className="font-mono font-extrabold text-blue-800 dark:text-blue-200">
                        {challengeInfo.previewOtp}
                      </span>
                    </div>
                  )}

                  <form onSubmit={handleResetPassword} className="space-y-3">
                    {!urlToken && (
                      <input
                        type="text"
                        required
                        maxLength={6}
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="6-digit na Reset Code"
                        className="w-full px-3.5 py-2.5 text-sm font-mono rounded-xl border border-blue-200 dark:border-blue-700 bg-blue-50/30 dark:bg-[#132340]"
                      />
                    )}
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Bagong Password (min 8 karakter + numero)"
                      className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-blue-200 dark:border-blue-700 bg-blue-50/30 dark:bg-[#132340]"
                    />
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Kumpirmahin ang Bagong Password"
                      className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-blue-200 dark:border-blue-700 bg-blue-50/30 dark:bg-[#132340]"
                    />
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-800 to-sky-600 text-white text-sm font-semibold cursor-pointer"
                    >
                      {submitting ? 'Ina-update...' : 'I-save ang Bagong Password'}
                    </button>
                  </form>
                </div>
              )}

              <div className="my-4 flex items-center gap-3">
                <div className="flex-1 h-px bg-blue-100 dark:bg-blue-900/60" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Suriin ang Demo ng Mag-aaral
                </span>
                <div className="flex-1 h-px bg-blue-100 dark:bg-blue-900/60" />
              </div>

              <button
                type="button"
                onClick={handleDemoStudent}
                disabled={submitting}
                className="w-full py-2.5 px-3 rounded-xl border border-blue-200 dark:border-blue-800/70 bg-blue-50/80 dark:bg-blue-950/40 hover:bg-blue-100 text-blue-900 dark:text-blue-200 font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <GraduationCap className="w-4 h-4 text-blue-600 dark:text-sky-300" />
                Subukan ang Demo Workspace (Alex Rivera)
              </button>
            </div>
          </div>
        </main>
      )}

      <footer className="border-t border-blue-200/70 dark:border-blue-900/50 py-6 px-4 sm:px-8 text-center text-xs text-slate-500 dark:text-blue-200/60">
        INKORA — &quot;Iyong mga Ideya. Iyong Espasyo. Iyong Tinta.&quot; · Beripikadong Espasyo ng Mag-aaral at Platform ng Admin
      </footer>
    </div>
  );
};
