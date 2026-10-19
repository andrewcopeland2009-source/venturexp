/**
 * Calendar-day helpers. A "day key" is YYYY-MM-DD in the learner's selected IANA timezone.
 * Day arithmetic is done on the key itself (anchored at UTC noon), so DST shifts can't
 * create or swallow a day.
 */

export type DayKey = string;

export function defaultTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();

export function dayKey(date: Date | number, timeZone: string): DayKey {
  const tz = isValidTimeZone(timeZone) ? timeZone : 'UTC';
  let fmt = fmtCache.get(tz);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
    fmtCache.set(tz, fmt);
  }
  const parts = fmt.formatToParts(typeof date === 'number' ? new Date(date) : date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function keyToUtcNoon(key: DayKey): number {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d, 12);
}

export function addDays(key: DayKey, n: number): DayKey {
  const t = keyToUtcNoon(key) + n * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

export function diffDays(a: DayKey, b: DayKey): number {
  return Math.round((keyToUtcNoon(a) - keyToUtcNoon(b)) / 86_400_000);
}

/** 0 = Sunday … 6 = Saturday, for a day key. */
export function weekday(key: DayKey): number {
  return new Date(keyToUtcNoon(key)).getUTCDay();
}

/** The 7 day keys of the Monday-started week containing `key`. */
export function weekOf(key: DayKey): DayKey[] {
  const offset = (weekday(key) + 6) % 7; // Monday = 0
  const monday = addDays(key, -offset);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export function formatDayKey(key: DayKey, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }): string {
  return new Date(keyToUtcNoon(key)).toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' });
}

export interface StreakInfo {
  current: number;
  longest: number;
  /** True if today already counts. */
  activeToday: boolean;
}

/**
 * Streak over qualifying day keys. The current streak stays alive through *today* if
 * yesterday qualified (you still have today to keep it going).
 */
export function computeStreak(qualifyingDays: Iterable<DayKey>, today: DayKey): StreakInfo {
  const set = new Set(qualifyingDays);
  const sorted = [...set].filter((k) => diffDays(k, today) <= 0).sort();
  let longest = 0;
  let run = 0;
  let prev: DayKey | null = null;
  for (const k of sorted) {
    run = prev && diffDays(k, prev) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = k;
  }
  const activeToday = set.has(today);
  let current = 0;
  let cursor = activeToday ? today : addDays(today, -1);
  while (set.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }
  return { current, longest, activeToday };
}

/** Small deterministic string hash (FNV-1a). */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
