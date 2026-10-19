import { describe, expect, it } from 'vitest';
import { levelFromXp, thresholdFor, xpToNext } from './levels';

describe('level curve', () => {
  it('uses round(100 * L^1.35) per level', () => {
    expect(xpToNext(1)).toBe(100);
    expect(xpToNext(2)).toBe(Math.round(100 * 2 ** 1.35)); // 255
    expect(xpToNext(10)).toBe(Math.round(100 * 10 ** 1.35));
  });

  it('builds cumulative thresholds consistently', () => {
    expect(thresholdFor(1)).toBe(0);
    expect(thresholdFor(2)).toBe(100);
    expect(thresholdFor(3)).toBe(100 + xpToNext(2));
    for (let l = 1; l < 50; l++) expect(thresholdFor(l + 1) - thresholdFor(l)).toBe(xpToNext(l));
  });

  it('maps XP to level at exact boundaries', () => {
    expect(levelFromXp(0).level).toBe(1);
    expect(levelFromXp(99).level).toBe(1);
    expect(levelFromXp(100).level).toBe(2);
    const t5 = thresholdFor(5);
    expect(levelFromXp(t5 - 1).level).toBe(4);
    expect(levelFromXp(t5).level).toBe(5);
  });

  it('reports progress within a level', () => {
    const info = levelFromXp(150);
    expect(info.level).toBe(2);
    expect(info.intoLevel).toBe(50);
    expect(info.span).toBe(xpToNext(2));
    expect(info.remaining).toBe(xpToNext(2) - 50);
    expect(info.progress).toBeCloseTo(50 / xpToNext(2));
    expect(info.title).toBeTruthy();
  });

  it('never goes negative', () => {
    expect(levelFromXp(-50).totalXp).toBe(0);
  });
});
