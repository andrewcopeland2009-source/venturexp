import { beforeEach, describe, expect, it } from 'vitest';
import { VentureDB, setDatabase, db } from './db';
import { completeLesson, ensureDefaults, startLesson, updatePrefs, updateProfile } from './progression';
import { createBackup, importBackup, mergeData, parseBackup, summarize, backupFileName } from './backup';
import { lessonIndex } from '@/content';

let n = 0;
beforeEach(async () => {
  setDatabase(new VentureDB(`backup-${++n}`));
  await ensureDefaults();
  await updatePrefs({ timezone: 'UTC' });
});

const T0 = Date.UTC(2026, 9, 19, 12);
async function finish(id: string, sid: string, now = T0) {
  await startLesson(id, now);
  const outcomes = lessonIndex.get(id)!.lesson.activities.filter((a) => a.type !== 'flashcard').map((a) => ({ activityId: a.id, correct: true, score: 1 }));
  return completeLesson({ lessonId: id, sessionId: sid, outcomes, seconds: 100, now });
}

describe('backup validation', () => {
  it('round-trips a real export', async () => {
    await updateProfile({ nickname: 'Sam', onboarded: true });
    await finish('ship-1-1', 'b1');
    const backup = await createBackup();
    const parsed = parseBackup(JSON.stringify(backup));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(summarize(parsed.backup.data)).toMatchObject({ lessonsCompleted: 1, nickname: 'Sam', totalXp: 35 });
  });

  it('rejects junk, wrong apps, newer versions and bad shapes', async () => {
    expect(parseBackup('not json')).toMatchObject({ ok: false });
    expect(parseBackup('{"app":"other"}')).toMatchObject({ ok: false });
    const b = await createBackup();
    expect(parseBackup(JSON.stringify({ ...b, schemaVersion: 99 }))).toMatchObject({ ok: false });
    const broken = { ...b, data: { ...b.data, xpEvents: [{ id: 1 }] } };
    const r = parseBackup(JSON.stringify(broken));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/xpEvents/);
  });

  it('names files with a timestamp', () => {
    expect(backupFileName(new Date(2026, 9, 19, 8, 5))).toBe('venturexp-backup-2026-10-19-0805.json');
  });
});

describe('import', () => {
  it('replace restores exactly the backup', async () => {
    await finish('ship-1-1', 'r1');
    const backup = await createBackup();
    await finish('ship-1-2', 'r2');
    await importBackup(backup, 'replace');
    expect(await db.lessonProgress.count()).toBe(1);
    expect((await db.xpEvents.toArray()).reduce((s, e) => s + e.amount, 0)).toBe(35);
  });

  it('merge unions progress without double-counting XP', async () => {
    await finish('ship-1-1', 'm1');
    const a = await createBackup();
    await finish('ship-1-2', 'm2');
    const before = (await db.xpEvents.toArray()).reduce((s, e) => s + e.amount, 0);
    await importBackup(a, 'merge');
    const after = (await db.xpEvents.toArray()).reduce((s, e) => s + e.amount, 0);
    expect(after).toBe(before);
    expect(await db.lessonProgress.count()).toBe(2);
  });

  it('merge keeps the more advanced lesson record and max daily counters', () => {
    const base = {
      profile: null,
      preferences: null,
      courseProgress: [],
      xpEvents: [],
      attempts: [],
      concepts: [],
      achievements: [{ id: 'first-lesson', unlockedAt: 50 }],
      flashcards: [],
      simulationRuns: [],
    };
    const lp = (status: 'completed' | 'in_progress', bestScore: number) => ({
      lessonId: 'L',
      courseId: 'C',
      moduleId: 'M',
      status,
      completions: status === 'completed' ? 1 : 0,
      bestScore,
      lastScore: bestScore,
      perfect: false,
      startedAt: 10,
      completedAt: status === 'completed' ? 20 : null,
      lastPlayedAt: 30,
      lessonVersion: 1,
      lastSessionId: null,
    });
    const day = (lessons: number, q: number, qualifying: boolean) => ({
      day: '2026-10-19', seconds: 10, lessonsCompleted: lessons, questionsAnswered: q, correctAnswers: 0, cardsReviewed: 0, reviewSessions: 0, xp: 0, qualifying, challengeId: null,
    });
    const merged = mergeData(
      { ...base, lessonProgress: [lp('in_progress', 0.4)], dailyActivity: [day(0, 9, false)] },
      { ...base, achievements: [{ id: 'first-lesson', unlockedAt: 5 }], lessonProgress: [lp('completed', 0.8)], dailyActivity: [day(2, 3, true)] },
    );
    expect(merged.lessonProgress[0]).toMatchObject({ status: 'completed', bestScore: 0.8, completedAt: 20 });
    expect(merged.dailyActivity[0]).toMatchObject({ lessonsCompleted: 2, questionsAnswered: 9, qualifying: true });
    expect(merged.achievements[0].unlockedAt).toBe(5);
  });
});
