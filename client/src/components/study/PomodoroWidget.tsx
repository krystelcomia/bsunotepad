import React, { useEffect, useState } from 'react';
import { Coffee, Pause, Play, RotateCcw, Timer } from 'lucide-react';
import { api } from '../../api/client';

interface PomodoroWidgetProps {
  activeSubjectId?: string | null;
  activeNoteId?: string | null;
  onSessionLogged?: () => void;
  onNotify?: (type: 'success' | 'error' | 'info', text: string) => void;
}

export const PomodoroWidget: React.FC<PomodoroWidgetProps> = ({
  activeSubjectId,
  activeNoteId,
  onSessionLogged,
  onNotify,
}) => {
  const [mode, setMode] = useState<'focus' | 'break'>('focus');
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setRunning(false);
          const mins = mode === 'focus' ? 25 : 5;
          api
            .logStudySession(mins, mode, {
              subjectId: activeSubjectId,
              noteId: activeNoteId,
            })
            .then(() => {
              onSessionLogged?.();
              onNotify?.('success', `Logged ${mins}-minute ${mode} session!`);
            })
            .catch(() => {});
          const nextMode = mode === 'focus' ? 'break' : 'focus';
          setMode(nextMode);
          return nextMode === 'focus' ? 25 * 60 : 5 * 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running, mode, activeSubjectId, activeNoteId, onSessionLogged, onNotify]);

  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const secs = String(secondsLeft % 60).padStart(2, '0');

  const switchMode = (next: 'focus' | 'break') => {
    setRunning(false);
    setMode(next);
    setSecondsLeft(next === 'focus' ? 25 * 60 : 5 * 60);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
          running
            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-stone-200 dark:border-slate-700 hover:bg-stone-50 dark:hover:bg-slate-700/70'
        }`}
        title="Study Focus Timer"
      >
        {mode === 'focus' ? <Timer className="w-3.5 h-3.5" /> : <Coffee className="w-3.5 h-3.5" />}
        <span className="font-mono tabular-nums">
          {mins}:{secs}
        </span>
      </button>

      {expanded && (
        <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-700 shadow-xl p-4 z-40">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Study Timer
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => switchMode('focus')}
                className={`px-2 py-0.5 text-[11px] font-semibold rounded-md ${
                  mode === 'focus'
                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-200'
                    : 'text-slate-500 hover:bg-stone-100 dark:hover:bg-slate-800'
                }`}
              >
                Focus 25m
              </button>
              <button
                type="button"
                onClick={() => switchMode('break')}
                className={`px-2 py-0.5 text-[11px] font-semibold rounded-md ${
                  mode === 'break'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-200'
                    : 'text-slate-500 hover:bg-stone-100 dark:hover:bg-slate-800'
                }`}
              >
                Break 5m
              </button>
            </div>
          </div>

          <div className="text-center py-2">
            <div className="font-mono text-3xl font-bold text-slate-900 dark:text-white tabular-nums">
              {mins}:{secs}
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 mt-2">
            <button
              type="button"
              onClick={() => setRunning((r) => !r)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition cursor-pointer"
            >
              {running ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {running ? 'Pause' : 'Start'}
            </button>
            <button
              type="button"
              onClick={() => switchMode(mode)}
              className="p-2 rounded-xl border border-stone-200 dark:border-slate-700 text-slate-500 hover:bg-stone-100 dark:hover:bg-slate-800"
              title="Reset timer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
