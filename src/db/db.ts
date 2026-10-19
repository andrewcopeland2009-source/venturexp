import Dexie, { type DexieOptions, type EntityTable } from 'dexie';
import type {
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

/** Key-value table for profile + preferences (single rows keyed by id). */
export type MetaRow = UserProfile | Preferences;

export class VentureDB extends Dexie {
  meta!: EntityTable<MetaRow, 'id'>;
  lessonProgress!: EntityTable<LessonProgress, 'lessonId'>;
  courseProgress!: EntityTable<CourseProgress, 'courseId'>;
  xpEvents!: EntityTable<XPEvent, 'id'>;
  attempts!: EntityTable<Attempt, 'id'>;
  concepts!: EntityTable<ConceptStat, 'concept'>;
  achievements!: EntityTable<AchievementUnlock, 'id'>;
  flashcards!: EntityTable<FlashcardReview, 'cardId'>;
  dailyActivity!: EntityTable<DailyActivity, 'day'>;
  simulationRuns!: EntityTable<SimulationRun, 'id'>;

  constructor(name = 'venturexp', options?: DexieOptions) {
    super(name, options);
    this.version(1).stores({
      meta: 'id',
      lessonProgress: 'lessonId, courseId, moduleId, status, lastPlayedAt',
      courseProgress: 'courseId, lastPlayedAt',
      xpEvents: 'id, kind, day, at',
      attempts: 'id, activityId, lessonId, concept, day, at',
      concepts: 'concept, lastSeenAt',
      achievements: 'id, unlockedAt',
      flashcards: 'cardId, due',
      dailyActivity: 'day',
      simulationRuns: 'id, simId, finishedAt',
    });
  }
}

export let db = new VentureDB();

/** Test hook: point the app at a fresh database. */
export function setDatabase(next: VentureDB) {
  db = next;
}

export const ALL_TABLES = [
  'meta',
  'lessonProgress',
  'courseProgress',
  'xpEvents',
  'attempts',
  'concepts',
  'achievements',
  'flashcards',
  'dailyActivity',
  'simulationRuns',
] as const;
export type TableName = (typeof ALL_TABLES)[number];

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Ask the browser not to evict our data under storage pressure (best effort). */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    /* ignore */
  }
  return false;
}
