import type { Course } from './content';
import type { LessonProgress } from './records';

export type NodeState = 'locked' | 'available' | 'in_progress' | 'completed' | 'mastered';

/** Checkpoint lessons (last in each module) need this first-try score to count as passed. */
export const CHECKPOINT_PASS = 0.7;

export function isDone(p: LessonProgress | undefined): boolean {
  return p?.status === 'completed';
}

/**
 * Deterministic unlock rules, derived purely from saved progress:
 *  • The first lesson of every playable course is available (courses are browsable freely).
 *  • Each later lesson unlocks when the previous lesson in the course is completed.
 *  • Because a module's last lesson is its checkpoint, the next module opens only after it is passed.
 *  • Completed lessons stay replayable; "mastered" = completed with a perfect run.
 */
export function lessonStates(course: Course, progress: Map<string, LessonProgress>): Map<string, NodeState> {
  const out = new Map<string, NodeState>();
  let prevDone = true;
  for (const m of course.modules) {
    for (const l of m.lessons) {
      const p = progress.get(l.id);
      let s: NodeState;
      if (isDone(p)) s = p!.perfect ? 'mastered' : 'completed';
      else if (!prevDone) s = 'locked';
      else s = p?.status === 'in_progress' ? 'in_progress' : 'available';
      out.set(l.id, s);
      prevDone = isDone(p);
    }
  }
  return out;
}

export function canPlay(state: NodeState | undefined): boolean {
  return !!state && state !== 'locked';
}

export interface CourseSummary {
  total: number;
  completed: number;
  mastered: number;
  /** The lesson to resume: first not-completed playable lesson, else null when all done. */
  nextLessonId: string | null;
  done: boolean;
  started: boolean;
}

export function courseSummary(course: Course, progress: Map<string, LessonProgress>): CourseSummary {
  const states = lessonStates(course, progress);
  let completed = 0;
  let mastered = 0;
  let next: string | null = null;
  let started = false;
  for (const [id, s] of states) {
    if (s === 'completed' || s === 'mastered') completed++;
    if (s === 'mastered') mastered++;
    if (s !== 'available' && s !== 'locked') started = true;
    if (!next && (s === 'available' || s === 'in_progress')) next = id;
  }
  return { total: states.size, completed, mastered, nextLessonId: next, done: states.size > 0 && completed === states.size, started };
}

export function moduleDone(lessonIds: string[], progress: Map<string, LessonProgress>): boolean {
  return lessonIds.length > 0 && lessonIds.every((id) => isDone(progress.get(id)));
}

export function moduleMastered(lessonIds: string[], progress: Map<string, LessonProgress>): boolean {
  return lessonIds.length > 0 && lessonIds.every((id) => progress.get(id)?.perfect && isDone(progress.get(id)));
}
