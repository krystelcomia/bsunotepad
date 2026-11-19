import React from 'react';

export const BrandLogo: React.FC<{ compact?: boolean; size?: 'sm' | 'md' | 'lg' }> = ({
  compact = false,
  size = 'md',
}) => {
  const dim = size === 'sm' ? 'w-7 h-7' : size === 'lg' ? 'w-11 h-11' : 'w-9 h-9';
  return (
    <div className="inline-flex items-center gap-2.5 select-none">
      <div
        className={`${dim} rounded-xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 flex items-center justify-center shadow-md shadow-indigo-600/20 ring-1 ring-white/20`}
      >
        <svg viewBox="0 0 32 32" fill="none" className="w-[62%] h-[62%]">
          <path
            d="M8 5.5H21.5C23.433 5.5 25 7.067 25 9V23C25 24.933 23.433 26.5 21.5 26.5H8V5.5Z"
            stroke="white"
            strokeWidth="2.1"
            strokeLinejoin="round"
          />
          <path d="M12.5 5.5V26.5" stroke="rgba(255,255,255,0.45)" strokeWidth="1.7" />
          <path
            d="M16.2 18.8L21.8 11.4C22.2 10.9 21.8 10.2 21.2 10.4L15.4 12.6L16.2 18.8Z"
            fill="#FBBF24"
          />
          <circle cx="19" cy="14" r="1.1" fill="#312E81" />
        </svg>
      </div>
      {!compact && (
        <div className="leading-none">
          <div className="font-display font-extrabold tracking-tight text-lg text-slate-900 dark:text-white flex items-center gap-1.5">
            INKORA
            <span className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-700 dark:text-amber-300">
              Studio
            </span>
          </div>
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
            Smart Student Workspace
          </div>
        </div>
      )}
    </div>
  );
};
