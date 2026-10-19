import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';
import { defaultPrefs, defaultProfile } from '@/db/progression';
import type { DailyActivity, LessonProgress, Preferences, UserProfile } from '@/domain/records';
import { computeStreak, dayKey, weekOf, type DayKey } from '@/domain/dates';
import { levelFromXp } from '@/domain/levels';
import { totalXp } from '@/domain/xp';
import { challengeFor, challengeProgress } from '@/domain/daily';
import { unlockedCardIds } from '@/db/cards';
import { practiceAvailability } from '@/db/practice';

/** Live, typed read helpers. Everything the UI displays is derived from saved records. */

export function usePrefs(): Preferences | undefined {
  return useLiveQuery(async () => ((await db.meta.get('prefs')) as Preferences | undefined) ?? defaultPrefs(), []);
}

export function useProfile(): UserProfile | undefined {
  return useLiveQuery(async () => ((await db.meta.get('me')) as UserProfile | undefined) ?? defaultProfile(), []);
}

/** Today's calendar day in the learner's timezone; re-evaluates every minute (midnight rollover). */
export function useToday(): DayKey {
  const prefs = usePrefs();
  const tz = prefs?.timezone ?? 'UTC';
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    const onVis = () => document.visibilityState === 'visible' && setNow(Date.now());
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);
  return dayKey(now, tz);
}

export function useProgressMap(): Map<string, LessonProgress> | undefined {
  const rows = useLiveQuery(() => db.lessonProgress.toArray(), []);
  return useMemo(() => (rows ? new Map(rows.map((r) => [r.lessonId, r])) : undefined), [rows]);
}

export function useXp() {
  const xp = useLiveQuery(async () => totalXp(await db.xpEvents.toArray()), []);
  return useMemo(() => (xp === undefined ? undefined : levelFromXp(xp)), [xp]);
}

export function useDailyActivity(): DailyActivity[] | undefined {
  return useLiveQuery(() => db.dailyActivity.toArray(), []);
}

export function useStreak() {
  const days = useDailyActivity();
  const today = useToday();
  return useMemo(() => {
    if (!days) return undefined;
    const qualifying = days.filter((d) => d.qualifying).map((d) => d.day);
    const set = new Set(qualifying);
    const byDay = new Map(days.map((d) => [d.day, d]));
    return {
      ...computeStreak(qualifying, today),
      week: weekOf(today).map((d) => ({ day: d, active: set.has(d), isToday: d === today, future: d > today, minutes: Math.floor((byDay.get(d)?.seconds ?? 0) / 60) })),
    };
  }, [days, today]);
}

export function useTodayActivity() {
  const today = useToday();
  return useLiveQuery(() => db.dailyActivity.get(today), [today]);
}

export function useDailyChallenge() {
  const today = useToday();
  return useLiveQuery(async () => {
    const d = await db.dailyActivity.get(today);
    const hasCards = (await unlockedCardIds()).length > 0;
    const def = challengeFor(today, hasCards, d?.challengeId);
    const p = challengeProgress(def, d);
    const claimed = !!(await db.xpEvents.get(`daily:${today}`));
    return { def, ...p, claimed };
  }, [today]);
}

export function useAchievementUnlocks() {
  return useLiveQuery(() => db.achievements.orderBy('unlockedAt').reverse().toArray(), []);
}

export function usePracticeAvailability() {
  const today = useToday();
  // liveQuery re-runs automatically when any table it reads changes.
  return useLiveQuery(() => practiceAvailability(), [today]);
}

export function useCourseProgressRows() {
  return useLiveQuery(() => db.courseProgress.orderBy('lastPlayedAt').reverse().toArray(), []);
}
