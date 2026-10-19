import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CircleCheck, Sparkles } from 'lucide-react';
import { ACTIVITY_LABEL, type Activity } from '@/domain/content';
import { grade, isResponseReady, type ActivityResponse, type GradeResult } from '@/domain/grading';
import { hashString } from '@/domain/dates';
import { Button, cx } from '../ui';
import {
  CaseStudyView,
  ChoiceView,
  FillBlankView,
  FlashcardView,
  MatchView,
  NumericView,
  OrderView,
  RecallView,
  SpotMistakeView,
  StrategyView,
  TrueFalseView,
  type ViewProps,
} from './ActivityViews';

const PRAISE = ['Nice work!', 'Exactly right!', 'You got it!', 'Spot on!', 'Correct!'];
const ENCOURAGE = ['Not quite — here’s the idea.', 'Good attempt. Let’s look closer.', 'Almost. This is how it works.', 'Close. Here’s what to remember.'];

/** One question on screen: answer → Check → feedback + explanation → Continue. */
export function ActivityPlayer({
  activity,
  seed,
  onChecked,
  onContinue,
  retry,
  willRetry,
  continueLabel = 'Continue',
}: {
  activity: Activity;
  seed: string;
  onChecked: (result: GradeResult, response: ActivityResponse) => void;
  onContinue: () => void;
  /** This is a second try of a question missed earlier. */
  retry?: boolean;
  /** A wrong answer will be re-asked later in this session. */
  willRetry?: boolean;
  continueLabel?: string;
}) {
  const [response, setResponse] = useState<ActivityResponse | null>(null);
  const [result, setResult] = useState<GradeResult | null>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const viewSeed = `${seed}:${activity.id}`;

  const ready = isResponseReady(activity, response);
  const check = useCallback(
    (override?: ActivityResponse) => {
      const r = override ?? response;
      if (result || !r || !isResponseReady(activity, r)) return;
      const g = grade(activity, r);
      setResponse(r);
      setResult(g);
      onChecked(g, r);
    },
    [activity, response, result, onChecked],
  );

  useEffect(() => {
    if (result) {
      feedbackRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
      setTimeout(() => continueRef.current?.focus({ preventScroll: true }), 50);
    }
  }, [result]);

  // Enter = Check / Continue (text inputs handle their own Enter).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement) return;
      if (result) onContinue();
      else if (ready) check();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [result, ready, check, onContinue]);

  const props = { response, onChange: setResponse, result, seed: viewSeed, onSubmit: check };
  const view = useMemo(() => {
    const p = { ...props, activity } as ViewProps<never>;
    switch (activity.type) {
      case 'mcq':
      case 'scenario':
        return <ChoiceView {...(p as ViewProps<typeof activity>)} />;
      case 'truefalse':
        return <TrueFalseView {...(p as ViewProps<typeof activity>)} />;
      case 'match':
        return <MatchView {...(p as ViewProps<typeof activity>)} />;
      case 'fillblank':
        return <FillBlankView {...(p as ViewProps<typeof activity>)} />;
      case 'order':
        return <OrderView {...(p as ViewProps<typeof activity>)} />;
      case 'flashcard':
        return <FlashcardView {...(p as ViewProps<typeof activity>)} />;
      case 'numeric':
        return <NumericView {...(p as ViewProps<typeof activity>)} />;
      case 'spotmistake':
        return <SpotMistakeView {...(p as ViewProps<typeof activity>)} />;
      case 'strategy':
        return <StrategyView {...(p as ViewProps<typeof activity>)} />;
      case 'recall':
        return <RecallView {...(p as ViewProps<typeof activity>)} />;
      case 'casestudy':
        return <CaseStudyView {...(p as ViewProps<typeof activity>)} />;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activity, response, result, viewSeed, check]);

  const h = hashString(viewSeed);
  const isFlash = activity.type === 'flashcard';
  const tone = !result ? null : isFlash ? 'neutral' : result.correct ? 'good' : 'learn';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 pb-6">
        <span className="sr-only">{ACTIVITY_LABEL[activity.type]}</span>
        {retry && (
          <div className="mb-3">
            <span className="rounded-full bg-amber-soft px-2.5 py-1 text-xs font-semibold text-amber">Second try</span>
          </div>
        )}
        {view}
      </div>

      <div className="sticky bottom-0 -mx-4 mt-auto border-t border-line bg-bg/95 px-4 pb-safe backdrop-blur sm:-mx-6 sm:px-6">
        <AnimatePresence initial={false}>
          {result && (
            <motion.div
              ref={feedbackRef}
              key="fb"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className={cx(
                'mt-3 rounded-2xl p-4',
                tone === 'good' && 'bg-green-soft',
                tone === 'learn' && 'bg-amber-soft',
                tone === 'neutral' && 'bg-elevated',
              )}
              role="status"
              aria-live="polite"
            >
              <p className={cx('flex items-center gap-2 text-[17px] font-bold', tone === 'good' ? 'text-green' : tone === 'learn' ? 'text-amber' : 'text-ink')}>
                {tone === 'good' ? <CircleCheck size={20} /> : <Sparkles size={20} />}
                {isFlash ? 'Rated' : result.correct ? PRAISE[h % PRAISE.length] : ENCOURAGE[h % ENCOURAGE.length]}
              </p>
              <p className="mt-1 text-[15px]">{result.feedback}</p>
              {!result.correct && result.correctAnswer && activity.type !== 'casestudy' && (
                <p className="mt-2 whitespace-pre-line text-[15px]">
                  <span className="font-semibold">Correct answer: </span>
                  {result.correctAnswer}
                </p>
              )}
              <p className="mt-2 text-[15px] text-muted">{activity.explanation}</p>
              {!result.correct && !isFlash && willRetry && <p className="mt-2 text-sm font-medium text-muted">You’ll get another shot at this one before the end.</p>}
            </motion.div>
          )}
        </AnimatePresence>
        <div className="py-3">
          {result ? (
            <Button ref={continueRef} block size="lg" variant={tone === 'good' ? 'success' : 'primary'} onClick={onContinue}>
              {continueLabel}
            </Button>
          ) : isFlash ? (
            <p className="py-3 text-center text-sm text-muted">Reveal the card, then rate yourself.</p>
          ) : (
            <Button block size="lg" disabled={!ready} onClick={() => check()}>
              Check
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
