import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { Brain, CircleCheck, X, Zap } from 'lucide-react';
import { buildSession, PRACTICE_MODES, type PracticeItem, type PracticeMode } from '@/db/practice';
import { completePracticeSession, recordAttempt, reviewCard, type PracticeSessionResult } from '@/db/progression';
import { uid } from '@/db/db';
import { courseById } from '@/content';
import type { ActivityResponse, GradeResult } from '@/domain/grading';
import { isGradedActivity } from '@/domain/content';
import { QUALIFYING_REVIEW_ITEMS } from '@/domain/xp';
import { useActiveTimer } from '@/hooks/useActiveTimer';
import { ActivityPlayer } from '@/components/activities/ActivityPlayer';
import { Button, Card, Dialog, EmptyState, LinkButton, PageHeader, ProgressBar, Spinner } from '@/components/ui';
import { useToast } from '@/components/toast';

const MODES = Object.keys(PRACTICE_MODES) as PracticeMode[];

export default function PracticeSessionRoute() {
  const { mode = '' } = useParams();
  const [params] = useSearchParams();
  const course = params.get('course') ?? undefined;
  return <PracticeSession key={`${mode}-${course}-${params.get('r') ?? ''}`} mode={mode} courseId={course} />;
}

function PracticeSession({ mode, courseId }: { mode: string; courseId?: string }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [sessionId] = useState(() => uid());
  const [items, setItems] = useState<PracticeItem[] | null>(null);
  const [pos, setPos] = useState(0);
  const [done, setDone] = useState<PracticeSessionResult | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const correct = useRef(0);
  const graded = useRef(0);
  const timer = useActiveTimer(!done);
  const valid = MODES.includes(mode as PracticeMode);

  useEffect(() => {
    if (valid) void buildSession(mode as PracticeMode, sessionId, courseId).then(setItems);
  }, [mode, sessionId, courseId, valid]);

  const onChecked = useCallback(
    (item: PracticeItem) => async (result: GradeResult, response: ActivityResponse) => {
      timer.lap();
      if (isGradedActivity(item.activity)) {
        graded.current += 1;
        if (result.correct) correct.current += 1;
      }
      try {
        if (item.cardId && response.type === 'flashcard') {
          const r = await reviewCard(item.cardId, response.rating);
          toast.achievements(r.achievements);
        } else {
          const r = await recordAttempt({ activity: item.activity, result, lessonId: item.lessonId, source: 'practice' });
          toast.achievements(r.achievements);
        }
      } catch (e) {
        console.error(e);
      }
    },
    [timer, toast],
  );

  const finish = useCallback(async () => {
    const r = await completePracticeSession({ sessionId, mode, items: items?.length ?? 0, correct: correct.current, seconds: timer.total() });
    toast.achievements(r.achievements);
    setDone(r);
  }, [sessionId, mode, items, timer, toast]);

  if (!valid)
    return (
      <div>
        <PageHeader title="Practice" back="/practice" />
        <EmptyState icon={<Brain />} title="Unknown practice mode" action={<LinkButton to="/practice">Back to practice</LinkButton>} />
      </div>
    );

  const info = PRACTICE_MODES[mode as PracticeMode];
  const title = mode === 'mastery' && courseId ? `${info.title}: ${courseById.get(courseId)?.title ?? ''}` : info.title;

  if (!items) return <Spinner />;
  if (!items.length)
    return (
      <div>
        <PageHeader title={title} back="/practice" />
        <EmptyState icon={<CircleCheck />} title="Nothing to practice here yet" action={<LinkButton to="/learn">Continue learning</LinkButton>}>
          {mode === 'review' ? 'You’re all caught up — no cards or missed questions are due.' : 'Complete more lessons to unlock questions for this mode.'}
        </EmptyState>
      </div>
    );

  if (done) {
    const acc = graded.current ? Math.round((correct.current / graded.current) * 100) : null;
    return (
      <div>
        <PageHeader title={`${info.title} complete`} back="/practice" />
        <Card className="hero-gradient text-center">
          <p className="text-sm font-semibold text-muted">Accuracy</p>
          <p className="text-5xl font-extrabold">{acc === null ? '—' : `${acc}%`}</p>
          <p className="mt-1 text-muted">
            {correct.current}/{graded.current} questions right{items.length - graded.current > 0 ? ` · ${items.length - graded.current} cards reviewed` : ''}
          </p>
          {mode === 'mastery' && acc !== null && (
            <p className="mt-3 font-semibold">{acc >= 80 ? 'Strong mastery — nice work.' : acc >= 60 ? 'Solid. Review the weak spots and try again.' : 'Good baseline. Revisit the lessons and come back.'}</p>
          )}
        </Card>
        <Card className="mt-3">
          {done.xpEvents.length ? (
            done.xpEvents.map((e) => (
              <p key={e.id} className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Zap size={16} className="text-amber" /> {e.kind === 'daily' ? 'Daily challenge' : 'Practice session'}
                </span>
                <span className="font-bold text-amber">+{e.amount} XP</span>
              </p>
            ))
          ) : (
            <p className="text-sm text-muted">
              {done.capped
                ? 'You’ve hit today’s practice XP cap (3 sessions). Extra practice still sharpens your memory!'
                : `Sessions with ${QUALIFYING_REVIEW_ITEMS}+ items earn XP and count toward your streak.`}
            </p>
          )}
        </Card>
        <div className="mt-4 space-y-2">
          <LinkButton to="/practice" block size="lg">
            Back to Practice
          </LinkButton>
          <Button
            variant="ghost"
            block
            onClick={() => navigate(`/practice/${mode}?${new URLSearchParams({ ...(courseId ? { course: courseId } : {}), r: String(Date.now()) })}`, { replace: true })}
          >
            Another round
          </Button>
        </div>
      </div>
    );
  }

  const current = items[pos];
  return (
    <div className="flex min-h-[calc(100dvh-140px)] flex-col">
      <div className="flex min-h-[56px] items-center gap-3">
        <button onClick={() => setConfirmExit(true)} aria-label="End practice" className="-ml-2 grid h-11 w-11 place-items-center rounded-xl text-muted hover:text-ink">
          <X size={24} />
        </button>
        <ProgressBar value={pos / items.length} className="flex-1" label="Practice progress" />
        <span className="text-sm font-semibold text-muted">
          {pos + 1}/{items.length}
        </span>
      </div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-blue">{title}</p>
      <AnimatePresence mode="wait">
        <motion.div key={pos} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.2 }} className="flex flex-1 flex-col">
          <ActivityPlayer
            activity={current.activity}
            seed={`${sessionId}-${pos}`}
            onChecked={onChecked(current)}
            onContinue={() => (pos + 1 >= items.length ? void finish() : setPos(pos + 1))}
            continueLabel={pos + 1 >= items.length ? 'Finish' : 'Continue'}
          />
        </motion.div>
      </AnimatePresence>
      <Dialog
        open={confirmExit}
        onClose={() => setConfirmExit(false)}
        title="End this practice session?"
        actions={
          <>
            <Button variant="ghost" onClick={() => navigate('/practice')}>
              End session
            </Button>
            <Button onClick={() => setConfirmExit(false)}>Keep going</Button>
          </>
        }
      >
        Answers so far are saved. Finish the session to earn practice XP.
      </Dialog>
    </div>
  );
}
