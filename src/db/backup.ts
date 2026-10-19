import { z } from 'zod';
import {
  AchievementUnlock,
  Attempt,
  ConceptStat,
  CourseProgress,
  DailyActivity,
  FlashcardReview,
  LessonProgress,
  Preferences,
  SimulationRun,
  UserProfile,
  XPEvent,
} from '@/domain/records';
import { CURRICULUM_VERSION } from '@/domain/content';
import { totalXp } from '@/domain/xp';
import { db } from './db';

export const BACKUP_APP = 'venturexp';
export const BACKUP_SCHEMA_VERSION = 1;

export const BackupSchema = z.object({
  app: z.literal(BACKUP_APP),
  schemaVersion: z.number().int().positive(),
  curriculumVersion: z.number().int().positive(),
  exportedAt: z.string(),
  data: z.object({
    profile: UserProfile.nullable(),
    preferences: Preferences.nullable(),
    lessonProgress: z.array(LessonProgress),
    courseProgress: z.array(CourseProgress),
    xpEvents: z.array(XPEvent),
    attempts: z.array(Attempt),
    concepts: z.array(ConceptStat),
    achievements: z.array(AchievementUnlock),
    flashcards: z.array(FlashcardReview),
    dailyActivity: z.array(DailyActivity),
    simulationRuns: z.array(SimulationRun),
  }),
});
export type Backup = z.infer<typeof BackupSchema>;
export type BackupData = Backup['data'];

export async function readAll(): Promise<BackupData> {
  const [profile, preferences] = await Promise.all([db.meta.get('me'), db.meta.get('prefs')]);
  return {
    profile: (profile as UserProfile | undefined) ?? null,
    preferences: (preferences as Preferences | undefined) ?? null,
    lessonProgress: await db.lessonProgress.toArray(),
    courseProgress: await db.courseProgress.toArray(),
    xpEvents: await db.xpEvents.toArray(),
    attempts: await db.attempts.toArray(),
    concepts: await db.concepts.toArray(),
    achievements: await db.achievements.toArray(),
    flashcards: await db.flashcards.toArray(),
    dailyActivity: await db.dailyActivity.toArray(),
    simulationRuns: await db.simulationRuns.toArray(),
  };
}

export async function createBackup(now = new Date()): Promise<Backup> {
  return {
    app: BACKUP_APP,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    curriculumVersion: CURRICULUM_VERSION,
    exportedAt: now.toISOString(),
    data: await readAll(),
  };
}

export function backupFileName(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `venturexp-backup-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}.json`;
}

export type ParseResult = { ok: true; backup: Backup } | { ok: false; error: string };

export function parseBackup(text: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: 'This file is not valid JSON.' };
  }
  if (!json || typeof json !== 'object' || (json as { app?: unknown }).app !== BACKUP_APP)
    return { ok: false, error: 'This doesn’t look like a VentureXP backup file.' };
  const v = (json as { schemaVersion?: unknown }).schemaVersion;
  if (typeof v === 'number' && v > BACKUP_SCHEMA_VERSION)
    return { ok: false, error: `This backup was made by a newer version of VentureXP (format v${v}). Update the app first.` };
  const parsed = BackupSchema.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: `The backup failed validation at “${first.path.join('.')}”: ${first.message}` };
  }
  return { ok: true, backup: parsed.data };
}

export interface BackupSummary {
  lessonsCompleted: number;
  totalXp: number;
  achievements: number;
  cards: number;
  activeDays: number;
  simulations: number;
  nickname: string;
}

export function summarize(d: BackupData): BackupSummary {
  return {
    lessonsCompleted: d.lessonProgress.filter((p) => p.status === 'completed').length,
    totalXp: totalXp(d.xpEvents),
    achievements: d.achievements.length,
    cards: d.flashcards.length,
    activeDays: d.dailyActivity.filter((x) => x.qualifying).length,
    simulations: d.simulationRuns.length,
    nickname: d.profile?.nickname ?? '',
  };
}

// ───────────── merge policy ─────────────
/**
 * MERGE POLICY (documented in the Backup screen):
 *  • XP events, attempts, simulation runs: union by id (ids are unique, so nothing is double-counted).
 *  • Lesson progress: keep the record with more progress (completed beats in-progress); then the
 *    higher best score, OR of perfect, max of completions, earliest start.
 *  • Course progress: earliest start, earliest completion, latest activity.
 *  • Achievements: union, keeping the earliest unlock time.
 *  • Flashcards: keep the card reviewed most recently.
 *  • Daily activity: per day, take the max of each counter; a day qualifies if either did.
 *  • Concept stats: keep the one seen most recently.
 *  • Profile & preferences: keep this device’s, but adopt the earlier join date and backup nickname
 *    if this device has none.
 */
