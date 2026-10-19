import type { Activity, ActivityOf } from './content';

export type Rating = 'again' | 'hard' | 'good' | 'easy';

export type ActivityResponse =
  | { type: 'mcq'; choice: number }
  | { type: 'truefalse'; value: boolean }
  /** pairs[termIndex] = index of the definition (original pair index) chosen for that term */
  | { type: 'match'; pairs: number[] }
  | { type: 'fillblank'; text: string }
  /** order = original step indices in the order the learner arranged them */
  | { type: 'order'; order: number[] }
  | { type: 'scenario'; choice: number }
  | { type: 'flashcard'; rating: Rating }
  | { type: 'numeric'; value: string }
  | { type: 'spotmistake'; line: number }
  | { type: 'strategy'; choice: number }
  | { type: 'recall'; text: string }
  | { type: 'casestudy'; answers: number[] };

export interface GradeResult {
  correct: boolean;
  /** 0..1 partial credit (matching, ordering, case studies). */
  score: number;
  /** Feedback specific to what the learner answered. */
  feedback: string;
  /** Human-readable correct answer, revealed only after checking. */
  correctAnswer?: string;
  /** Extra per-part feedback (case study sub-questions). */
  parts?: { correct: boolean; feedback: string }[];
  /** Accepted, but with a small spelling slip. */
  nearMiss?: boolean;
}

// ---------- text normalization ----------

export function normalizeText(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’'`"]/g, '')
    .replace(/[^a-z0-9%.\s/-]/g, ' ')
    .replace(/[-/]/g, ' ')
    .replace(/\.(?!\d)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(a|an|the) /, '');
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Exact (normalized) match, or a one-letter slip for answers of 5+ characters. */
export function matchText(input: string, accept: string[]): { ok: boolean; nearMiss: boolean } {
  const n = normalizeText(input);
  if (!n) return { ok: false, nearMiss: false };
  const targets = accept.map(normalizeText);
  if (targets.includes(n)) return { ok: true, nearMiss: false };
  const compact = n.replace(/\s/g, '');
  if (targets.some((t) => t.replace(/\s/g, '') === compact)) return { ok: true, nearMiss: false };
  const near = targets.some((t) => t.length >= 5 && levenshtein(n, t) <= (t.length >= 10 ? 2 : 1));
  return { ok: near, nearMiss: near };
}

// ---------- numbers ----------

/** Parses "$1,234.50", "12%", "1 234", "-5", "3.5 lb" → number. Returns null if not a number. */
export function parseNumber(input: string): number | null {
  const cleaned = input
    .trim()
    .replace(/[$€£¥]|usd|eur|gbp|lbs?|kg|days?|units?/gi, '')
    .replace(/%/g, '')
    .replace(/,(?=\d{3}(\D|$))/g, '')
    .replace(/\s+/g, '');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function formatValue(n: number, unit: ActivityOf<'numeric'>['unit'], currency = 'USD'): string {
  switch (unit) {
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
        maximumFractionDigits: 2,
      }).format(n);
    case 'percent':
      return `${+n.toFixed(2)}%`;
    case 'lb':
      return `${+n.toFixed(2)} lb`;
    case 'kg':
      return `${+n.toFixed(2)} kg`;
    case 'days':
      return `${+n.toFixed(2)} days`;
    case 'units':
      return `${+n.toFixed(2)} units`;
    default:
      return `${+n.toFixed(4)}`;
  }
}

export function withinTolerance(value: number, answer: number, tolerance: number): boolean {
  return Math.abs(value - answer) <= tolerance + 1e-9;
}

// ---------- grading ----------

const ok = (feedback: string, extra: Partial<GradeResult> = {}): GradeResult => ({
  correct: true,
  score: 1,
  feedback,
  ...extra,
});
const no = (feedback: string, extra: Partial<GradeResult> = {}): GradeResult => ({
  correct: false,
  score: 0,
  feedback,
  ...extra,
});

