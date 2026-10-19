import { addDays, type DayKey } from './dates';
import type { Rating } from './grading';
import type { FlashcardReview } from './records';

/**
 * Transparent spaced-repetition schedule (a simplified SM-2):
 *
 *  • Again — you forgot. Interval resets to 0 (due again today), ease −0.20.
 *  • Hard  — recalled with effort. Interval × 1.2 (at least 1 day), ease −0.15.
 *  • Good  — recalled. 1st review → 1 day, 2nd → 3 days, then interval × ease.
 *  • Easy  — effortless. Like Good × 1.3 (at least 4 days), ease +0.15.
 *
 * Ease starts at 2.5 and stays within 1.3–3.5. Intervals are capped at 180 days.
 */
export const SRS_RULES = [
  { rating: 'again', label: 'Again', text: 'Forgot it — see it again today. Interval resets.' },
  { rating: 'hard', label: 'Hard', text: 'Got it with effort — interval grows slowly (×1.2).' },
  { rating: 'good', label: 'Good', text: 'Recalled — 1 day, then 3 days, then interval × ease.' },
  { rating: 'easy', label: 'Easy', text: 'Effortless — jumps further ahead (×1.3 more).' },
] as const;

export const START_EASE = 2.5;
const MIN_EASE = 1.3;
const MAX_EASE = 3.5;
const MAX_INTERVAL = 180;

const clampEase = (e: number) => Math.min(MAX_EASE, Math.max(MIN_EASE, Math.round(e * 100) / 100));

export function newCard(cardId: string, today: DayKey): FlashcardReview {
  return {
    cardId,
    ease: START_EASE,
    interval: 0,
    reps: 0,
    lapses: 0,
    due: today,
    lastReviewedAt: 0,
    lastRating: 'good',
    history: [],
  };
}

export function schedule(card: FlashcardReview, rating: Rating, today: DayKey, now: number): FlashcardReview {
  let { ease, interval, reps, lapses } = card;
  switch (rating) {
    case 'again':
      ease = clampEase(ease - 0.2);
      interval = 0;
      reps = 0;
      lapses += 1;
      break;
    case 'hard':
      ease = clampEase(ease - 0.15);
      interval = Math.max(1, Math.round(interval * 1.2));
      reps += 1;
      break;
    case 'good':
      interval = reps === 0 ? 1 : reps === 1 ? 3 : Math.round(Math.max(1, interval) * ease);
      reps += 1;
      break;
    case 'easy':
      interval = Math.max(4, Math.round((reps === 0 ? 1 : reps === 1 ? 3 : Math.max(1, interval) * ease) * 1.3));
      ease = clampEase(ease + 0.15);
      reps += 1;
      break;
  }
  interval = Math.min(MAX_INTERVAL, interval);
  return {
    ...card,
    ease,
    interval,
    reps,
    lapses,
    due: addDays(today, interval),
    lastReviewedAt: now,
    lastRating: rating,
    history: [...card.history, { at: now, rating }].slice(-30),
  };
}

export function isDue(card: FlashcardReview | undefined, today: DayKey): boolean {
  return !card || card.due <= today;
}

/** Rough per-card retention estimate for display: share of non-Again ratings in history. */
export function cardAccuracy(card: FlashcardReview): number | null {
  if (!card.history.length) return null;
  return card.history.filter((h) => h.rating !== 'again').length / card.history.length;
}
