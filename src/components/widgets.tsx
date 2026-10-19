import { Link } from 'react-router';
import { Check, Flame, Lock, Star, Target, Zap } from 'lucide-react';
import type { LevelInfo } from '@/domain/levels';
import type { Course } from '@/domain/content';
import type { CourseSummary, NodeState } from '@/domain/unlocks';
import { formatDayKey } from '@/domain/dates';
import { ACHIEVEMENT_BY_ID } from '@/domain/achievements';
import { categoryById } from '@/content';
import { Card, Pill, ProgressBar, Ring, cx } from './ui';
import { Icon } from './Icon';

export function LevelCard({ lvl, compact }: { lvl: LevelInfo; compact?: boolean }) {
  return (
    <Card className={cx('hero-gradient', compact && 'p-3')}>
      <div className="flex items-center gap-3">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-violet text-white shadow-[0_8px_20px_-6px_rgb(139_92_246/0.8)]">
          <div className="text-center leading-none">
            <span className="block text-[10px] font-bold uppercase opacity-80">Lvl</span>
            <span className="font-display text-2xl font-extrabold">{lvl.level}</span>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold">{lvl.title}</p>
          <p className="text-sm text-muted">
            <span className="font-semibold text-ink">{lvl.totalXp.toLocaleString()} XP</span> total
          </p>
        </div>
        <Zap className="text-amber" size={22} aria-hidden />
      </div>
      <ProgressBar value={lvl.progress} className="mt-3" label={`Level ${lvl.level} progress`} />
      <p className="mt-1.5 text-xs text-muted">
        {lvl.intoLevel.toLocaleString()} / {lvl.span.toLocaleString()} XP · {lvl.remaining.toLocaleString()} XP to level {lvl.level + 1}
      </p>
    </Card>
  );
}

export function StreakBadge({ count, active }: { count: number; active: boolean }) {
  return (
    <div className={cx('flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold', active ? 'bg-amber-soft text-amber' : 'bg-elevated text-muted')} aria-label={`${count}-day streak`}>
      <Flame size={18} className={active ? 'fill-amber/40' : ''} aria-hidden /> {count}
    </div>
  );
}

