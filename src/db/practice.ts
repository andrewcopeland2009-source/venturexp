import type { Activity } from '@/domain/content';
import { isGradedActivity } from '@/domain/content';
import { shuffle } from '@/domain/random';
import { isDue } from '@/domain/srs';
import { lessonIndex, glossary, glossaryById } from '@/content';
import { db } from './db';
import { cardContent, unlockedCardIds } from './cards';
import { todayKey } from './progression';

export type PracticeMode = 'review' | 'weak' | 'quick' | 'vocab' | 'calc' | 'mastery';

export const PRACTICE_MODES: Record<PracticeMode, { title: string; description: string; size: number }> = {
  review: { title: 'Daily Review', description: 'Due flashcards plus questions you missed recently.', size: 12 },
  weak: { title: 'Weak Areas', description: 'Concepts where your recent accuracy is below 70%.', size: 10 },
  quick: { title: 'Quick Quiz', description: '8 questions sampled from lessons you’ve completed.', size: 8 },
  vocab: { title: 'Vocabulary', description: 'Recall and match the terms you’ve learned.', size: 10 },
  calc: { title: 'Calculations', description: 'Margins, dim weight, reorder points and more.', size: 8 },
  mastery: { title: 'Mastery Check', description: '12 mixed questions from one course. Aim for 80%+.', size: 12 },
};

/** A practice item: an activity plus, for flashcards, the SRS card it reviews. */
export interface PracticeItem {
  activity: Activity;
  lessonId: string | null;
  cardId?: string;
}

export const WEAK_THRESHOLD = 0.7;

async function completedLessonIds(courseId?: string): Promise<string[]> {
  const rows = await db.lessonProgress.where('status').equals('completed').toArray();
  return rows.filter((r) => !courseId || r.courseId === courseId).map((r) => r.lessonId);
}

function activitiesFrom(lessonIds: string[]): PracticeItem[] {
  return lessonIds.flatMap((id) => {
    const ref = lessonIndex.get(id);
    return ref ? ref.lesson.activities.map((activity) => ({ activity, lessonId: id })) : [];
  });
}

/** Most recent attempt time per activity, so we can avoid repeating the same questions. */
async function lastSeen(): Promise<Map<string, number>> {
  const m = new Map<string, number>();
  await db.attempts.each((a) => {
    if ((m.get(a.activityId) ?? 0) < a.at) m.set(a.activityId, a.at);
  });
  return m;
}

/** Prefer least-recently-seen items; break ties with a seeded shuffle. */
function freshest(items: PracticeItem[], seen: Map<string, number>, n: number, seed: string): PracticeItem[] {
  const shuffled = shuffle(items, seed);
  return shuffled
    .map((it, i) => ({ it, i, t: seen.get(it.activity.id) ?? 0 }))
    .sort((a, b) => a.t - b.t || a.i - b.i)
    .slice(0, n)
    .map((x) => x.it);
}

export function cardActivity(cardId: string): PracticeItem | null {
  const c = cardContent(cardId);
  if (!c) return null;
  return {
    cardId,
    lessonId: null,
    activity: {
      id: `card:${cardId}`,
      type: 'flashcard',
      concept: cardId.replace(/^(term|act):/, ''),
      front: c.front,
      back: c.back,
      explanation: c.detail ?? `From: ${c.source}`,
    },
  };
}

/** Generated vocabulary question: pick the term that matches a definition. */
export function termQuestion(termId: string, seed: string): PracticeItem | null {
  const t = glossaryById.get(termId);
  if (!t) return null;
  const pool = glossary.filter((g) => g.id !== t.id && g.category === t.category);
  const distractors = shuffle(pool.length >= 3 ? pool : glossary.filter((g) => g.id !== t.id), `${seed}-${termId}`).slice(0, 3);
  const options = shuffle([t, ...distractors], `${seed}-${termId}-o`);
  return {
    lessonId: null,
    activity: {
      id: `gen:term:${t.id}`,
      type: 'mcq',
      concept: t.id,
      prompt: `Which term matches: “${t.definition}”`,
      options: options.map((o) => ({
        text: o.term,
        feedback: o.id === t.id ? `Yes — ${t.term}. ${t.example}` : `${o.term} means: ${o.definition}`,
      })),
      answer: options.findIndex((o) => o.id === t.id),
      explanation: t.example,
    },
  };
}