export function grade(activity: Activity, response: ActivityResponse): GradeResult {
  if (activity.type !== response.type) throw new Error(`Response type ${response.type} ≠ ${activity.type}`);
  switch (activity.type) {
    case 'mcq':
    case 'scenario': {
      const r = response as { choice: number };
      const chosen = activity.options[r.choice];
      const right = activity.options[activity.answer];
      if (!chosen) return no('Pick an answer first.');
      return r.choice === activity.answer
        ? ok(chosen.feedback)
        : no(chosen.feedback, { correctAnswer: right.text });
    }
    case 'truefalse': {
      const r = response as { value: boolean };
      const correctAnswer = activity.answer ? 'True' : 'False';
      return r.value === activity.answer
        ? ok(`Yes — it's ${correctAnswer.toLowerCase()}.`)
        : no(`This one is actually ${correctAnswer.toLowerCase()}.`, { correctAnswer });
    }
    case 'match': {
      const r = response as { pairs: number[] };
      const n = activity.pairs.length;
      let right = 0;
      for (let i = 0; i < n; i++) if (r.pairs[i] === i) right++;
      const score = right / n;
      const correctAnswer = activity.pairs.map((p) => `${p.term} → ${p.definition}`).join('\n');
      return right === n
        ? ok('All pairs matched correctly.')
        : { correct: false, score, feedback: `${right} of ${n} pairs matched. Compare the correct pairs below.`, correctAnswer };
    }
    case 'fillblank':
    case 'recall': {
      const r = response as { text: string };
      const m = matchText(r.text, activity.accept);
      if (m.ok)
        return ok(m.nearMiss ? `Accepted — watch the spelling: “${activity.accept[0]}”.` : 'Correct!', {
          nearMiss: m.nearMiss,
        });
      return no(r.text.trim() ? `“${r.text.trim()}” isn't the term we're looking for.` : 'No answer entered.', {
        correctAnswer: activity.accept[0],
      });
    }
    case 'order': {
      const r = response as { order: number[] };
      const n = activity.steps.length;
      let inPlace = 0;
      for (let i = 0; i < n; i++) if (r.order[i] === i) inPlace++;
      const correctAnswer = activity.steps.map((s, i) => `${i + 1}. ${s}`).join('\n');
      return inPlace === n
        ? ok('Perfect sequence.')
        : { correct: false, score: inPlace / n, feedback: `${inPlace} of ${n} steps are in the right spot.`, correctAnswer };
    }
    case 'flashcard': {
      const r = response as { rating: Rating };
      // Self-rated: "Again" means not recalled yet; it is scheduled for review rather than penalized.
      return r.rating === 'again'
        ? no('No problem — this card will come back soon in your reviews.', { correctAnswer: activity.back })
        : ok(r.rating === 'easy' ? 'Nice, you knew that cold.' : 'Recorded. Repetition makes it stick.');
    }
    case 'numeric': {
      const r = response as { value: string };
      const v = parseNumber(r.value);
      const correctAnswer = formatValue(activity.answer, activity.unit, activity.currency);
      if (v === null) return no('Enter a number (symbols like $ and % are fine).', { correctAnswer });
      if (withinTolerance(v, activity.answer, activity.tolerance)) return ok(`Correct: ${correctAnswer}.`);
      // A common slip: answering a percentage as a fraction or vice versa.
      if (activity.unit === 'percent' && withinTolerance(v * 100, activity.answer, activity.tolerance))
        return no('Close — that looks like a decimal. Multiply by 100 to express it as a percent.', { correctAnswer });
      return no(`${formatValue(v, activity.unit, activity.currency)} isn't quite it.`, { correctAnswer });
    }
    case 'spotmistake': {
      const r = response as { line: number };
      return r.line === activity.mistake
        ? ok('You found it.')
        : no('That line is fine. The mistake is elsewhere.', { correctAnswer: activity.lines[activity.mistake] });
    }
    case 'strategy': {
      const r = response as { choice: number };
      const chosen = activity.options[r.choice];
      if (!chosen) return no('Pick a strategy first.');
      const bestText = activity.best.map((i) => activity.options[i].text).join(' / ');
      return activity.best.includes(r.choice)
        ? ok(chosen.feedback)
        : no(chosen.feedback, { correctAnswer: bestText });
    }
    case 'casestudy': {
      const r = response as { answers: number[] };
      const parts = activity.questions.map((q, i) => {
        const chosen = q.options[r.answers[i]];
        return { correct: r.answers[i] === q.answer, feedback: chosen ? chosen.feedback : 'Not answered.' };
      });
      const right = parts.filter((p) => p.correct).length;
      const score = right / parts.length;
      return {
        correct: right === parts.length,
        score,
        feedback: right === parts.length ? 'You nailed every part of the case.' : `${right} of ${parts.length} parts correct.`,
        parts,
      };
    }
  }
}

/** Whether a response is complete enough to enable the Check button. */
export function isResponseReady(activity: Activity, r: ActivityResponse | null): boolean {
  if (!r) return false;
  switch (r.type) {
    case 'mcq':
    case 'scenario':
    case 'strategy':
      return r.choice >= 0;
    case 'truefalse':
      return typeof r.value === 'boolean';
    case 'match':
      return activity.type === 'match' && r.pairs.length === activity.pairs.length && r.pairs.every((p) => p >= 0);
    case 'fillblank':
    case 'recall':
      return r.text.trim().length > 0;
    case 'order':
      return activity.type === 'order' && r.order.length === activity.steps.length;
    case 'numeric':
      return r.value.trim().length > 0;
    case 'spotmistake':
      return r.line >= 0;
    case 'flashcard':
      return true;
    case 'casestudy':
      return activity.type === 'casestudy' && r.answers.length === activity.questions.length && r.answers.every((a) => a >= 0);
  }
}
