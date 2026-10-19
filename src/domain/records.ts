import { z } from 'zod';

/**
 * Persisted learner data. Each schema maps to one IndexedDB table (see src/db/db.ts) and is
 * reused to validate backup files on import.
 */

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const ts = z.number().int().nonnegative();

export const Experience = z.enum(['beginner', 'some', 'intermediate', 'advanced']);
export type Experience = z.infer<typeof Experience>;

export const Goal = z.enum(['start', 'grow', 'terminology', 'marketing', 'explore']);
export type Goal = z.infer<typeof Goal>;

export const UserProfile = z.object({
  id: z.literal('me'),
  nickname: z.string().max(40),
  avatar: z.string().max(16),
  joinedAt: ts,
  onboarded: z.boolean(),
});
export type UserProfile = z.infer<typeof UserProfile>;

export const Preferences = z.object({
  id: z.literal('prefs'),
  interests: z.array(z.string()),
  experience: Experience,
  goals: z.array(Goal),
  dailyGoalMinutes: z.union([z.literal(5), z.literal(10), z.literal(15), z.literal(20)]),
  timezone: z.string().min(1),
  theme: z.enum(['dark', 'light']),
  reducedMotion: z.enum(['system', 'on', 'off']),
  backupReminders: z.boolean(),
  lastBackupAt: ts.nullable(),
});
export type Preferences = z.infer<typeof Preferences>;

export const LessonProgress = z.object({
  lessonId: z.string(),
  courseId: z.string(),
  moduleId: z.string(),
  status: z.enum(['in_progress', 'completed']),
  completions: z.number().int().nonnegative(),
  bestScore: z.number().min(0).max(1),
  lastScore: z.number().min(0).max(1),
  perfect: z.boolean(),
  startedAt: ts,
  completedAt: ts.nullable(),
  lastPlayedAt: ts,
  lessonVersion: z.number().int().positive(),
  /** Session id of the last completion — guards against double-submits and replays. */
  lastSessionId: z.string().nullable(),
});
export type LessonProgress = z.infer<typeof LessonProgress>;

export const CourseProgress = z.object({
  courseId: z.string(),
  startedAt: ts,
  completedAt: ts.nullable(),
  lastLessonId: z.string().nullable(),
  lastPlayedAt: ts,
});
export type CourseProgress = z.infer<typeof CourseProgress>;

export const XPKind = z.enum([
  'lesson',
  'perfect',
  'module',
  'course',
  'daily',
  'review',
  'firstlesson',
  'replay',
]);
export type XPKind = z.infer<typeof XPKind>;

export const XPEvent = z.object({
  /** Deterministic unique id, e.g. `lesson:ship-1-1` — the primary key that prevents double awards. */
  id: z.string(),
  kind: XPKind,
  amount: z.number().int(),
  at: ts,
  day,
  ref: z.string().nullable(),
});
export type XPEvent = z.infer<typeof XPEvent>;

export const Attempt = z.object({
  id: z.string(),
  activityId: z.string(),
  lessonId: z.string().nullable(),
  concept: z.string(),
  correct: z.boolean(),
  score: z.number().min(0).max(1),
  at: ts,
  day,
  source: z.enum(['lesson', 'practice']),
});
export type Attempt = z.infer<typeof Attempt>;

export const ConceptStat = z.object({
  concept: z.string(),
  attempts: z.number().int().nonnegative(),
  correct: z.number().int().nonnegative(),
  /** Most recent results, newest last (max 10). */
  recent: z.array(z.boolean()).max(10),
  lastSeenAt: ts,
});
export type ConceptStat = z.infer<typeof ConceptStat>;

export const AchievementUnlock = z.object({ id: z.string(), unlockedAt: ts });
export type AchievementUnlock = z.infer<typeof AchievementUnlock>;

export const RatingSchema = z.enum(['again', 'hard', 'good', 'easy']);

export const FlashcardReview = z.object({
  cardId: z.string(),
  ease: z.number().min(1.3).max(3.5),
  interval: z.number().int().nonnegative(),
  reps: z.number().int().nonnegative(),
  lapses: z.number().int().nonnegative(),
  due: day,
  lastReviewedAt: ts,
  lastRating: RatingSchema,
  history: z.array(z.object({ at: ts, rating: RatingSchema })).max(30),
});
export type FlashcardReview = z.infer<typeof FlashcardReview>;

export const DailyActivity = z.object({
  day,
  seconds: z.number().nonnegative(),
  lessonsCompleted: z.number().int().nonnegative(),
  questionsAnswered: z.number().int().nonnegative(),
  correctAnswers: z.number().int().nonnegative(),
  cardsReviewed: z.number().int().nonnegative(),
  reviewSessions: z.number().int().nonnegative(),
  xp: z.number().int().nonnegative(),
  /** Did this day count toward the streak? */
  qualifying: z.boolean(),
  /** Daily challenge locked in for this day (so it can't change mid-day). */
  challengeId: z.string().nullable(),
});
export type DailyActivity = z.infer<typeof DailyActivity>;

export const SimulationRun = z.object({
  id: z.string(),
  simId: z.string(),
  startedAt: ts,
  finishedAt: ts,
  choices: z.record(z.string(), z.union([z.string(), z.number()])),
  finalCash: z.number(),
  totalRevenue: z.number(),
  totalProfit: z.number(),
  satisfaction: z.number(),
});
export type SimulationRun = z.infer<typeof SimulationRun>;

export function emptyDay(d: string): DailyActivity {
  return {
    day: d,
    seconds: 0,
    lessonsCompleted: 0,
    questionsAnswered: 0,
    correctAnswers: 0,
    cardsReviewed: 0,
    reviewSessions: 0,
    xp: 0,
    qualifying: false,
    challengeId: null,
  };
}