export function WeekStrip({ week }: { week: { day: string; active: boolean; isToday: boolean; future: boolean; minutes: number }[] }) {
  return (
    <ol className="grid grid-cols-7 gap-1.5" aria-label="This week">
      {week.map((d) => (
        <li key={d.day} className="flex flex-col items-center gap-1.5">
          <span className={cx('text-[11px] font-semibold', d.isToday ? 'text-ink' : 'text-faint')}>{formatDayKey(d.day, { weekday: 'narrow' })}</span>
          <span
            className={cx(
              'grid h-9 w-9 place-items-center rounded-full text-xs font-bold',
              d.active ? 'bg-amber text-[#2a1a00]' : d.isToday ? 'border-2 border-dashed border-amber/60 text-muted' : d.future ? 'bg-elevated/50 text-faint' : 'bg-elevated text-faint',
            )}
            aria-label={`${formatDayKey(d.day, { weekday: 'long', month: 'short', day: 'numeric' })}: ${d.active ? `learned ${d.minutes} min` : d.future ? 'upcoming' : 'no activity'}`}
          >
            {d.active ? <Check size={16} /> : formatDayKey(d.day, { day: 'numeric' })}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function DailyGoalRing({ minutes, goal }: { minutes: number; goal: number }) {
  const done = minutes >= goal;
  return (
    <Ring value={minutes / goal} size={64} stroke={7} color={done ? 'var(--c-green)' : 'var(--c-blue)'} label={`${minutes} of ${goal} minutes today`}>
      <span className="text-center leading-none">
        <span className="block text-base font-extrabold">{minutes}</span>
        <span className="text-[10px] text-muted">/{goal}m</span>
      </span>
    </Ring>
  );
}

export function ChallengeCard({ title, value, target, done, claimed }: { title: string; value: number; target: number; done: boolean; claimed: boolean }) {
  return (
    <Card>
      <div className="flex items-center gap-3">
        <div className={cx('grid h-12 w-12 shrink-0 place-items-center rounded-2xl', done ? 'bg-green-soft text-green' : 'bg-blue-soft text-blue')}>
          {done ? <Check size={24} /> : <Target size={24} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">Daily challenge</p>
          <p className="font-bold">{title}</p>
        </div>
        <Pill tone={claimed ? 'green' : 'amber'}>{claimed ? 'Claimed' : '+30 XP'}</Pill>
      </div>
      <ProgressBar value={value / target} tone={done ? 'green' : 'blue'} className="mt-3" label="Daily challenge progress" />
      <p className="mt-1.5 text-xs text-muted">
        {value} / {target} {done ? '· Done for today — nice!' : ''}
      </p>
    </Card>
  );
}

export function CourseCard({ course, summary, compact }: { course: Course; summary?: CourseSummary; compact?: boolean }) {
  const cat = categoryById.get(course.categoryId);
  const soon = course.status === 'coming-soon';
  const pct = summary && summary.total ? summary.completed / summary.total : 0;
  return (
    <Link to={`/course/${course.id}`} className="surface block rounded-[var(--radius-card)] p-4 transition-transform active:scale-[0.99]">
      <div className="flex items-start gap-3">
        <div className={cx('grid h-12 w-12 shrink-0 place-items-center rounded-2xl', soon ? 'bg-elevated text-faint' : 'bg-violet-soft text-violet')}>
          <Icon name={course.icon} size={24} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="font-bold leading-tight">{course.title}</h3>
          </div>
          {!compact && <p className="mt-1 line-clamp-2 text-sm text-muted">{course.description}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {soon ? <Pill>Coming soon</Pill> : summary?.done ? <Pill tone="green">Completed</Pill> : summary?.started ? <Pill tone="blue">In progress</Pill> : <Pill tone="violet">Playable</Pill>}
            <Pill>{course.difficulty}</Pill>
            {!compact && cat && <span className="text-xs text-faint">{cat.title}</span>}
          </div>
        </div>
      </div>
      {!soon && summary && summary.started && (
        <div className="mt-3">
          <ProgressBar value={pct} tone="green" height={6} label={`${course.title} progress`} />
          <p className="mt-1 text-xs text-muted">
            {summary.completed}/{summary.total} lessons
          </p>
        </div>
      )}
    </Link>
  );
}

export function AchievementChip({ id, unlockedAt }: { id: string; unlockedAt: number }) {
  const a = ACHIEVEMENT_BY_ID.get(id);
  if (!a) return null;
  return (
    <div className="surface flex min-w-[148px] flex-col items-center rounded-2xl p-3 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-soft text-amber">
        <Icon name={a.icon} size={24} />
      </div>
      <p className="mt-2 text-sm font-bold leading-tight">{a.title}</p>
      <p className="text-[11px] text-faint">{new Date(unlockedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
    </div>
  );
}

export const NODE_STYLE: Record<NodeState, { ring: string; bg: string; label: string }> = {
  locked: { ring: 'border-line-strong', bg: 'bg-elevated text-faint', label: 'Locked' },
  available: { ring: 'border-violet', bg: 'bg-violet text-white', label: 'Start' },
  in_progress: { ring: 'border-blue', bg: 'bg-blue text-[#04202e]', label: 'In progress' },
  completed: { ring: 'border-green', bg: 'bg-green text-[#05210f]', label: 'Completed' },
  mastered: { ring: 'border-amber', bg: 'bg-amber text-[#2a1a00]', label: 'Mastered' },
};

export function NodeIcon({ state, size = 22 }: { state: NodeState; size?: number }) {
  if (state === 'locked') return <Lock size={size} />;
  if (state === 'completed') return <Check size={size} strokeWidth={3} />;
  if (state === 'mastered') return <Star size={size} className="fill-current" />;
  return <Zap size={size} className="fill-current" />;
}
