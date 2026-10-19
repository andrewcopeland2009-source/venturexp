import { beforeEach, describe, expect, it } from 'vitest';
import { VentureDB, setDatabase, db } from './db';
import {
  completeLesson,
  completePracticeSession,
  ensureDefaults,
  recordAttempt,
  reviewCard,
  startLesson,
  updatePrefs,
  type ActivityOutcome,
} from './progression';
import { lessonIndex, courseLessons, courseById } from '@/content';
import { lessonStates } from '@/domain/unlocks';
import { grade } from '@/domain/grading';
import { XP_RULES, totalXp } from '@/domain/xp';
import { unlockedCardIds } from './cards';
import { buildSession } from './practice';

let n = 0;
beforeEach(async () => {
  setDatabase(new VentureDB(`test-${++n}`));
  await ensureDefaults();
  await updatePrefs({ timezone: 'UTC' });
});

const T0 = Date.UTC(2026, 9, 19, 12); // 2026-10-19 noon UTC
const DAY = 86_400_000;

function perfectOutcomes(lessonId: string): ActivityOutcome[] {
  return lessonIndex
    .get(lessonId)!
    .lesson.activities.filter((a) => a.type !== 'flashcard')
    .map((a) => ({ activityId: a.id, correct: true, score: 1 }));
}

function failingOutcomes(lessonId: string): ActivityOutcome[] {
  return perfectOutcomes(lessonId).map((o) => ({ ...o, correct: false, score: 0 }));
}

async function finish(lessonId: string, sessionId: string, now = T0, outcomes = perfectOutcomes(lessonId)) {
  await startLesson(lessonId, now);
  return completeLesson({ lessonId, sessionId, outcomes, seconds: 240, now });
}

async function progressMap() {
  return new Map((await db.lessonProgress.toArray()).map((p) => [p.lessonId, p]));
}

describe('XP idempotency', () => {
  it('awards lesson + perfect + first-of-day XP once', async () => {
    const r = await finish('ship-1-1', 's1');
    expect(r.passed).toBe(true);
    expect(r.firstCompletion).toBe(true);
    const kinds = r.xpEvents.map((e) => e.kind).sort();
    expect(kinds).toEqual(['firstlesson', 'lesson', 'perfect']);
    expect(r.xpGained).toBe(XP_RULES.lesson + XP_RULES.perfect + XP_RULES.firstlesson);
  });

  it('re-submitting the same session (refresh/double tap) awards nothing', async () => {
    const r1 = await finish('ship-1-1', 'same');
    const r2 = await completeLesson({ lessonId: 'ship-1-1', sessionId: 'same', outcomes: perfectOutcomes('ship-1-1'), seconds: 1, now: T0 + 1000 });
    expect(r2.duplicate).toBe(true);
    expect(r2.xpGained).toBe(0);
    expect(totalXp(await db.xpEvents.toArray())).toBe(r1.xpGained);
    expect((await db.lessonProgress.get('ship-1-1'))!.completions).toBe(1);
  });

  it('replaying a completed lesson gives capped replay XP only', async () => {
    await finish('ship-1-1', 'a');
    const gains: number[] = [];
    for (let i = 0; i < 7; i++) {
      const r = await finish('ship-1-1', `replay-${i}`, T0 + (i + 1) * 1000);
      expect(r.xpEvents.every((e) => e.kind === 'replay' || e.kind === 'daily')).toBe(true);
      gains.push(r.xpEvents.filter((e) => e.kind === 'replay').reduce((s, e) => s + e.amount, 0));
    }
    // 5 replays per day earn XP_RULES.replay; the rest earn 0. No second lesson/perfect award.
    expect(gains).toEqual([5, 5, 5, 5, 5, 0, 0]);
    const ids = (await db.xpEvents.toArray()).map((e) => e.id);
    expect(ids.filter((id) => id === 'lesson:ship-1-1')).toHaveLength(1);
    expect(ids.filter((id) => id === 'perfect:ship-1-1')).toHaveLength(1);
  });

  it('first-lesson-of-day bonus is once per calendar day', async () => {
    await finish('ship-1-1', 'd1');
    const same = await finish('ship-1-2', 'd1b', T0 + 1000);
    expect(same.xpEvents.some((e) => e.kind === 'firstlesson')).toBe(false);
    const next = await finish('ship-1-3', 'd2', T0 + DAY);
    expect(next.xpEvents.some((e) => e.kind === 'firstlesson')).toBe(true);
  });

  it('a perfect bonus earned later is still only awarded once', async () => {
    const outcomes = perfectOutcomes('ship-1-1');
    outcomes[0] = { ...outcomes[0], correct: false, score: 0 };
    const r1 = await finish('ship-1-1', 'imperfect', T0, outcomes);
    expect(r1.perfect).toBe(false);
    const r2 = await finish('ship-1-1', 'perfect', T0 + 1000);
    expect(r2.xpEvents.map((e) => e.kind)).toContain('perfect');
    const r3 = await finish('ship-1-1', 'perfect-again', T0 + 2000);
    expect(r3.xpEvents.map((e) => e.kind)).not.toContain('perfect');
  });

  it('practice sessions: ≥5 items earn review XP, capped at 3 per day', async () => {
    const small = await completePracticeSession({ sessionId: 'p0', mode: 'quick', items: 3, correct: 3, seconds: 60, now: T0 });
    expect(small.qualifying).toBe(false);
    expect(small.xpEvents).toHaveLength(0);
    const xs: number[] = [];
    for (let i = 1; i <= 5; i++) {
      const r = await completePracticeSession({ sessionId: `p${i}`, mode: 'quick', items: 8, correct: 6, seconds: 60, now: T0 + i });
      xs.push(r.xpEvents.filter((e) => e.kind === 'review').length);
    }
    expect(xs).toEqual([1, 1, 1, 0, 0]);
  });
});

