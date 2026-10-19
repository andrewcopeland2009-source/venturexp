/**
 * Level curve: XP needed to go from level L to L+1 = round(100 * L^1.35).
 * Cumulative threshold T(1) = 0, T(L+1) = T(L) + round(100 * L^1.35).
 */

export const MAX_LEVEL = 99;

export function xpToNext(level: number): number {
  return Math.round(100 * Math.pow(level, 1.35));
}

const thresholds: number[] = [0, 0]; // index = level; thresholds[1] = 0
for (let l = 1; l < MAX_LEVEL; l++) thresholds[l + 1] = thresholds[l] + xpToNext(l);

/** Total XP needed to *reach* `level`. */
export function thresholdFor(level: number): number {
  if (level <= 1) return 0;
  return thresholds[Math.min(level, MAX_LEVEL)];
}

export interface LevelInfo {
  level: number;
  totalXp: number;
  /** XP earned inside the current level. */
  intoLevel: number;
  /** XP span of the current level. */
  span: number;
  remaining: number;
  progress: number;
  title: string;
}

const TITLES: [number, string][] = [
  [1, 'Curious Starter'],
  [3, 'Side Hustler'],
  [5, 'Shop Builder'],
  [8, 'Margin Minder'],
  [11, 'Growth Tinkerer'],
  [15, 'Operator'],
  [20, 'Brand Builder'],
  [26, 'Strategist'],
  [33, 'Venture Pro'],
  [41, 'Empire Architect'],
];

export function levelTitle(level: number): string {
  let t = TITLES[0][1];
  for (const [min, title] of TITLES) if (level >= min) t = title;
  return t;
}

export function levelFromXp(totalXp: number): LevelInfo {
  const xp = Math.max(0, Math.floor(totalXp));
  let level = 1;
  while (level < MAX_LEVEL && thresholds[level + 1] <= xp) level++;
  const start = thresholdFor(level);
  const span = level < MAX_LEVEL ? xpToNext(level) : 0;
  const intoLevel = xp - start;
  return {
    level,
    totalXp: xp,
    intoLevel,
    span,
    remaining: span ? span - intoLevel : 0,
    progress: span ? intoLevel / span : 1,
    title: levelTitle(level),
  };
}
