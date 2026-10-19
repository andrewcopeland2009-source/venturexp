import { useLocation, useParams } from 'react-router';
import { motion } from 'motion/react';
import { Flame, PartyPopper, RotateCcw, Sparkles, Trophy, Unlock, Zap } from 'lucide-react';
import { lessonIndex } from '@/content';
import type { LessonCompletionResult } from '@/db/progression';
import { ACHIEVEMENT_BY_ID } from '@/domain/achievements';
import { XP_LABEL } from '@/domain/xp';
import { CHECKPOINT_PASS } from '@/domain/unlocks';
import { useProgressMap, useXp } from '@/hooks/data';
import { Card, EmptyState, LinkButton, ProgressBar, Spinner, cx } from '@/components/ui';
import { LevelCard } from '@/components/widgets';
import { Icon } from '@/components/Icon';
import { BookOpen } from 'lucide-react';

export default function LessonResults() {
  const { lessonId = '' } = useParams();
  const location = useLocation();
  const result = location.state as LessonCompletionResult | null;
  const ref = lessonIndex.get(lessonId);
  const progress = useProgressMap();
  const lvl = useXp();

  if (!ref)
    return (
      <div className="mx-auto max-w-xl px-4 pt-10">
        <EmptyState icon={<BookOpen />} title="Lesson not found" action={<LinkButton to="/learn">Browse courses</LinkButton>} />
      </div>
    );
  if (!progress || !lvl) return <Spinner />;

  const { lesson, course } = ref;
  const saved = progress.get(lesson.id);

  // Opened directly (e.g. after a reload): show the saved record instead of the live result.
  if (!result) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pb-safe pt-safe">
        <div className="flex-1 pt-10 text-center">
          <h1 className="text-2xl font-extrabold">{lesson.title}</h1>
          {saved?.status === 'completed' ? (
            <p className="mt-2 text-muted">
              Completed · best score {Math.round(saved.bestScore * 100)}%{saved.perfect ? ' · mastered' : ''}
            </p>
          ) : (
            <p className="mt-2 text-muted">Not completed yet.</p>
          )}
          <div className="mt-6 text-left">
            <LevelCard lvl={lvl} />
          </div>
        </div>
        <div className="space-y-2 py-4">
          <LinkButton to={`/course/${course.id}/path`} block size="lg">
            Back to learning path
          </LinkButton>
        </div>
      </div>
    );
  }

  const pct = Math.round(result.score * 100);
  const levelUp = result.levelAfter.level > result.levelBefore.level;
  const next = result.nextLessonId ? lessonIndex.get(result.nextLessonId) : undefined;
  const failedCheckpoint = !result.passed;

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pb-safe pt-safe">
      <div className="flex-1 pt-8">
        <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 14 }} className="mx-auto grid h-24 w-24 place-items-center rounded-[28px] bg-gradient-to-br from-violet to-blue text-white shadow-[0_20px_50px_-15px_rgb(139_92_246/0.8)]">
          {failedCheckpoint ? <RotateCcw size={44} /> : result.perfect ? <Sparkles size={44} /> : <PartyPopper size={44} />}
        </motion.div>
        <h1 className="mt-5 text-center text-[28px] font-extrabold">
          {failedCheckpoint ? 'So close — keep going' : result.perfect ? 'Perfect lesson!' : 'Lesson complete!'}
        </h1>
        <p className="mt-1 text-center text-muted">
          {failedCheckpoint
            ? `Checkpoints need ${Math.round(CHECKPOINT_PASS * 100)}% on first tries. You got ${pct}%. Review the explanations and try again — every attempt builds the skill.`
            : `${lesson.title} · ${result.correctCount}/${result.gradedCount} right on the first try`}
        </p>

        <div className="mt-6 grid grid-cols-3 gap-2.5">
          <Card className="p-3 text-center">
            <p className="text-xs font-semibold text-muted">Accuracy</p>
            <p className={cx('text-2xl font-extrabold', pct >= 80 ? 'text-green' : pct >= 50 ? 'text-blue' : 'text-amber')}>{pct}%</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-xs font-semibold text-muted">XP earned</p>
            <p className="text-2xl font-extrabold text-amber">+{result.xpGained}</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-xs font-semibold text-muted">Streak</p>
            <p className="flex items-center justify-center gap-1 text-2xl font-extrabold">
              <Flame size={20} className="text-amber" /> {result.streak}
            </p>
          </Card>
        </div>

        {result.xpEvents.length > 0 && (
          <Card className="mt-4">
            <ul className="space-y-2">
              {result.xpEvents.map((e, i) => (
                <motion.li key={e.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.12 }} className="flex items-center justify-between text-[15px]">
                  <span className="flex items-center gap-2">
                    <Zap size={16} className="text-amber" /> {XP_LABEL[e.kind]}
                  </span>
                  <span className="font-bold text-amber">+{e.amount} XP</span>
                </motion.li>
              ))}
            </ul>
          </Card>
        )}
        {result.xpEvents.length === 0 && !failedCheckpoint && (
          <p className="mt-4 text-center text-sm text-muted">No new XP this time — replay XP is capped at 5 runs a day. Practice still strengthens your memory.</p>
        )}

        <div className="mt-4">
          {levelUp && (
            <motion.p initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mb-2 rounded-2xl bg-violet-soft p-3 text-center font-bold text-violet">
              Level up! You reached level {result.levelAfter.level} — {result.levelAfter.title}
            </motion.p>
          )}
          <Card>
            <div className="flex items-baseline justify-between">
              <p className="font-bold">Level {result.levelAfter.level}</p>
              <p className="text-sm text-muted">{result.levelAfter.remaining.toLocaleString()} XP to next</p>
            </div>
            <ProgressBar value={result.levelAfter.progress} className="mt-2" label="Level progress" />
          </Card>
        </div>

        {(result.unlockedNext || result.moduleCompleted || result.courseCompleted) && (
          <Card className="mt-4 border-green/40">
            {result.courseCompleted ? (
              <p className="flex items-center gap-2 font-bold text-green">
                <Trophy size={20} /> You completed {course.title}!
              </p>
            ) : result.moduleCompleted ? (
              <p className="flex items-center gap-2 font-bold text-green">
                <Unlock size={20} /> Module complete — the next module is unlocked.
              </p>
            ) : (
              <p className="flex items-center gap-2 font-bold text-green">
                <Unlock size={20} /> Unlocked: {next?.lesson.title}
              </p>
            )}
          </Card>
        )}

        {result.achievements.length > 0 && (
          <div className="mt-4 space-y-2">
            {result.achievements.map((id) => {
              const a = ACHIEVEMENT_BY_ID.get(id);
              return a ? (
                <motion.div key={id} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="surface flex items-center gap-3 rounded-2xl p-3">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-soft text-amber">
                    <Icon name={a.icon} size={24} />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-amber">Badge unlocked</p>
                    <p className="font-bold">{a.title}</p>
                    <p className="text-sm text-muted">{a.description}</p>
                  </div>
                </motion.div>
              ) : null;
            })}
          </div>
        )}
      </div>

      <div className="sticky bottom-0 space-y-2 bg-bg/95 py-4 backdrop-blur">
        {failedCheckpoint ? (
          <LinkButton to={`/lesson/${lesson.id}`} replace block size="lg">
            <RotateCcw size={18} /> Try the checkpoint again
          </LinkButton>
        ) : next && !result.courseCompleted ? (
          <LinkButton to={`/lesson/${next.lesson.id}`} replace block size="lg">
            Next: {next.lesson.title}
          </LinkButton>
        ) : (
          <LinkButton to="/practice" block size="lg">
            Practice what you learned
          </LinkButton>
        )}
        <LinkButton to={`/course/${course.id}/path`} variant="ghost" block>
          Back to learning path
        </LinkButton>
      </div>
    </div>
  );
}
