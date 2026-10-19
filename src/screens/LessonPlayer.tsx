import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, BookOpen, ExternalLink, Lightbulb, Lock, Target, X } from 'lucide-react';
import { glossaryById, lessonIndex } from '@/content';
import { isGradedActivity, type Activity } from '@/domain/content';
import type { GradeResult } from '@/domain/grading';
import { completeLesson, recordAttempt, startLesson, type ActivityOutcome } from '@/db/progression';
import { uid } from '@/db/db';
import { useLessonStates } from '@/hooks/courses';
import { useActiveTimer } from '@/hooks/useActiveTimer';
import { ActivityPlayer } from '@/components/activities/ActivityPlayer';
import { Button, Dialog, EmptyState, LinkButton, Pill, ProgressBar, Spinner } from '@/components/ui';
import { useToast } from '@/components/toast';

interface QueueItem {
  activity: Activity;
  retry: boolean;
}

/** Keyed by lesson id so moving between lessons always starts a fresh session. */
export default function LessonPlayerRoute() {
  const { lessonId = '' } = useParams();
  return <LessonPlayer key={lessonId} lessonId={lessonId} />;
}

function LessonPlayer({ lessonId }: { lessonId: string }) {
  const navigate = useNavigate();
  const ref = lessonIndex.get(lessonId);
  const states = useLessonStates(ref?.course);
  const toast = useToast();

  const [sessionId] = useState(() => uid());
  const [phase, setPhase] = useState<'intro' | 'play' | 'saving'>('intro');
  const [queue, setQueue] = useState<QueueItem[]>(() => (ref ? ref.lesson.activities.map((activity) => ({ activity, retry: false })) : []));
  const [pos, setPos] = useState(0);
  const [confirmExit, setConfirmExit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const outcomes = useRef(new Map<string, ActivityOutcome>());
  const timer = useActiveTimer(phase !== 'saving');

  const state = states?.get(lessonId);

  useEffect(() => {
    if (ref && state && state !== 'locked') void startLesson(ref.lesson.id);
  }, [ref, state]);

  const onChecked = useCallback(
    (item: QueueItem) => async (result: GradeResult) => {
      const { activity } = item;
      timer.lap();
      if (!item.retry && isGradedActivity(activity)) {
        outcomes.current.set(activity.id, { activityId: activity.id, correct: result.correct, score: result.score });
        if (!result.correct) setQueue((q) => [...q, { activity, retry: true }]);
      }
      try {
        const r = await recordAttempt({ activity, result, lessonId, source: 'lesson' });
        toast.achievements(r.achievements);
      } catch (e) {
        console.error(e);
      }
    },
    [lessonId, toast, timer],
  );

  const finish = useCallback(async () => {
    if (!ref) return;
    setPhase('saving');
    try {
      const result = await completeLesson({
        lessonId: ref.lesson.id,
        sessionId,
        outcomes: [...outcomes.current.values()],
        seconds: timer.total(),
      });
      toast.achievements(result.achievements);
      navigate(`/lesson/${ref.lesson.id}/results`, { replace: true, state: result });
    } catch (e) {
      console.error(e);
      setError('We couldn’t save this lesson. Your device storage may be full or blocked. Please try again.');
      setPhase('play');
    }
  }, [ref, sessionId, timer, toast, navigate]);

  const onContinue = useCallback(() => {
    if (pos + 1 >= queue.length) void finish();
    else setPos((p) => p + 1);
  }, [pos, queue.length, finish]);

  if (!ref)
    return (
      <div className="mx-auto max-w-xl px-4 pt-safe">
        <div className="pt-10">
          <EmptyState icon={<BookOpen />} title="Lesson not found" action={<LinkButton to="/learn">Browse courses</LinkButton>}>
            This lesson may have been renamed in a content update. Your progress on other lessons is safe.
          </EmptyState>
        </div>
      </div>
    );
  if (!states) return <Spinner />;
  if (state === 'locked') {
    const prev = ref.globalIndex > 0 ? ref.course.modules.flatMap((m) => m.lessons)[ref.globalIndex - 1] : null;
    return (
      <div className="mx-auto max-w-xl px-4 pt-safe">
        <div className="pt-10">
          <EmptyState icon={<Lock />} title="This lesson is locked" action={<LinkButton to={`/course/${ref.course.id}/path`}>Go to learning path</LinkButton>}>
            {prev ? `Complete “${prev.title}” first to unlock it.` : 'Complete the previous lesson first.'}
          </EmptyState>
        </div>
      </div>
    );
  }

  const { lesson, course } = ref;
  const total = queue.length;
  const current = queue[pos];
  const progress = phase === 'intro' ? 0 : pos / total;

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 pl-safe pr-safe sm:px-6">
      {/* Top bar */}
      <div className="sticky top-0 z-20 -mx-4 flex min-h-[60px] items-center gap-3 bg-bg/95 px-4 pt-safe backdrop-blur sm:-mx-6 sm:px-6">
        <button onClick={() => setConfirmExit(true)} aria-label="Exit lesson" className="-ml-2 grid h-11 w-11 shrink-0 place-items-center rounded-xl text-muted hover:text-ink">
          <X size={24} />
        </button>
        <ProgressBar value={progress} className="flex-1" height={12} label="Lesson progress" />
        <span className="w-12 shrink-0 text-right text-sm font-semibold text-muted" aria-live="polite">
          {phase === 'intro' ? 'Learn' : `${Math.min(pos + 1, total)}/${total}`}
        </span>
      </div>

      {error && (
        <div className="mt-3 rounded-2xl bg-rose-soft p-3 text-sm text-rose" role="alert">
          {error}
        </div>
      )}

      <AnimatePresence mode="wait">
        {phase === 'intro' ? (
          <motion.div key="intro" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="flex flex-1 flex-col pt-4">
            <div className="flex-1">
              <p className="text-xs font-bold uppercase tracking-wider text-violet">{course.title}</p>
              <h1 className="mt-1 text-[28px] font-extrabold leading-tight">{lesson.title}</h1>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Pill>{lesson.minutes} min</Pill>
                <Pill>{lesson.activities.length} activities</Pill>
                {lesson.checkpoint && <Pill tone="blue">Checkpoint · score 70% to pass</Pill>}
                {(state === 'completed' || state === 'mastered') && <Pill tone="green">Replay · practice XP</Pill>}
              </div>

              <div className="mt-5 flex items-start gap-3 rounded-2xl bg-violet-soft p-4">
                <Target size={20} className="mt-0.5 shrink-0 text-violet" />
                <p className="text-[15px] font-medium">{lesson.objective}</p>
              </div>

              <div className="mt-5 space-y-3 text-[16px] leading-relaxed">
                {lesson.explanation.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>

              <div className="mt-5 rounded-2xl border border-line-strong bg-card p-4">
                <p className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber">
                  <Lightbulb size={16} /> Example
                </p>
                <p className="text-[15px] leading-relaxed">{lesson.example}</p>
              </div>

              {lesson.terms.length > 0 && (
                <div className="mt-5">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Key terms</p>
                  <div className="flex flex-wrap gap-1.5">
                    {lesson.terms.map((t) => (
                      <Pill key={t} tone="violet">
                        {glossaryById.get(t)?.term ?? t}
                      </Pill>
                    ))}
                  </div>
                </div>
              )}

              {lesson.verify && (
                <div className="mt-5 flex items-start gap-2 rounded-2xl bg-amber-soft p-3 text-sm">
                  <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber" />
                  <p>
                    <span className="font-semibold">Verify before relying on it: </span>
                    {lesson.verify}
                  </p>
                </div>
              )}
              {lesson.references.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {lesson.references.map((r) => (
                    <li key={r.url}>
                      <a href={r.url} target="_blank" rel="noreferrer" className="inline-flex min-h-[36px] items-center gap-1.5 text-sm font-semibold text-blue">
                        <ExternalLink size={14} /> {r.label}
                      </a>
                    </li>
                  ))}
                  <li className="text-xs text-faint">Optional official references (need internet). Content last reviewed {course.lastReviewed}.</li>
                </ul>
              )}
            </div>
            <div className="sticky bottom-0 -mx-4 mt-6 border-t border-line bg-bg/95 px-4 py-3 pb-safe backdrop-blur sm:-mx-6 sm:px-6">
              <Button block size="lg" onClick={() => setPhase('play')} autoFocus>
                Start practice
              </Button>
            </div>
          </motion.div>
        ) : current ? (
          <motion.div key={`${pos}-${current.activity.id}`} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.2 }} className="flex flex-1 flex-col pt-4">
            <ActivityPlayer
              activity={current.activity}
              seed={`${sessionId}-${pos}`}
              retry={current.retry}
              willRetry={!current.retry}
              onChecked={onChecked(current)}
              onContinue={onContinue}
              continueLabel={pos + 1 >= total ? 'Finish lesson' : 'Continue'}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      {phase === 'saving' && <Spinner />}

      <Dialog
        open={confirmExit}
        onClose={() => setConfirmExit(false)}
        title="Leave this lesson?"
        actions={
          <>
            <Button variant="ghost" onClick={() => navigate(`/course/${course.id}/path`)}>
              Leave lesson
            </Button>
            <Button onClick={() => setConfirmExit(false)}>Keep learning</Button>
          </>
        }
      >
        Answers so far count as practice, but the lesson won’t be marked complete until you finish it.
      </Dialog>
    </div>
  );
}
