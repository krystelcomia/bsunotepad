import React, { useCallback, useEffect, useState } from 'react';
import {
  BrainCircuit,
  CalendarClock,
  CheckCircle2,
  Circle,
  Layers,
  Plus,
  RotateCw,
  Trash2,
} from 'lucide-react';
import { api } from '../../api/client';
import { Flashcard, StudySession, StudyTask, Subject } from '../../types';
import { formatDueDate, formatRelativeTime } from '../../utils/format';

interface StudyHubViewProps {
  subjects: Subject[];
  onRefreshSummary: () => void;
  onNotify: (type: 'success' | 'error' | 'info', text: string) => void;
}

export const StudyHubView: React.FC<StudyHubViewProps> = ({
  subjects,
  onRefreshSummary,
  onNotify,
}) => {
  const [tab, setTab] = useState<'tasks' | 'flashcards' | 'quiz'>('tasks');
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [sessions, setSessions] = useState<StudySession[]>([]);

  // New Task form
  const [taskTitle, setTaskTitle] = useState('');
  const [taskSubject, setTaskSubject] = useState('');
  const [taskPriority, setTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [taskDue, setTaskDue] = useState('');

  // New Flashcard form
  const [cardFront, setCardFront] = useState('');
  const [cardBack, setCardBack] = useState('');
  const [cardSubject, setCardSubject] = useState('');

  // Quiz state
  const [quizIndex, setQuizIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const [tRes, fRes, sRes] = await Promise.all([
        api.listTasks(),
        api.listFlashcards(),
        api.listStudySessions(),
      ]);
      setTasks(tRes.tasks);
      setFlashcards(fRes.flashcards);
      setSessions(sRes.sessions);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Failed to load study hub');
    }
  }, [onNotify]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    try {
      await api.createTask({
        title: taskTitle.trim(),
        subject_id: taskSubject || null,
        priority: taskPriority,
        due_date: taskDue ? new Date(taskDue).toISOString() : null,
      });
      setTaskTitle('');
      setTaskDue('');
      onNotify('success', 'Assignment added');
      await loadAll();
      onRefreshSummary();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Could not add task');
    }
  };

  const handleToggleTask = async (task: StudyTask) => {
    const nextStatus = task.status === 'done' ? 'todo' : 'done';
    await api.updateTask(task.id, { status: nextStatus });
    await loadAll();
    onRefreshSummary();
  };

  const handleDeleteTask = async (id: string) => {
    await api.deleteTask(id);
    await loadAll();
    onRefreshSummary();
  };

  const handleAddFlashcard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardFront.trim() || !cardBack.trim()) return;
    try {
      await api.createFlashcard({
        front: cardFront.trim(),
        back: cardBack.trim(),
        subject_id: cardSubject || null,
      });
      setCardFront('');
      setCardBack('');
      onNotify('success', 'Flashcard added to deck');
      await loadAll();
      onRefreshSummary();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Could not add flashcard');
    }
  };

  const handleRateCard = async (card: Flashcard, confidence: number) => {
    try {
      await api.reviewFlashcard(card.id, confidence);
      setFlipped(false);
      setQuizIndex((idx) => (idx + 1 < flashcards.length ? idx + 1 : 0));
      await loadAll();
    } catch {
      // ignore
    }
  };

  const currentQuizCard = flashcards[quizIndex];

  return (
    <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            Study Hub & Flashcards
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Track assignment deadlines, review active recall flashcards, and log focus sessions.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800">
          {[
            { id: 'tasks', label: 'Assignments', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
            { id: 'flashcards', label: `Flashcards (${flashcards.length})`, icon: <Layers className="w-3.5 h-3.5" /> },
            { id: 'quiz', label: 'Flip-Card Quiz', icon: <BrainCircuit className="w-3.5 h-3.5" /> },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as typeof tab)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                tab === t.id
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'tasks' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <form
              onSubmit={handleAddTask}
              className="rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 p-4 flex flex-wrap gap-2.5"
            >
              <input
                type="text"
                required
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="Add assignment, exam prep, or reading task..."
                className="flex-1 min-w-[200px] px-3 py-2 text-sm rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <select
                value={taskSubject}
                onChange={(e) => setTaskSubject(e.target.value)}
                className="text-xs px-2.5 py-2 rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                <option value="">General</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code || s.name}
                  </option>
                ))}
              </select>
              <select
                value={taskPriority}
                onChange={(e) => setTaskPriority(e.target.value as 'low' | 'medium' | 'high')}
                className="text-xs px-2.5 py-2 rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <input
                type="date"
                value={taskDue}
                onChange={(e) => setTaskDue(e.target.value)}
                className="text-xs px-2.5 py-2 rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Add
              </button>
            </form>

            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 divide-y divide-stone-100 dark:divide-slate-800">
              {tasks.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-10">No assignments added yet.</p>
              ) : (
                tasks.map((task) => {
                  const due = formatDueDate(task.due_date);
                  return (
                    <div key={task.id} className="flex items-center gap-3 px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleToggleTask(task)}
                        className="text-slate-400 hover:text-emerald-600 cursor-pointer"
                      >
                        {task.status === 'done' ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        ) : (
                          <Circle className="w-5 h-5" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div
                          className={`text-sm font-semibold ${
                            task.status === 'done'
                              ? 'line-through text-slate-400'
                              : 'text-slate-900 dark:text-white'
                          }`}
                        >
                          {task.title}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px]">
                          {task.subject_code && (
                            <span
                              className="font-bold px-1.5 py-0.5 rounded text-white text-[10px]"
                              style={{ backgroundColor: task.subject_color || '#4F46E5' }}
                            >
                              {task.subject_code}
                            </span>
                          )}
                          <span
                            className={`px-1.5 py-0.5 rounded font-semibold capitalize ${
                              task.priority === 'high'
                                ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                                : task.priority === 'medium'
                                  ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                                  : 'bg-stone-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            {task.priority}
                          </span>
                          <span className={`flex items-center gap-1 ${due.urgent && task.status !== 'done' ? 'text-rose-600 font-semibold' : 'text-slate-400'}`}>
                            <CalendarClock className="w-3 h-3" /> {due.label}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteTask(task.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="font-display text-sm font-bold uppercase tracking-wider text-slate-500">
              Recent Focus Sessions
            </h2>
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 p-4 space-y-2.5">
              {sessions.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">
                  Use the Pomodoro timer in the top bar to log focus blocks.
                </p>
              ) : (
                sessions.slice(0, 8).map((ss) => (
                  <div key={ss.id} className="flex items-center justify-between text-xs py-1.5 border-b last:border-0 border-stone-100 dark:border-slate-800">
                    <div>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {ss.duration_minutes}m {ss.mode}
                      </span>
                      {ss.subject_code && (
                        <span className="ml-2 text-[10px] font-bold text-indigo-600">{ss.subject_code}</span>
                      )}
                    </div>
                    <span className="text-slate-400">{formatRelativeTime(ss.completed_at)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'flashcards' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form
            onSubmit={handleAddFlashcard}
            className="rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 p-5 space-y-3 h-fit"
          >
            <h3 className="font-display font-bold text-base">Create Flashcard</h3>
            <select
              value={cardSubject}
              onChange={(e) => setCardSubject(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800"
            >
              <option value="">General Deck</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code ? `${s.code} · ${s.name}` : s.name}
                </option>
              ))}
            </select>
            <textarea
              required
              rows={3}
              value={cardFront}
              onChange={(e) => setCardFront(e.target.value)}
              placeholder="Front (Question / Concept / Term)..."
              className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800"
            />
            <textarea
              required
              rows={3}
              value={cardBack}
              onChange={(e) => setCardBack(e.target.value)}
              placeholder="Back (Definition / Proof / Explanation)..."
              className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800"
            />
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer"
            >
              Add to Deck
            </button>
          </form>

          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3.5 h-fit">
            {flashcards.map((fc) => (
              <div
                key={fc.id}
                className="rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 p-4 flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    {fc.subject_code ? (
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white"
                        style={{ backgroundColor: fc.subject_color || '#4F46E5' }}
                      >
                        {fc.subject_code}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-semibold">General</span>
                    )}
                    <button
                      type="button"
                      onClick={async () => {
                        await api.deleteFlashcard(fc.id);
                        await loadAll();
                        onRefreshSummary();
                      }}
                      className="text-slate-400 hover:text-rose-500 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">{fc.front}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-2 pt-2 border-t border-stone-100 dark:border-slate-800">
                    {fc.back}
                  </div>
                </div>
                <div className="text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Confidence: {fc.confidence}/5</span>
                  <span>Reviewed {fc.review_count}×</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'quiz' && (
        <div className="max-w-xl mx-auto py-4">
          {flashcards.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 p-10 text-center">
              <p className="text-sm text-slate-500">Create flashcards first to start an active recall quiz.</p>
            </div>
          ) : currentQuizCard ? (
            <div className="space-y-5">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>
                  Card {quizIndex + 1} of {flashcards.length}
                </span>
                <span>{currentQuizCard.subject_code || 'General'}</span>
              </div>

              <div
                onClick={() => setFlipped((f) => !f)}
                className="min-h-[240px] rounded-3xl bg-white dark:bg-slate-900 border-2 border-indigo-200 dark:border-indigo-800/70 shadow-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition hover:border-indigo-400"
              >
                <span className="text-[11px] font-bold uppercase tracking-widest text-indigo-500 mb-3">
                  {flipped ? 'Answer' : 'Question'} (Click to flip)
                </span>
                <p className="font-display text-lg sm:text-xl font-bold text-slate-900 dark:text-white leading-relaxed">
                  {flipped ? currentQuizCard.back : currentQuizCard.front}
                </p>
                <RotateCw className="w-4 h-4 text-slate-400 mt-5" />
              </div>

              {flipped && (
                <div className="space-y-2">
                  <div className="text-center text-xs font-medium text-slate-500">
                    How well did you recall this?
                  </div>
                  <div className="grid grid-cols-3 gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleRateCard(currentQuizCard, 1)}
                      className="py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold cursor-pointer"
                    >
                      Needs Review (1)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRateCard(currentQuizCard, 3)}
                      className="py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold cursor-pointer"
                    >
                      Good (3)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRateCard(currentQuizCard, 5)}
                      className="py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold cursor-pointer"
                    >
                      Mastered (5)
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};