export async function weakConcepts(): Promise<{ concept: string; accuracy: number; attempts: number }[]> {
  const rows = await db.concepts.toArray();
  return rows
    .filter((c) => c.recent.length >= 2)
    .map((c) => ({ concept: c.concept, accuracy: c.recent.filter(Boolean).length / c.recent.length, attempts: c.attempts }))
    .filter((c) => c.accuracy < WEAK_THRESHOLD)
    .sort((a, b) => a.accuracy - b.accuracy);
}

export async function dueCardIds(): Promise<string[]> {
  const today = await todayKey();
  const ids = await unlockedCardIds();
  const rows = new Map((await db.flashcards.bulkGet(ids)).filter(Boolean).map((r) => [r!.cardId, r!]));
  return ids.filter((id) => isDue(rows.get(id), today));
}

export async function buildSession(mode: PracticeMode, seed: string, courseId?: string): Promise<PracticeItem[]> {
  const size = PRACTICE_MODES[mode].size;
  const lessons = await completedLessonIds(mode === 'mastery' ? courseId : undefined);
  const all = activitiesFrom(lessons);
  const graded = all.filter((i) => isGradedActivity(i.activity));
  const seen = await lastSeen();

  switch (mode) {
    case 'quick':
      return freshest(graded, seen, size, seed);
    case 'mastery':
      return freshest(graded, seen, size, seed);
    case 'calc':
      return freshest(graded.filter((i) => i.activity.type === 'numeric'), seen, size, seed);
    case 'weak': {
      const weak = new Set((await weakConcepts()).map((w) => w.concept));
      return freshest(graded.filter((i) => weak.has(i.activity.concept)), seen, size, seed);
    }
    case 'vocab': {
      const vocabTypes = new Set(['recall', 'fillblank', 'match']);
      const fromLessons = graded.filter((i) => vocabTypes.has(i.activity.type));
      const termIds = (await unlockedCardIds()).filter((id) => id.startsWith('term:')).map((id) => id.slice(5));
      const generated = termIds.map((t) => termQuestion(t, seed)).filter((x): x is PracticeItem => !!x);
      return freshest([...fromLessons, ...generated], seen, size, seed);
    }
    case 'review': {
      const cards = shuffle(await dueCardIds(), seed)
        .slice(0, 8)
        .map(cardActivity)
        .filter((x): x is PracticeItem => !!x);
      // Questions whose most recent attempt was wrong.
      const latest = new Map<string, { at: number; correct: boolean }>();
      await db.attempts.each((a) => {
        const cur = latest.get(a.activityId);
        if (!cur || cur.at < a.at) latest.set(a.activityId, { at: a.at, correct: a.correct });
      });
      const missed = graded.filter((i) => latest.get(i.activity.id)?.correct === false);
      const rest = size - cards.length;
      return [...cards, ...freshest(missed, seen, Math.max(4, rest), seed)].slice(0, size);
    }
  }
}

export async function practiceAvailability(): Promise<Record<PracticeMode, number> & { cardsDue: number; cardsTotal: number }> {
  const lessons = await completedLessonIds();
  const graded = activitiesFrom(lessons).filter((i) => isGradedActivity(i.activity));
  const weak = new Set((await weakConcepts()).map((w) => w.concept));
  const cardsTotal = (await unlockedCardIds()).length;
  const cardsDue = (await dueCardIds()).length;
  const termCards = (await unlockedCardIds()).filter((id) => id.startsWith('term:')).length;
  const latest = new Map<string, { at: number; correct: boolean }>();
  await db.attempts.each((a) => {
    const cur = latest.get(a.activityId);
    if (!cur || cur.at < a.at) latest.set(a.activityId, { at: a.at, correct: a.correct });
  });
  return {
    review: cardsDue + graded.filter((i) => latest.get(i.activity.id)?.correct === false).length,
    weak: graded.filter((i) => weak.has(i.activity.concept)).length,
    quick: graded.length,
    vocab: graded.filter((i) => ['recall', 'fillblank', 'match'].includes(i.activity.type)).length + termCards,
    calc: graded.filter((i) => i.activity.type === 'numeric').length,
    mastery: graded.length,
    cardsDue,
    cardsTotal,
  };
}
