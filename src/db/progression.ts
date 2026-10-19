import type { Activity } from '@/domain/content';
import { isGradedActivity } from '@/domain/content';
import type { GradeResult, Rating } from '@/domain/grading';
import { computeStreak, dayKey, defaultTimeZone, type DayKey } from '@/domain/dates';
import {
  emptyDay,
  type AchievementUnlock,
  type DailyActivity,
  type LessonProgress,
  type Preferences,
  type SimulationRun,
  type UserProfile,
  type XPEvent,
  type XPKind,
} from '@/domain/records';
import { makeXpEvent, planAwards, totalXp, xpId, QUALIFYING_REVIEW_ITEMS } from '@/domain/xp';
import { levelFromXp, type LevelInfo } from '@/domain/levels';
import { newlyEarned, type AchievementStats } from '@/domain/achievements';
import { challengeFor, challengeProgress } from '@/domain/daily';
import { CHECKPOINT_PASS, isDone, moduleDone, moduleMastered } from '@/domain/unlocks';
import { newCard, schedule } from '@/domain/srs';
import { lessonIndex, moduleIndex, courseById, courseLessons } from '@/content';
import { db, uid } from './db';
import { unlockedCardIds } from './cards';

/**
 * The progression service is the single source of truth for XP, streaks, unlocks and
 * achievements. Every mutation runs inside one IndexedDB transaction so a refresh can never
 * leave XP, progress and unlock state out of sync.
 */

// ───────────── defaults ─────────────

export function defaultProfile(now = Date.now()): UserProfile {
  return { id: 'me', nickname: '', avatar: 'rocket', joinedAt: now, onboarded: false };
}

export function defaultPrefs(): Preferences {
  return {
    id: 'prefs',
    interests: [],
    experience: 'beginner',
    goals: [],
    dailyGoalMinutes: 10,
    timezone: defaultTimeZone(),
    theme: 'dark',
    reducedMotion: 'system',
    backupReminders: true,
    lastBackupAt: null,
  };
}

export async function ensureDefaults(): Promise<void> {
  await db.transaction('rw', db.meta, async () => {
    if (!(await db.meta.get('me'))) await db.meta.put(defaultProfile());
    if (!(await db.meta.get('prefs'))) await db.meta.put(defaultPrefs());
  });
}

export async function getPrefs(): Promise<Preferences> {
  return ((await db.meta.get('prefs')) as Preferences | undefined) ?? defaultPrefs();
}

export async function getProfile(): Promise<UserProfile> {
  return ((await db.meta.get('me')) as UserProfile | undefined) ?? defaultProfile();
}

export async function updatePrefs(patch: Partial<Omit<Preferences, 'id'>>): Promise<void> {
  await db.transaction('rw', db.meta, async () => {
    const cur = await getPrefs();
    await db.meta.put({ ...cur, ...patch, id: 'prefs' });
  });
}

export async function updateProfile(patch: Partial<Omit<UserProfile, 'id'>>): Promise<void> {
  await db.transaction('rw', db.meta, async () => {
    const cur = await getProfile();
    await db.meta.put({ ...cur, ...patch, id: 'me' });
  });
}

export async function todayKey(now = Date.now()): Promise<DayKey> {
  return dayKey(now, (await getPrefs()).timezone);
}

// ───────────── shared internals ─────────────

const ALL = () => [
  db.meta,
  db.lessonProgress,
  db.courseProgress,
  db.xpEvents,
  db.attempts,
  db.concepts,
  db.achievements,
  db.flashcards,
  db.dailyActivity,
  db.simulationRuns,
];

async function getDay(day: DayKey): Promise<DailyActivity> {
  const d = await db.dailyActivity.get(day);
  if (d) return d;
  const fresh = emptyDay(day);
  const hasCards = (await unlockedCardIds()).length > 0;
  fresh.challengeId = challengeFor(day, hasCards).id;
  return fresh;
}

async function countKindOnDay(kind: XPKind, day: DayKey): Promise<number> {
  return db.xpEvents.where('day').equals(day).filter((e) => e.kind === kind).count();
}

/** Store award candidates that aren't duplicates or over cap; returns the ones actually added. */
async function award(candidates: XPEvent[], day: DayKey): Promise<XPEvent[]> {
  if (!candidates.length) return [];
  const existing = await db.xpEvents.bulkGet(candidates.map((c) => c.id));
  const existingIds = new Set(existing.filter(Boolean).map((e) => e!.id));
  const counts: Partial<Record<XPKind, number>> = {};
  for (const k of new Set(candidates.map((c) => c.kind))) counts[k] = await countKindOnDay(k, day);
  const toAdd = planAwards(candidates, existingIds, (k) => counts[k] ?? 0);
  if (toAdd.length) {
    await db.xpEvents.bulkAdd(toAdd);
    const d = await getDay(day);
    d.xp += totalXp(toAdd);
    await db.dailyActivity.put(d);
  }
  return toAdd;
}

