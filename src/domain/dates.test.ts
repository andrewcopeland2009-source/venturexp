import { describe, expect, it } from 'vitest';
import { addDays, computeStreak, dayKey, diffDays, weekOf } from './dates';

describe('day keys', () => {
  it('uses the selected timezone, not UTC', () => {
    // 2026-03-10 03:30 UTC is still March 9 in New York.
    const t = Date.UTC(2026, 2, 10, 3, 30);
    expect(dayKey(t, 'UTC')).toBe('2026-03-10');
    expect(dayKey(t, 'America/New_York')).toBe('2026-03-09');
    expect(dayKey(t, 'Asia/Tokyo')).toBe('2026-03-10');
  });

  it('adds days across DST changes without skipping', () => {
    // US DST starts 2026-03-08; Europe 2026-03-29; both should step exactly one calendar day.
    expect(addDays('2026-03-07', 1)).toBe('2026-03-08');
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30');
    expect(addDays('2026-11-01', -1)).toBe('2026-10-31');
    expect(diffDays('2026-03-09', '2026-03-07')).toBe(2);
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('a late-night session and an early-morning session on consecutive local days count as 2 days', () => {
    const tz = 'America/Los_Angeles';
    const night = Date.UTC(2026, 6, 2, 6, 50); // Jul 1, 23:50 PDT
    const morning = Date.UTC(2026, 6, 2, 7, 10); // Jul 2, 00:10 PDT — only 20 minutes later
    expect(dayKey(night, tz)).toBe('2026-07-01');
    expect(dayKey(morning, tz)).toBe('2026-07-02');
  });

  it('two sessions 23 hours apart on the same local day are one day', () => {
    const tz = 'Europe/London';
    const a = Date.UTC(2026, 0, 5, 0, 10);
    const b = Date.UTC(2026, 0, 5, 23, 10);
    expect(dayKey(a, tz)).toBe(dayKey(b, tz));
  });

  it('weekOf returns Monday..Sunday', () => {
    const w = weekOf('2026-10-21'); // Wednesday
    expect(w[0]).toBe('2026-10-19');
    expect(w[6]).toBe('2026-10-25');
  });
});

describe('streaks', () => {
  it('counts consecutive calendar days ending today', () => {
    const s = computeStreak(['2026-10-17', '2026-10-18', '2026-10-19'], '2026-10-19');
    expect(s).toEqual({ current: 3, longest: 3, activeToday: true });
  });

  it('keeps the streak alive through today if yesterday counted', () => {
    const s = computeStreak(['2026-10-17', '2026-10-18'], '2026-10-19');
    expect(s.current).toBe(2);
    expect(s.activeToday).toBe(false);
  });

  it('resets after a missed day but remembers the longest', () => {
    const s = computeStreak(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-17'], '2026-10-19');
    expect(s.current).toBe(0);
    expect(s.longest).toBe(4);
  });

  it('ignores duplicate and future days', () => {
    const s = computeStreak(['2026-10-19', '2026-10-19', '2026-10-25'], '2026-10-19');
    expect(s.current).toBe(1);
    expect(s.longest).toBe(1);
  });

  it('spans DST transitions', () => {
    const s = computeStreak(['2026-03-07', '2026-03-08', '2026-03-09'], '2026-03-09');
    expect(s.current).toBe(3);
  });
});
