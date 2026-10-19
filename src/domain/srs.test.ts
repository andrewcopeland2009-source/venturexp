import { describe, expect, it } from 'vitest';
import { isDue, newCard, schedule } from './srs';

const T = '2026-10-19';

describe('spaced repetition', () => {
  it('Good: 1 day, then 3 days, then interval × ease', () => {
    let c = newCard('term:moq', T);
    c = schedule(c, 'good', T, 1);
    expect(c.interval).toBe(1);
    expect(c.due).toBe('2026-10-20');
    c = schedule(c, 'good', c.due, 2);
    expect(c.interval).toBe(3);
    c = schedule(c, 'good', c.due, 3);
    expect(c.interval).toBe(Math.round(3 * 2.5));
  });

  it('Again resets interval, records a lapse and lowers ease', () => {
    let c = schedule(newCard('x', T), 'good', T, 1);
    c = schedule(c, 'again', T, 2);
    expect(c.interval).toBe(0);
    expect(c.due).toBe(T);
    expect(c.lapses).toBe(1);
    expect(c.ease).toBeCloseTo(2.3);
  });

  it('Hard grows slowly and lowers ease; Easy jumps ahead and raises ease', () => {
    const h = schedule(newCard('x', T), 'hard', T, 1);
    expect(h.interval).toBe(1);
    expect(h.ease).toBeCloseTo(2.35);
    const e = schedule(newCard('x', T), 'easy', T, 1);
    expect(e.interval).toBe(4);
    expect(e.ease).toBeCloseTo(2.65);
  });

  it('clamps ease at 1.3', () => {
    let c = newCard('x', T);
    for (let i = 0; i < 20; i++) c = schedule(c, 'again', T, i);
    expect(c.ease).toBe(1.3);
  });

  it('caps interval and history length', () => {
    let c = newCard('x', T);
    for (let i = 0; i < 40; i++) c = schedule(c, 'easy', c.due, i);
    expect(c.interval).toBeLessThanOrEqual(180);
    expect(c.history.length).toBe(30);
  });

  it('due logic: unseen cards are due; future cards are not', () => {
    expect(isDue(undefined, T)).toBe(true);
    const c = schedule(newCard('x', T), 'good', T, 1);
    expect(isDue(c, T)).toBe(false);
    expect(isDue(c, '2026-10-20')).toBe(true);
  });
});
