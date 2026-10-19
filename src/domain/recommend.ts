import type { Course } from './content';
import type { Experience, Goal } from './records';

/** Category affinity for each learning goal. */
const GOAL_CATEGORIES: Record<Goal, string[]> = {
  start: ['ecommerce', 'finance', 'pod', 'shipping', 'entrepreneurship'],
  grow: ['creator', 'tiktok', 'finance', 'marketing'],
  terminology: ['shipping', 'finance', 'ecommerce'],
  marketing: ['creator', 'tiktok', 'marketing'],
  explore: ['ecommerce', 'shipping', 'pod', 'tiktok', 'creator', 'finance'],
};

const DIFFICULTY_RANK = { beginner: 0, intermediate: 1, advanced: 2 } as const;
const EXPERIENCE_RANK: Record<Experience, number> = { beginner: 0, some: 0, intermediate: 1, advanced: 2 };

export interface RecommendInput {
  interests: string[];
  goals: Goal[];
  experience: Experience;
  /** Courses already completed (skipped) or in progress (boosted). */
  completed?: Set<string>;
  inProgress?: Set<string>;
}

/**
 * Transparent scoring: +3 per matching interest, +2 per goal that favors the category,
 * +1 for being a foundation (no prerequisites) when the learner is newer, and a small
 * penalty when a course is far above or below the learner's level.
 */
export function recommendCourses(playable: Course[], input: RecommendInput): Course[] {
  const order = new Map(playable.map((c, i) => [c.id, i]));
  const scored = playable
    .filter((c) => !input.completed?.has(c.id))
    .map((c) => {
      let s = 0;
      if (input.interests.includes(c.categoryId)) s += 3;
      for (const g of input.goals) if (GOAL_CATEGORIES[g].includes(c.categoryId)) s += 2;
      if (!c.prerequisites.length && EXPERIENCE_RANK[input.experience] === 0) s += 1;
      s -= Math.abs(DIFFICULTY_RANK[c.difficulty] - EXPERIENCE_RANK[input.experience]) * 0.5;
      if (input.inProgress?.has(c.id)) s += 4;
      return { c, s };
    });
  return scored.sort((a, b) => b.s - a.s || order.get(a.c.id)! - order.get(b.c.id)!).map((x) => x.c);
}
