import { activityIndex, glossaryById, lessonIndex } from '@/content';
import { db } from './db';

/**
 * Flashcards come only from completed content:
 *  • `term:<glossaryId>` for every glossary term a completed lesson introduces
 *  • `act:<activityId>` for every flashcard activity inside a completed lesson
 */
export interface CardContent {
  id: string;
  front: string;
  back: string;
  detail?: string;
  source: string;
  kind: 'term' | 'activity';
}

export function cardIdsForLesson(lessonId: string): string[] {
  const ref = lessonIndex.get(lessonId);
  if (!ref) return [];
  const ids = ref.lesson.terms.filter((t) => glossaryById.has(t)).map((t) => `term:${t}`);
  for (const a of ref.lesson.activities) if (a.type === 'flashcard') ids.push(`act:${a.id}`);
  return ids;
}

export async function unlockedCardIds(): Promise<string[]> {
  const done = await db.lessonProgress.where('status').equals('completed').toArray();
  const ids = new Set<string>();
  for (const p of done) for (const id of cardIdsForLesson(p.lessonId)) ids.add(id);
  return [...ids];
}

export function cardContent(cardId: string): CardContent | null {
  const [kind, ...rest] = cardId.split(':');
  const key = rest.join(':');
  if (kind === 'term') {
    const t = glossaryById.get(key);
    if (!t) return null;
    return { id: cardId, front: t.term, back: t.definition, detail: t.example, source: 'Glossary', kind: 'term' };
  }
  if (kind === 'act') {
    const ref = activityIndex.get(key);
    if (!ref || ref.activity.type !== 'flashcard') return null;
    return {
      id: cardId,
      front: ref.activity.front,
      back: ref.activity.back,
      detail: ref.activity.explanation,
      source: ref.lesson.title,
      kind: 'activity',
    };
  }
  return null;
}
