import { hashString, type DayKey } from './dates';
import type { DailyActivity } from './records';

export interface DailyChallengeDef {
  id: string;
  title: string;
  target: number;
  unit: string;
  needsCards?: boolean;
  progress: (d: DailyActivity) => number;
}

export const DAILY_CHALLENGES: DailyChallengeDef[] = [
  { id: 'lessons-2', title: 'Finish 2 lessons', target: 2, unit: 'lessons', progress: (d) => d.lessonsCompleted },
  { id: 'answer-15', title: 'Answer 15 questions', target: 15, unit: 'questions', progress: (d) => d.questionsAnswered },
  { id: 'correct-10', title: 'Get 10 answers right', target: 10, unit: 'correct', progress: (d) => d.correctAnswers },
  {
    id: 'cards-10',
    title: 'Review 10 flashcards',
    target: 10,
    unit: 'cards',
    needsCards: true,
    progress: (d) => d.cardsReviewed,
  },
  { id: 'minutes-10', title: 'Learn for 10 minutes', target: 10, unit: 'min', progress: (d) => Math.floor(d.seconds / 60) },
];

/**
 * Deterministic challenge for a calendar day. If the learner has no flashcards yet, card
 * challenges are swapped for an always-achievable one.
 */
export function challengeFor(day: DayKey, hasCards: boolean, lockedId?: string | null): DailyChallengeDef {
  const locked = lockedId ? DAILY_CHALLENGES.find((c) => c.id === lockedId) : undefined;
  if (locked) return locked;
  const pool = hasCards ? DAILY_CHALLENGES : DAILY_CHALLENGES.filter((c) => !c.needsCards);
  return pool[hashString(`vxp-daily-${day}`) % pool.length];
}

export function challengeProgress(def: DailyChallengeDef, d: DailyActivity | undefined): { value: number; done: boolean } {
  const value = d ? Math.min(def.target, def.progress(d)) : 0;
  return { value, done: value >= def.target };
}
