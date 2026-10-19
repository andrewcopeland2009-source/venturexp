import { describe, expect, it } from 'vitest';
import { Activity, type ActivityOf } from './content';
import { grade, isResponseReady, matchText, normalizeText, parseNumber, withinTolerance } from './grading';

const mk = <T extends Activity['type']>(a: Record<string, unknown> & { type: T }) =>
  Activity.parse({ id: 'x', concept: 'c', explanation: 'because', ...a }) as ActivityOf<T>;

describe('text normalization', () => {
  it('ignores case, punctuation, articles and hyphens', () => {
    expect(normalizeText('  The Last-Mile! ')).toBe('last mile');
    expect(matchText('LAST MILE', ['last mile']).ok).toBe(true);
    expect(matchText('lastmile', ['last mile']).ok).toBe(true);
    expect(matchText('a parcel', ['parcel']).ok).toBe(true);
  });
  it('accepts a one-letter slip on longer words as a near miss', () => {
    const m = matchText('dimensonal weight', ['dimensional weight']);
    expect(m).toEqual({ ok: true, nearMiss: true });
    expect(matchText('sku', ['ski']).ok).toBe(false); // too short for typo tolerance
  });
  it('rejects empty answers', () => {
    expect(matchText('   ', ['x']).ok).toBe(false);
  });
});

describe('numeric parsing and tolerance', () => {
  it('parses currency, commas, percent and units', () => {
    expect(parseNumber('$1,234.50')).toBe(1234.5);
    expect(parseNumber('12%')).toBe(12);
    expect(parseNumber('6.0 lb')).toBe(6);
    expect(parseNumber('-5')).toBe(-5);
    expect(parseNumber('.5')).toBe(0.5);
    expect(parseNumber('abc')).toBeNull();
    expect(parseNumber('1.2.3')).toBeNull();
  });
  it('applies absolute tolerance inclusively', () => {
    expect(withinTolerance(6.04, 6, 0.1)).toBe(true);
    expect(withinTolerance(6.1, 6, 0.1)).toBe(true);
    expect(withinTolerance(6.11, 6, 0.1)).toBe(false);
    expect(withinTolerance(8.2, 8.2, 0)).toBe(true);
  });
});

