import { useMemo } from 'react';
import { playableCourses } from '@/content';
import { courseSummary, lessonStates, type CourseSummary } from '@/domain/unlocks';
import type { Course } from '@/domain/content';
import { useProgressMap } from './data';

export function useCourseSummaries(): Map<string, CourseSummary> | undefined {
  const progress = useProgressMap();
  return useMemo(() => (progress ? new Map(playableCourses.map((c) => [c.id, courseSummary(c, progress)])) : undefined), [progress]);
}

export function useLessonStates(course: Course | undefined) {
  const progress = useProgressMap();
  return useMemo(() => (course && progress ? lessonStates(course, progress) : undefined), [course, progress]);
}