export async function computeStats(today: DayKey): Promise<AchievementStats> {
  const [progress, courses, events, days, sims] = await Promise.all([
    db.lessonProgress.toArray(),
    db.courseProgress.toArray(),
    db.xpEvents.toArray(),
    db.dailyActivity.toArray(),
    db.simulationRuns.count(),
  ]);
  const map = new Map(progress.map((p) => [p.lessonId, p]));
  let masteredModules = 0;
  for (const { module } of moduleIndex.values())
    if (moduleMastered(module.lessons.map((l) => l.id), map)) masteredModules++;
  const done = progress.filter(isDone);
  return {
    lessonsCompleted: done.length,
    lessonCompletions: progress.reduce((n, p) => n + p.completions, 0),
    perfectLessons: done.filter((p) => p.perfect).length,
    coursesCompleted: courses.filter((c) => c.completedAt).length,
    masteredModules,
    longestStreak: computeStreak(days.filter((d) => d.qualifying).map((d) => d.day), today).longest,
    totalXp: totalXp(events),
    cardsReviewed: days.reduce((n, d) => n + d.cardsReviewed, 0),
    simulationsCompleted: sims,
    dailyChallenges: events.filter((e) => e.kind === 'daily').length,
    practiceSessions: days.reduce((n, d) => n + d.reviewSessions, 0),
  };
}

/** After any activity: check the daily challenge, then achievements. */
async function settle(day: DayKey, now: number): Promise<{ xp: XPEvent[]; achievements: string[] }> {
  const d = await getDay(day);
  const hasCards = (await unlockedCardIds()).length > 0;
  const ch = challengeFor(day, hasCards, d.challengeId);
  const xp: XPEvent[] = [];
  if (challengeProgress(ch, d).done) xp.push(...(await award([makeXpEvent(xpId.daily(day), 'daily', day, now, ch.id)], day)));
  const stats = await computeStats(day);
  const unlocked = new Set((await db.achievements.toArray()).map((a) => a.id));
  const fresh = newlyEarned(stats, unlocked);
  if (fresh.length) await db.achievements.bulkAdd(fresh.map<AchievementUnlock>((id) => ({ id, unlockedAt: now })));
  return { xp, achievements: fresh };
}

async function currentXp(): Promise<number> {
  return totalXp(await db.xpEvents.toArray());
}

const MAX_SECONDS_PER_LESSON = 30 * 60;

// ───────────── attempts ─────────────

export interface AttemptInput {
  activity: Activity;
  result: GradeResult;
  lessonId: string | null;
  source: 'lesson' | 'practice';
  now?: number;
}

/** Record one checked answer. Updates concept mastery and today's counters. */
export async function recordAttempt(input: AttemptInput): Promise<{ achievements: string[]; xp: XPEvent[] }> {
  const now = input.now ?? Date.now();
  return db.transaction('rw', ALL(), async () => {
    const day = await todayKey(now);
    const { activity, result } = input;
    await db.attempts.add({
      id: uid(),
      activityId: activity.id,
      lessonId: input.lessonId,
      concept: activity.concept,
      correct: result.correct,
      score: result.score,
      at: now,
      day,
      source: input.source,
    });
    const graded = isGradedActivity(activity);
    if (graded) {
      const c = (await db.concepts.get(activity.concept)) ?? {
        concept: activity.concept,
        attempts: 0,
        correct: 0,
        recent: [],
        lastSeenAt: now,
      };
      c.attempts += 1;
      if (result.correct) c.correct += 1;
      c.recent = [...c.recent, result.correct].slice(-10);
      c.lastSeenAt = now;
      await db.concepts.put(c);
    }
    const d = await getDay(day);
    if (graded) {
      d.questionsAnswered += 1;
      if (result.correct) d.correctAnswers += 1;
    }
    await db.dailyActivity.put(d);
    return settle(day, now);
  });
}

// ───────────── lessons ─────────────

export async function startLesson(lessonId: string, now = Date.now()): Promise<void> {
  const ref = lessonIndex.get(lessonId);
  if (!ref) throw new Error(`Unknown lesson ${lessonId}`);
  await db.transaction('rw', db.lessonProgress, db.courseProgress, async () => {
    const p = await db.lessonProgress.get(lessonId);
    if (!p)
      await db.lessonProgress.put({
        lessonId,
        courseId: ref.course.id,
        moduleId: ref.module.id,
        status: 'in_progress',
        completions: 0,
        bestScore: 0,
        lastScore: 0,
        perfect: false,
        startedAt: now,
        completedAt: null,
        lastPlayedAt: now,
        lessonVersion: ref.lesson.version,
        lastSessionId: null,
      });
    else await db.lessonProgress.update(lessonId, { lastPlayedAt: now });
    const cp = await db.courseProgress.get(ref.course.id);
    await db.courseProgress.put({
      courseId: ref.course.id,
      startedAt: cp?.startedAt ?? now,
      completedAt: cp?.completedAt ?? null,
      lastLessonId: lessonId,
      lastPlayedAt: now,
    });
  });
}

