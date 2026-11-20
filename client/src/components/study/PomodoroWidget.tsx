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
          const modeLabel = mode === 'focus' ? 'pokus' : 'pahinga';
          api
            .logStudySession(mins, mode, {
              subjectId: activeSubjectId,
              noteId: activeNoteId,
            })
            .then(() => {
              onSessionLogged?.();
              onNotify?.('success', `Naitala ang ${mins}-minutong sesyon ng ${modeLabel}!`);
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
            ? 'bg-blue-700 text-white border-blue-700 shadow-xs'
            : 'bg-white dark:bg-[#132340] text-slate-700 dark:text-blue-100 border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/60'
        }`}
        title="Timer sa Pokus ng Pag-aaral"
      >
        {mode === 'focus' ? <Timer className="w-3.5 h-3.5" /> : <Coffee className="w-3.5 h-3.5" />}
        <span className="font-mono tabular-nums">
          {mins}:{secs}
        </span>
      </button>

      {expanded && (
        <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-[#0D1930] border border-blue-200 dark:border-blue-800 shadow-xl p-4 z-40">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Timer sa Pag-aaral
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => switchMode('focus')}
                className={`px-2 py-0.5 text-[11px] font-semibold rounded-md cursor-pointer ${
                  mode === 'focus'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-sky-200'
                    : 'text-slate-500 hover:bg-blue-50 dark:hover:bg-blue-950'
                }`}
              >
                Pokus 25m
              </button>
              <button
                type="button"
                onClick={() => switchMode('break')}
                className={`px-2 py-0.5 text-[11px] font-semibold rounded-md cursor-pointer ${
                  mode === 'break'
                    ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-200'
                    : 'text-slate-500 hover:bg-blue-50 dark:hover:bg-blue-950'
                }`}
              >
                Pahinga 5m
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
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold transition cursor-pointer"
            >
              {running ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {running ? 'Ihinto' : 'Simulan'}
            </button>
            <button
              type="button"
              onClick={() => switchMode(mode)}
              className="p-2 rounded-xl border border-blue-200 dark:border-blue-800 text-slate-500 hover:bg-blue-50 dark:hover:bg-blue-950 cursor-pointer"
              title="I-reset ang timer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
