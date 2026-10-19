import type { DayKey } from './dates';
import type { XPEvent, XPKind } from './records';

/** Deterministic XP awards. Every award has a unique id so it can only ever be stored once. */
export const XP_RULES = {
  lesson: 20, // first completion of a lesson
  perfect: 10, // first perfect run of a lesson
  module: 75, // all lessons in a module completed
  course: 250, // all lessons in a course completed
  daily: 30, // daily challenge completed
  review: 10, // qualifying practice session (≥ 5 items)
  firstlesson: 5, // first lesson completed on a calendar day
  replay: 5, // re-completing a lesson you already finished
} as const satisfies Record<XPKind, number>;

/** Repeat-practice caps (per calendar day). */
export const XP_CAPS = {
  review: 3,
  replay: 5,
} as const;

export const XP_LABEL: Record<XPKind, string> = {
  lesson: 'Lesson complete',
  perfect: 'Perfect lesson',
  module: 'Module complete',
  course: 'Course complete',
  daily: 'Daily challenge',
  review: 'Practice session',
  firstlesson: 'First lesson today',
  replay: 'Lesson replay',
};

export const QUALIFYING_REVIEW_ITEMS = 5;

export const xpId = {
  lesson: (lessonId: string) => `lesson:${lessonId}`,
  perfect: (lessonId: string) => `perfect:${lessonId}`,
  module: (moduleId: string) => `module:${moduleId}`,
  course: (courseId: string) => `course:${courseId}`,
  daily: (day: DayKey) => `daily:${day}`,
  firstlesson: (day: DayKey) => `firstlesson:${day}`,
  review: (sessionId: string) => `review:${sessionId}`,
  replay: (sessionId: string) => `replay:${sessionId}`,
};

export function makeXpEvent(id: string, kind: XPKind, day: DayKey, at: number, ref: string | null = null): XPEvent {
  return { id, kind, amount: XP_RULES[kind], at, day, ref };
}

export function totalXp(events: Pick<XPEvent, 'amount'>[]): number {
  return events.reduce((s, e) => s + e.amount, 0);
}

/**
 * Pure award planner: given what already exists, return the events that should be added.
 * Used by the progression service inside a DB transaction.
 */
export function planAwards(
  candidates: XPEvent[],
  existingIds: Set<string>,
  countToday: (kind: XPKind) => number,
): XPEvent[] {
  const out: XPEvent[] = [];
  const added: Partial<Record<XPKind, number>> = {};
  for (const c of candidates) {
    if (existingIds.has(c.id) || out.some((o) => o.id === c.id)) continue;
    const cap = (XP_CAPS as Partial<Record<XPKind, number>>)[c.kind];
    if (cap !== undefined && countToday(c.kind) + (added[c.kind] ?? 0) >= cap) continue;
    added[c.kind] = (added[c.kind] ?? 0) + 1;
    out.push(c);
  }
  return out;
}
