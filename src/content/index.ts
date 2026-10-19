import type { Activity, Course, Lesson, Module } from '@/domain/content';
import { categories, comingSoonCourses } from './catalog';
import { glossary, glossaryById } from './glossary';
import { playableCourses } from './courses';

export { categories, glossary, glossaryById };

/** All courses, playable first within each category. */
export const courses: Course[] = [...playableCourses, ...comingSoonCourses];

export const courseById = new Map(courses.map((c) => [c.id, c]));
export const categoryById = new Map(categories.map((c) => [c.id, c]));

export interface LessonRef {
  lesson: Lesson;
  module: Module;
  course: Course;
  /** Index within the module. */
  index: number;
  /** Index across the whole course. */
  globalIndex: number;
}

export interface ActivityRef {
  activity: Activity;
  lesson: Lesson;
  course: Course;
}

export const lessonIndex = new Map<string, LessonRef>();
export const activityIndex = new Map<string, ActivityRef>();
export const moduleIndex = new Map<string, { module: Module; course: Course }>();

for (const course of playableCourses) {
  let g = 0;
  for (const module of course.modules) {
    moduleIndex.set(module.id, { module, course });
    module.lessons.forEach((lesson, index) => {
      if (lessonIndex.has(lesson.id)) throw new Error(`Duplicate lesson id ${lesson.id}`);
      lessonIndex.set(lesson.id, { lesson, module, course, index, globalIndex: g++ });
      for (const activity of lesson.activities) {
        if (activityIndex.has(activity.id)) throw new Error(`Duplicate activity id ${activity.id}`);
        activityIndex.set(activity.id, { activity, lesson, course });
      }
    });
  }
}

export function courseLessons(course: Course): Lesson[] {
  return course.modules.flatMap((m) => m.lessons);
}

export function coursesInCategory(categoryId: string): Course[] {
  return courses.filter((c) => c.categoryId === categoryId);
}

export const totalPlayableLessons = playableCourses.reduce((n, c) => n + courseLessons(c).length, 0);
export { playableCourses };
