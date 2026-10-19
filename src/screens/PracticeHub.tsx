import { useState } from 'react';
import { Link } from 'react-router';
import { BookA, Brain, Calculator, CalendarCheck, ChevronRight, GraduationCap, Layers, Rocket, Search, Target, Zap } from 'lucide-react';
import { playableCourses } from '@/content';
import { PRACTICE_MODES, type PracticeMode } from '@/db/practice';
import { SRS_RULES } from '@/domain/srs';
import { QUALIFYING_REVIEW_ITEMS, XP_CAPS, XP_RULES } from '@/domain/xp';
import { usePracticeAvailability } from '@/hooks/data';
import { useCourseSummaries } from '@/hooks/courses';
import { Card, EmptyState, LinkButton, PageHeader, SectionTitle, Spinner, cx } from '@/components/ui';

const MODE_ICON: Record<PracticeMode, typeof Zap> = {
  review: CalendarCheck,
  weak: Target,
  quick: Zap,
  vocab: BookA,
  calc: Calculator,
  mastery: GraduationCap,
};

function ModeRow({ mode, count, to }: { mode: PracticeMode; count: number; to: string }) {
  const I = MODE_ICON[mode];
  const disabled = count === 0;
  const body = (
    <>
      <div className={cx('grid h-12 w-12 shrink-0 place-items-center rounded-2xl', disabled ? 'bg-elevated text-faint' : 'bg-blue-soft text-blue')}>
        <I size={22} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-bold">{PRACTICE_MODES[mode].title}</p>
        <p className="text-sm text-muted">{disabled ? emptyReason(mode) : PRACTICE_MODES[mode].description}</p>
      </div>
      {!disabled && (
        <>
          <span className="rounded-full bg-elevated px-2.5 py-1 text-xs font-bold text-muted">{count}</span>
          <ChevronRight size={18} className="text-faint" />
        </>
      )}
    </>
  );
  return disabled ? (
    <div className="surface flex min-h-[72px] items-center gap-3 rounded-[var(--radius-card)] p-3 opacity-75" aria-disabled>
      {body}
    </div>
  ) : (
    <Link to={to} className="surface flex min-h-[72px] items-center gap-3 rounded-[var(--radius-card)] p-3">
      {body}
    </Link>
  );
}

function emptyReason(mode: PracticeMode) {
  switch (mode) {
    case 'review':
      return 'All caught up — nothing due right now.';
    case 'weak':
      return 'No weak areas yet. Keep practicing!';
    case 'calc':
      return 'Complete a lesson with calculations to unlock.';
    default:
      return 'Complete a lesson to unlock.';
  }
}

export default function PracticeHub() {
  const avail = usePracticeAvailability();
  const summaries = useCourseSummaries();
  const [course, setCourse] = useState<string>('');
  if (!avail || !summaries) return <Spinner />;

  const started = playableCourses.filter((c) => (summaries.get(c.id)?.completed ?? 0) > 0);
  const masteryCourse = course || started[0]?.id || '';
  const nothing = avail.quick === 0 && avail.cardsTotal === 0;

  return (
    <div>
      <PageHeader title="Practice" subtitle="Everything here comes from lessons you’ve completed." />

      {nothing ? (
        <EmptyState icon={<Brain />} title="Practice unlocks as you learn" action={<LinkButton to="/learn">Start a lesson</LinkButton>}>
          Finish your first lesson and its questions, terms and flashcards appear here for spaced review.
        </EmptyState>
      ) : (
        <>
          <Link to="/practice/flashcards" className="hero-gradient surface flex items-center gap-3 rounded-[var(--radius-card)] p-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-violet text-white">
              <Layers size={26} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-bold">Flashcards</p>
              <p className="text-sm text-muted">
                {avail.cardsDue} due · {avail.cardsTotal} unlocked
              </p>
            </div>
            <ChevronRight className="text-muted" />
          </Link>

          <div className="mt-3 space-y-3">
            <ModeRow mode="review" count={avail.review} to="/practice/review" />
            <ModeRow mode="weak" count={avail.weak} to="/practice/weak" />
            <ModeRow mode="quick" count={avail.quick} to="/practice/quick" />
            <ModeRow mode="vocab" count={avail.vocab} to="/practice/vocab" />
            <ModeRow mode="calc" count={avail.calc} to="/practice/calc" />
          </div>

          <SectionTitle>Mastery Check</SectionTitle>
          {started.length ? (
            <Card>
              <label className="block">
                <span className="text-sm font-semibold text-muted">Course</span>
                <select value={masteryCourse} onChange={(e) => setCourse(e.target.value)} className="mt-1 min-h-[48px] w-full rounded-xl border border-line-strong bg-elevated px-3">
                  {started.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </label>
              <p className="mt-2 text-sm text-muted">{PRACTICE_MODES.mastery.description}</p>
              <LinkButton to={`/practice/mastery?course=${masteryCourse}`} block className="mt-3">
                <GraduationCap size={18} /> Start Mastery Check
              </LinkButton>
            </Card>
          ) : (
            <Card>
              <p className="text-sm text-muted">Complete a lesson in any course to unlock a Mastery Check.</p>
            </Card>
          )}
        </>
      )}

      <SectionTitle>More</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <Link to="/glossary" className="surface flex min-h-[88px] flex-col justify-between rounded-2xl p-3">
          <Search size={22} className="text-violet" />
          <span className="font-bold">Business glossary</span>
        </Link>
        <Link to="/simulate" className="surface flex min-h-[88px] flex-col justify-between rounded-2xl p-3">
          <Rocket size={22} className="text-green" />
          <span className="font-bold">POD simulation</span>
        </Link>
      </div>

      <details className="surface mt-6 rounded-2xl p-4 text-sm">
        <summary className="min-h-[32px] cursor-pointer font-semibold">How practice & reviews work</summary>
        <div className="mt-3 space-y-2 text-muted">
          <p>Flashcards use a simple spaced-repetition schedule based on your rating:</p>
          <ul className="space-y-1">
            {SRS_RULES.map((r) => (
              <li key={r.rating}>
                <span className="font-semibold text-ink">{r.label}:</span> {r.text}
              </li>
            ))}
          </ul>
          <p>
            Sessions with at least {QUALIFYING_REVIEW_ITEMS} items count toward your streak and earn +{XP_RULES.review} XP (up to {XP_CAPS.review} sessions a day).
          </p>
          <p>Weak areas are concepts where fewer than 70% of your recent answers were right.</p>
        </div>
      </details>
    </div>
  );
}