export interface ActivityOutcome {
  activityId: string;
  /** First-try result. */
  correct: boolean;
  score: number;
}

export interface LessonCompletionInput {
  lessonId: string;
  sessionId: string;
  outcomes: ActivityOutcome[];
  seconds: number;
  now?: number;
}

export interface LessonCompletionResult {
  lessonId: string;
  passed: boolean;
  score: number;
  perfect: boolean;
  correctCount: number;
  gradedCount: number;
  firstCompletion: boolean;
  xpEvents: XPEvent[];
  xpGained: number;
  levelBefore: LevelInfo;
  levelAfter: LevelInfo;
  achievements: string[];
  nextLessonId: string | null;
  unlockedNext: boolean;
  moduleCompleted: string | null;
  courseCompleted: string | null;
  streak: number;
  duplicate: boolean;
}

export function scoreOutcomes(outcomes: ActivityOutcome[]) {
  const gradedCount = outcomes.length;
  const correctCount = outcomes.filter((o) => o.correct).length;
  const score = gradedCount ? outcomes.reduce((s, o) => s + o.score, 0) / gradedCount : 1;
  return { gradedCount, correctCount, score, perfect: gradedCount > 0 && correctCount === gradedCount };
}

/** Finish a lesson: progress, XP, unlocks, streak and achievements in one transaction. */
export async function completeLesson(input: LessonCompletionInput): Promise<LessonCompletionResult> {
  const ref = lessonIndex.get(input.lessonId);
  if (!ref) throw new Error(`Unknown lesson ${input.lessonId}`);
  const now = input.now ?? Date.now();
  const { lesson, module, course } = ref;

  return db.transaction('rw', ALL(), async () => {
    const day = await todayKey(now);
    const xpBefore = await currentXp();
    const prev = await db.lessonProgress.get(lesson.id);
    const { gradedCount, correctCount, score, perfect } = scoreOutcomes(input.outcomes);
    const passed = !lesson.checkpoint || score >= CHECKPOINT_PASS - 1e-9;
    const wasDone = isDone(prev);
    const lessons = courseLessons(course);
    const nextLesson = lessons[ref.globalIndex + 1];
    const base = {
      lessonId: lesson.id,
      passed,
      score,
      perfect: passed && perfect,
      correctCount,
      gradedCount,
      nextLessonId: nextLesson?.id ?? null,
    };

    // Double-submit / replay of the same session: report without changing anything.
    if (prev?.lastSessionId === input.sessionId) {
      const lvl = levelFromXp(xpBefore);
      return {
        ...base,
        firstCompletion: false,
        xpEvents: [],
        xpGained: 0,
        levelBefore: lvl,
        levelAfter: lvl,
        achievements: [],
        unlockedNext: false,
        moduleCompleted: null,
        courseCompleted: null,
        streak: computeStreak((await db.dailyActivity.toArray()).filter((d) => d.qualifying).map((d) => d.day), day).current,
        duplicate: true,
      };
    }

    const progress: LessonProgress = {
      lessonId: lesson.id,
      courseId: course.id,
      moduleId: module.id,
      status: passed || wasDone ? 'completed' : 'in_progress',
      completions: (prev?.completions ?? 0) + (passed ? 1 : 0),
      bestScore: Math.max(prev?.bestScore ?? 0, score),
      lastScore: score,
      perfect: (prev?.perfect ?? false) || (passed && perfect),
      startedAt: prev?.startedAt ?? now,
      completedAt: passed ? (prev?.completedAt ?? now) : (prev?.completedAt ?? null),
      lastPlayedAt: now,
      lessonVersion: lesson.version,
      lastSessionId: input.sessionId,
    };
    await db.lessonProgress.put(progress);

    // Today's counters + streak qualification.
    const d = await getDay(day);
    d.seconds += Math.max(0, Math.min(input.seconds, MAX_SECONDS_PER_LESSON));
    if (passed) {
      d.lessonsCompleted += 1;
      d.qualifying = true;
    }
    await db.dailyActivity.put(d);

    // Module / course completion.
    const all = new Map((await db.lessonProgress.where('courseId').equals(course.id).toArray()).map((p) => [p.lessonId, p]));
    const modDone = passed && moduleDone(module.lessons.map((l) => l.id), all);
    const courseDone = passed && moduleDone(lessons.map((l) => l.id), all);
    const cp = await db.courseProgress.get(course.id);
    await db.courseProgress.put({
      courseId: course.id,
      startedAt: cp?.startedAt ?? now,
      completedAt: cp?.completedAt ?? (courseDone ? now : null),
      lastLessonId: lesson.id,
      lastPlayedAt: now,
    });

    // XP candidates (dedupe by id + caps happen in award()).
    const cands: XPEvent[] = [];
    if (passed) {
      if (!wasDone) cands.push(makeXpEvent(xpId.lesson(lesson.id), 'lesson', day, now, lesson.id));
      else cands.push(makeXpEvent(xpId.replay(input.sessionId), 'replay', day, now, lesson.id));
      if (perfect) cands.push(makeXpEvent(xpId.perfect(lesson.id), 'perfect', day, now, lesson.id));
      cands.push(makeXpEvent(xpId.firstlesson(day), 'firstlesson', day, now, lesson.id));
      if (modDone) cands.push(makeXpEvent(xpId.module(module.id), 'module', day, now, module.id));
      if (courseDone) cands.push(makeXpEvent(xpId.course(course.id), 'course', day, now, course.id));
    }
    const awarded = await award(cands, day);
    const settled = await settle(day, now);
    const xpEvents = [...awarded, ...settled.xp];
    const xpAfter = await currentXp();
    const days = await db.dailyActivity.toArray();

    return {
      ...base,
      firstCompletion: passed && !wasDone,
      xpEvents,
      xpGained: xpAfter - xpBefore,
      levelBefore: levelFromXp(xpBefore),
      levelAfter: levelFromXp(xpAfter),
      achievements: settled.achievements,
      unlockedNext: passed && !wasDone && !!nextLesson,
      moduleCompleted: awarded.some((e) => e.kind === 'module') ? module.id : null,
      courseCompleted: awarded.some((e) => e.kind === 'course') ? course.id : null,
      streak: computeStreak(days.filter((x) => x.qualifying).map((x) => x.day), day).current,
      duplicate: false,
    };
  });
}

