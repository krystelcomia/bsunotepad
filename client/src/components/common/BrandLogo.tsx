import React from 'react';

interface BrandLogoProps {
  compact?: boolean;
  variant?: 'full' | 'icon';
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
  badge?: string;
}

export const InkoraMark: React.FC<{ className?: string }> = ({ className = 'w-9 h-9' }) => (
  <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
    <defs>
      <linearGradient id="inkora-logo-bg" x1="4" y1="4" x2="60" y2="60" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#1E3A8A" />
        <stop offset="55%" stopColor="#2563EB" />
        <stop offset="100%" stopColor="#60A5FA" />
      </linearGradient>
      <linearGradient id="inkora-logo-pen" x1="34" y1="12" x2="50" y2="42" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="100%" stopColor="#93C5FD" />
      </linearGradient>
    </defs>
    <rect x="2" y="2" width="60" height="60" rx="16" fill="url(#inkora-logo-bg)" />
    {/* Open Notebook */}
    <path
      d="M13 20C13 17.8 14.8 16 17 16H30C31.1 16 32 16.9 32 18V47C30.2 45.4 27.6 44.5 24.5 44.5H15.5C14.1 44.5 13 43.4 13 42V20Z"
      stroke="white"
      strokeWidth="2.4"
      strokeLinejoin="round"
      fill="rgba(255,255,255,0.12)"
    />
    <path
      d="M51 24V42C51 43.4 49.9 44.5 48.5 44.5H39.5C36.4 44.5 33.8 45.4 32 47V18C32 16.9 32.9 16 34 16H41"
      stroke="white"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="rgba(255,255,255,0.08)"
    />
    {/* Notebook Lines */}
    <path d="M18 24H27M18 30H27M18 36H25" stroke="#DBEAFE" strokeWidth="2" strokeLinecap="round" opacity="0.92" />
    {/* Writing Pen / Digital Stylus */}
    <path
      d="M37 35L49 15C50 13.5 52.2 13.8 52.8 15.4C53.2 16.5 53 17.8 52.2 18.8L41.5 37.2L35.5 39.5L37 35Z"
      fill="url(#inkora-logo-pen)"
      stroke="white"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    {/* Digital Node & Spark */}
    <circle cx="35.5" cy="39.5" r="2.2" fill="#FFFFFF" />
    <path
      d="M44 13L45.2 10.5L46.4 13L49 14.2L46.4 15.4L45.2 18L44 15.4L41.5 14.2L44 13Z"
      fill="#EFF6FF"
    />
  </svg>
);

export const BrandLogo: React.FC<BrandLogoProps> = ({
  compact = false,
  variant = 'full',
  size = 'md',
  showTagline = true,
  badge,
}) => {
  const iconOnly = compact || variant === 'icon';
  const dim = size === 'sm' ? 'w-8 h-8' : size === 'lg' ? 'w-12 h-12' : 'w-9 h-9';

  return (
    <div className="inline-flex items-center gap-2.5 select-none">
      <div className="rounded-2xl shadow-md shadow-blue-900/20 ring-1 ring-blue-300/40 shrink-0">
        <InkoraMark className={dim} />
      </div>
      {!iconOnly && (
        <div className="leading-none">
          <div className="font-display font-extrabold tracking-tight text-lg text-slate-900 dark:text-white flex items-center gap-1.5">
            <span className="bg-gradient-to-r from-blue-900 via-blue-700 to-sky-500 dark:from-white dark:via-blue-200 dark:to-sky-300 bg-clip-text text-transparent">
              INKORA
            </span>
            {badge && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200">
                {badge}
              </span>
            )}
          </div>
          {showTagline && (
            <div className="text-[11px] font-medium text-slate-500 dark:text-blue-200/80 mt-0.5">
              Iyong mga Ideya. Iyong Espasyo. Iyong Tinta.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
