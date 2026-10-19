import { describe, expect, it } from 'vitest';
import { makeXpEvent, planAwards, XP_RULES } from './xp';

describe('XP award planner', () => {
  const day = '2026-10-19';
  it('drops duplicates of existing ids and within the batch', () => {
    const a = makeXpEvent('lesson:x', 'lesson', day, 1);
    const out = planAwards([a, a, makeXpEvent('perfect:x', 'perfect', day, 1)], new Set(['perfect:x']), () => 0);
    expect(out.map((e) => e.id)).toEqual(['lesson:x']);
  });
  it('enforces per-day caps', () => {
    const c = [1, 2, 3, 4].map((i) => makeXpEvent(`review:${i}`, 'review', day, i));
    expect(planAwards(c, new Set(), () => 1)).toHaveLength(2);
  });
  it('uses the documented amounts', () => {
    expect(XP_RULES).toMatchObject({ lesson: 20, perfect: 10, module: 75, course: 250, daily: 30, review: 10, firstlesson: 5 });
  });
});
