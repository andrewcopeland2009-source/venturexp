import { hashString } from './dates';

/** Seeded PRNG (mulberry32) so shuffles are reproducible per session. */
export function rng(seed: string | number): () => number {
  let a = typeof seed === 'number' ? seed >>> 0 : hashString(seed);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: readonly T[], seed: string | number): T[] {
  const out = [...items];
  const r = rng(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Shuffle indices 0..n-1, guaranteeing the result is not the identity order when n > 1. */
export function shuffledIndices(n: number, seed: string | number): number[] {
  const base = Array.from({ length: n }, (_, i) => i);
  let s = shuffle(base, seed);
  let k = 1;
  while (n > 1 && s.every((v, i) => v === i)) s = shuffle(base, `${seed}-${k++}`);
  return s;
}