// ───────────── practice ─────────────

export interface PracticeSessionInput {
  sessionId: string;
  mode: string;
  items: number;
  correct: number;
  seconds: number;
  now?: number;
}

export interface PracticeSessionResult {
  qualifying: boolean;
  xpEvents: XPEvent[];
  achievements: string[];
  capped: boolean;
}

/** Finish a practice session. ≥ 5 items qualifies for streak + review XP (max 3 awards/day). */
export async function completePracticeSession(input: PracticeSessionInput): Promise<PracticeSessionResult> {
  const now = input.now ?? Date.now();
  return db.transaction('rw', ALL(), async () => {
    const day = await todayKey(now);
    const qualifying = input.items >= QUALIFYING_REVIEW_ITEMS;
    const d = await getDay(day);
    d.seconds += Math.max(0, Math.min(input.seconds, MAX_SECONDS_PER_LESSON));
    if (qualifying) {
      d.reviewSessions += 1;
      d.qualifying = true;
    }
    await db.dailyActivity.put(d);
    const awarded = qualifying
      ? await award([makeXpEvent(xpId.review(input.sessionId), 'review', day, now, input.mode)], day)
      : [];
    const settled = await settle(day, now);
    return {
      qualifying,
      xpEvents: [...awarded, ...settled.xp],
      achievements: settled.achievements,
      capped: qualifying && awarded.length === 0,
    };
  });
}

/** Rate one flashcard and reschedule it. */
export async function reviewCard(cardId: string, rating: Rating, now = Date.now()): Promise<{ achievements: string[]; xp: XPEvent[] }> {
  return db.transaction('rw', ALL(), async () => {
    const day = await todayKey(now);
    const card = (await db.flashcards.get(cardId)) ?? newCard(cardId, day);
    await db.flashcards.put(schedule(card, rating, day, now));
    const d = await getDay(day);
    d.cardsReviewed += 1;
    await db.dailyActivity.put(d);
    return settle(day, now);
  });
}

// ───────────── simulation ─────────────

export async function saveSimulationRun(run: Omit<SimulationRun, 'id'>, now = Date.now()): Promise<{ achievements: string[] }> {
  return db.transaction('rw', ALL(), async () => {
    const day = await todayKey(now);
    await db.simulationRuns.add({ ...run, id: uid() });
    const s = await settle(day, now);
    return { achievements: s.achievements };
  });
}

// ───────────── reset ─────────────

/** Wipe all learning progress. Keeps nothing except a fresh default profile/preferences. */
export async function resetAllProgress(): Promise<void> {
  await db.transaction('rw', ALL(), async () => {
    await Promise.all(ALL().map((t) => t.clear()));
  });
  await ensureDefaults();
}

export { courseById };