describe('grading every activity type', () => {
  it('mcq', () => {
    const a = mk({ type: 'mcq', prompt: 'p', options: [{ text: 'A', feedback: 'fa' }, { text: 'B', feedback: 'fb' }], answer: 1 });
    expect(grade(a, { type: 'mcq', choice: 1 })).toMatchObject({ correct: true, feedback: 'fb' });
    expect(grade(a, { type: 'mcq', choice: 0 })).toMatchObject({ correct: false, feedback: 'fa', correctAnswer: 'B' });
  });

  it('truefalse', () => {
    const a = mk({ type: 'truefalse', statement: 's', answer: false });
    expect(grade(a, { type: 'truefalse', value: false }).correct).toBe(true);
    expect(grade(a, { type: 'truefalse', value: true })).toMatchObject({ correct: false, correctAnswer: 'False' });
  });

  it('match with partial credit', () => {
    const a = mk({
      type: 'match',
      prompt: 'p',
      pairs: [
        { term: 'a', definition: '1' },
        { term: 'b', definition: '2' },
        { term: 'c', definition: '3' },
      ],
    });
    expect(grade(a, { type: 'match', pairs: [0, 1, 2] })).toMatchObject({ correct: true, score: 1 });
    const r = grade(a, { type: 'match', pairs: [1, 0, 2] });
    expect(r.correct).toBe(false);
    expect(r.score).toBeCloseTo(1 / 3);
  });

  it('fillblank with normalized acceptable answers', () => {
    const a = mk({ type: 'fillblank', sentence: 'The ___ leg', accept: ['last mile', 'last-mile'] });
    expect(grade(a, { type: 'fillblank', text: 'Last-Mile' }).correct).toBe(true);
    expect(grade(a, { type: 'fillblank', text: 'first mile' })).toMatchObject({ correct: false, correctAnswer: 'last mile' });
  });

  it('order with partial credit', () => {
    const a = mk({ type: 'order', prompt: 'p', steps: ['1', '2', '3', '4'] });
    expect(grade(a, { type: 'order', order: [0, 1, 2, 3] }).correct).toBe(true);
    const r = grade(a, { type: 'order', order: [1, 0, 2, 3] });
    expect(r.correct).toBe(false);
    expect(r.score).toBe(0.5);
  });

  it('scenario', () => {
    const a = mk({ type: 'scenario', scenario: 's', prompt: 'p', options: [{ text: 'A', feedback: 'good' }, { text: 'B', feedback: 'bad' }], answer: 0 });
    expect(grade(a, { type: 'scenario', choice: 0 }).correct).toBe(true);
    expect(grade(a, { type: 'scenario', choice: 1 }).feedback).toBe('bad');
  });

  it('flashcard self-rating', () => {
    const a = mk({ type: 'flashcard', front: 'f', back: 'b' });
    expect(grade(a, { type: 'flashcard', rating: 'good' }).correct).toBe(true);
    expect(grade(a, { type: 'flashcard', rating: 'again' }).correct).toBe(false);
  });

  it('numeric with tolerance and currency', () => {
    const a = mk({ type: 'numeric', prompt: 'p', answer: 8.2, tolerance: 0.01, unit: 'currency', working: 'w' });
    expect(grade(a, { type: 'numeric', value: '$8.20' }).correct).toBe(true);
    expect(grade(a, { type: 'numeric', value: '8.21' }).correct).toBe(true);
    expect(grade(a, { type: 'numeric', value: '8.25' })).toMatchObject({ correct: false, correctAnswer: '$8.20' });
    expect(grade(a, { type: 'numeric', value: 'eight' }).correct).toBe(false);
  });

  it('numeric percent hints at decimal slips', () => {
    const a = mk({ type: 'numeric', prompt: 'p', answer: 60, tolerance: 0.5, unit: 'percent', working: 'w' });
    expect(grade(a, { type: 'numeric', value: '60%' }).correct).toBe(true);
    const r = grade(a, { type: 'numeric', value: '0.6' });
    expect(r.correct).toBe(false);
    expect(r.feedback).toMatch(/decimal/);
  });

  it('spot the mistake', () => {
    const a = mk({ type: 'spotmistake', prompt: 'p', lines: ['a', 'b', 'c'], mistake: 2, correction: 'fix' });
    expect(grade(a, { type: 'spotmistake', line: 2 }).correct).toBe(true);
    expect(grade(a, { type: 'spotmistake', line: 0 })).toMatchObject({ correct: false, correctAnswer: 'c' });
  });

  it('strategy accepts any of several best options', () => {
    const o = (t: string) => ({ text: t, pros: 'p', cons: 'c', feedback: `f${t}` });
    const a = mk({ type: 'strategy', prompt: 'p', options: [o('A'), o('B'), o('C')], best: [0, 2] });
    expect(grade(a, { type: 'strategy', choice: 2 }).correct).toBe(true);
    expect(grade(a, { type: 'strategy', choice: 1 })).toMatchObject({ correct: false, feedback: 'fB' });
  });

  it('vocabulary recall', () => {
    const a = mk({ type: 'recall', clue: 'c', accept: ['3pl', 'third party logistics'] });
    expect(grade(a, { type: 'recall', text: 'Third-party logistics' }).correct).toBe(true);
    expect(grade(a, { type: 'recall', text: '3PL' }).correct).toBe(true);
    expect(grade(a, { type: 'recall', text: 'warehouse' }).correct).toBe(false);
  });

  it('multi-question case study with per-part feedback', () => {
    const q = (answer: number) => ({ prompt: 'q', options: [{ text: 'x', feedback: 'fx' }, { text: 'y', feedback: 'fy' }], answer });
    const a = mk({ type: 'casestudy', title: 't', case: 'c', questions: [q(0), q(1), q(1)] });
    expect(grade(a, { type: 'casestudy', answers: [0, 1, 1] })).toMatchObject({ correct: true, score: 1 });
    const r = grade(a, { type: 'casestudy', answers: [0, 0, 1] });
    expect(r.correct).toBe(false);
    expect(r.score).toBeCloseTo(2 / 3);
    expect(r.parts?.map((p) => p.correct)).toEqual([true, false, true]);
  });

  it('rejects mismatched response types', () => {
    const a = mk({ type: 'truefalse', statement: 's', answer: true });
    expect(() => grade(a, { type: 'mcq', choice: 0 })).toThrow();
  });

  it('knows when a response is ready to check', () => {
    const m = mk({ type: 'match', prompt: 'p', pairs: [{ term: 'a', definition: '1' }, { term: 'b', definition: '2' }, { term: 'c', definition: '3' }] });
    expect(isResponseReady(m, { type: 'match', pairs: [0, -1, 2] })).toBe(false);
    expect(isResponseReady(m, { type: 'match', pairs: [0, 1, 2] })).toBe(true);
    expect(isResponseReady(m, null)).toBe(false);
  });
});