export function mergeData(cur: BackupData, inc: BackupData): BackupData {
  const byKey = <T>(rows: T[], key: (r: T) => string) => new Map(rows.map((r) => [key(r), r]));
  function mergeRows<T>(a: T[], b: T[], key: (r: T) => string, pick: (x: T, y: T) => T): T[] {
    const m = byKey(a, key);
    for (const r of b) {
      const k = key(r);
      const e = m.get(k);
      m.set(k, e ? pick(e, r) : r);
    }
    return [...m.values()];
  }
  const keepFirst = <T>(x: T) => x;

  const profile =
    cur.profile && inc.profile
      ? {
          ...cur.profile,
          nickname: cur.profile.nickname || inc.profile.nickname,
          joinedAt: Math.min(cur.profile.joinedAt, inc.profile.joinedAt),
          onboarded: cur.profile.onboarded || inc.profile.onboarded,
        }
      : (cur.profile ?? inc.profile);

  return {
    profile,
    preferences: cur.preferences ?? inc.preferences,
    xpEvents: mergeRows(cur.xpEvents, inc.xpEvents, (r) => r.id, keepFirst),
    attempts: mergeRows(cur.attempts, inc.attempts, (r) => r.id, keepFirst),
    simulationRuns: mergeRows(cur.simulationRuns, inc.simulationRuns, (r) => r.id, keepFirst),
    lessonProgress: mergeRows(cur.lessonProgress, inc.lessonProgress, (r) => r.lessonId, (a, b) => {
      const rank = (p: LessonProgress) => (p.status === 'completed' ? 1 : 0);
      const [hi, lo] = rank(b) > rank(a) ? [b, a] : [a, b];
      return {
        ...hi,
        bestScore: Math.max(a.bestScore, b.bestScore),
        perfect: (a.perfect && a.status === 'completed') || (b.perfect && b.status === 'completed'),
        completions: Math.max(a.completions, b.completions),
        startedAt: Math.min(a.startedAt, b.startedAt),
        completedAt: [hi.completedAt, lo.completedAt].filter((x): x is number => x !== null).sort((x, y) => x - y)[0] ?? null,
        lastPlayedAt: Math.max(a.lastPlayedAt, b.lastPlayedAt),
      };
    }),
    courseProgress: mergeRows(cur.courseProgress, inc.courseProgress, (r) => r.courseId, (a, b) => ({
      courseId: a.courseId,
      startedAt: Math.min(a.startedAt, b.startedAt),
      completedAt: [a.completedAt, b.completedAt].filter((x): x is number => x !== null).sort((x, y) => x - y)[0] ?? null,
      lastLessonId: a.lastPlayedAt >= b.lastPlayedAt ? a.lastLessonId : b.lastLessonId,
      lastPlayedAt: Math.max(a.lastPlayedAt, b.lastPlayedAt),
    })),
    achievements: mergeRows(cur.achievements, inc.achievements, (r) => r.id, (a, b) => ({
      id: a.id,
      unlockedAt: Math.min(a.unlockedAt, b.unlockedAt),
    })),
    flashcards: mergeRows(cur.flashcards, inc.flashcards, (r) => r.cardId, (a, b) => (b.lastReviewedAt > a.lastReviewedAt ? b : a)),
    concepts: mergeRows(cur.concepts, inc.concepts, (r) => r.concept, (a, b) => (b.lastSeenAt > a.lastSeenAt ? b : a)),
    dailyActivity: mergeRows(cur.dailyActivity, inc.dailyActivity, (r) => r.day, (a, b) => ({
      day: a.day,
      seconds: Math.max(a.seconds, b.seconds),
      lessonsCompleted: Math.max(a.lessonsCompleted, b.lessonsCompleted),
      questionsAnswered: Math.max(a.questionsAnswered, b.questionsAnswered),
      correctAnswers: Math.max(a.correctAnswers, b.correctAnswers),
      cardsReviewed: Math.max(a.cardsReviewed, b.cardsReviewed),
      reviewSessions: Math.max(a.reviewSessions, b.reviewSessions),
      xp: Math.max(a.xp, b.xp),
      qualifying: a.qualifying || b.qualifying,
      challengeId: a.challengeId ?? b.challengeId,
    })),
  };
}

/** Write a full data set into the database, replacing everything (one transaction). */
export async function writeAll(data: BackupData): Promise<void> {
  await db.transaction(
    'rw',
    [db.meta, db.lessonProgress, db.courseProgress, db.xpEvents, db.attempts, db.concepts, db.achievements, db.flashcards, db.dailyActivity, db.simulationRuns],
    async () => {
      await Promise.all([
        db.meta.clear(),
        db.lessonProgress.clear(),
        db.courseProgress.clear(),
        db.xpEvents.clear(),
        db.attempts.clear(),
        db.concepts.clear(),
        db.achievements.clear(),
        db.flashcards.clear(),
        db.dailyActivity.clear(),
        db.simulationRuns.clear(),
      ]);
      if (data.profile) await db.meta.put(data.profile);
      if (data.preferences) await db.meta.put(data.preferences);
      await db.lessonProgress.bulkPut(data.lessonProgress);
      await db.courseProgress.bulkPut(data.courseProgress);
      await db.xpEvents.bulkPut(data.xpEvents);
      await db.attempts.bulkPut(data.attempts);
      await db.concepts.bulkPut(data.concepts);
      await db.achievements.bulkPut(data.achievements);
      await db.flashcards.bulkPut(data.flashcards);
      await db.dailyActivity.bulkPut(data.dailyActivity);
      await db.simulationRuns.bulkPut(data.simulationRuns);
    },
  );
}

export async function importBackup(backup: Backup, mode: 'replace' | 'merge'): Promise<void> {
  const data = mode === 'replace' ? backup.data : mergeData(await readAll(), backup.data);
  await writeAll(data);
}