describe('lesson unlocks', () => {
  it('completing a lesson unlocks the next, and state persists in the DB', async () => {
    const course = courseById.get('shipping-terminology')!;
    let states = lessonStates(course, await progressMap());
    expect(states.get('ship-1-1')).toBe('available');
    expect(states.get('ship-1-2')).toBe('locked');
    const r = await finish('ship-1-1', 'u1');
    expect(r.unlockedNext).toBe(true);
    expect(r.nextLessonId).toBe('ship-1-2');
    states = lessonStates(course, await progressMap());
    expect(states.get('ship-1-1')).toBe('mastered');
    expect(states.get('ship-1-2')).toBe('available');
    expect(states.get('ship-1-3')).toBe('locked');
  });

  it('a failed checkpoint does not unlock the next module', async () => {
    for (const id of ['ship-1-1', 'ship-1-2', 'ship-1-3', 'ship-1-4']) await finish(id, `s-${id}`);
    const fail = await finish('ship-1-5', 'cp-fail', T0, failingOutcomes('ship-1-5'));
    expect(fail.passed).toBe(false);
    expect(fail.xpGained).toBe(0);
    const course = courseById.get('shipping-terminology')!;
    let states = lessonStates(course, await progressMap());
    expect(states.get('ship-1-5')).toBe('in_progress');
    expect(states.get('ship-2-1')).toBe('locked');
    const pass = await finish('ship-1-5', 'cp-pass');
    expect(pass.passed).toBe(true);
    expect(pass.moduleCompleted).toBe('ship-m1');
    expect(pass.xpEvents.map((e) => e.kind)).toContain('module');
    states = lessonStates(course, await progressMap());
    expect(states.get('ship-2-1')).toBe('available');
  });

  it('awards course completion once when every lesson is done', async () => {
    const course = courseById.get('shipping-terminology')!;
    let last;
    for (const l of courseLessons(course)) last = await finish(l.id, `c-${l.id}`);
    expect(last!.courseCompleted).toBe('shipping-terminology');
    const ev = await db.xpEvents.toArray();
    expect(ev.filter((e) => e.kind === 'course')).toHaveLength(1);
    expect(ev.filter((e) => e.kind === 'module')).toHaveLength(3);
    expect((await db.courseProgress.get('shipping-terminology'))!.completedAt).not.toBeNull();
    const ach = (await db.achievements.toArray()).map((a) => a.id);
    expect(ach).toContain('course-1');
    expect(ach).toContain('first-lesson');
    expect(ach).toContain('perfect-1');
  });
});

describe('streaks, daily stats and challenges', () => {
  it('counts calendar days in the selected timezone', async () => {
    await updatePrefs({ timezone: 'America/New_York' });
    // 03:00 UTC on Oct 20 is still Oct 19 in New York.
    await finish('ship-1-1', 'tz1', Date.UTC(2026, 9, 20, 3));
    const days = (await db.dailyActivity.toArray()).map((d) => d.day);
    expect(days).toEqual(['2026-10-19']);
  });

  it('records attempts and concept mastery', async () => {
    const a = lessonIndex.get('ship-1-1')!.lesson.activities[0];
    await recordAttempt({ activity: a, result: grade(a, { type: 'mcq', choice: 1 }), lessonId: 'ship-1-1', source: 'lesson', now: T0 });
    await recordAttempt({ activity: a, result: grade(a, { type: 'mcq', choice: 0 }), lessonId: 'ship-1-1', source: 'lesson', now: T0 + 1 });
    const c = await db.concepts.get(a.concept);
    expect(c).toMatchObject({ attempts: 2, correct: 1, recent: [false, true] });
    const d = await db.dailyActivity.get('2026-10-19');
    expect(d).toMatchObject({ questionsAnswered: 2, correctAnswers: 1 });
  });

  it('locks the daily challenge for the day', async () => {
    await finish('ship-1-1', 'x');
    const d = await db.dailyActivity.get('2026-10-19');
    expect(d?.challengeId).toBeTruthy();
  });
});

describe('flashcards & practice from completed content', () => {
  it('cards unlock only from completed lessons and can be reviewed', async () => {
    expect(await unlockedCardIds()).toEqual([]);
    await finish('ship-1-1', 'f1');
    const cards = await unlockedCardIds();
    expect(cards).toContain('term:carrier');
    await reviewCard('term:carrier', 'good', T0);
    const row = await db.flashcards.get('term:carrier');
    expect(row?.due).toBe('2026-10-20');
    expect((await db.achievements.toArray()).map((a) => a.id)).toContain('cards-1');
  });

  it('practice sessions only use completed lessons', async () => {
    expect(await buildSession('quick', 'seed')).toEqual([]);
    await finish('ship-1-1', 'q1');
    const items = await buildSession('quick', 'seed');
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.lessonId === 'ship-1-1')).toBe(true);
    expect(new Set(items.map((i) => i.activity.id)).size).toBe(items.length);
  });
});
