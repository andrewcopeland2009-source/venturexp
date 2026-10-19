import { z } from 'zod';
import {
  Activity,
  Course,
  Category,
  GlossaryTerm,
  type CourseInput,
  type LessonInput,
  type GlossaryTermInput,
} from '@/domain/content';

/**
 * Content engine: authors write drafts (no activity ids, no checkpoint flags); the engine
 * assigns stable ids, marks module checkpoints, validates with Zod and checks semantics
 * (answer indices in range, etc). Invalid content fails loudly at load and in tests.
 */

type DistOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type ActivityDraft = DistOmit<z.input<typeof Activity>, 'id'> & { id?: string };
export type LessonDraft = Omit<LessonInput, 'activities' | 'checkpoint'> & { activities: ActivityDraft[] };
export interface ModuleDraft {
  id: string;
  title: string;
  summary: string;
  lessons: LessonDraft[];
}
export type CourseDraft = Omit<CourseInput, 'modules'> & { modules?: ModuleDraft[] };

export class ContentError extends Error {}

function semanticCheck(a: Activity, where: string) {
  const fail = (m: string) => {
    throw new ContentError(`${where} (${a.type}): ${m}`);
  };
  switch (a.type) {
    case 'mcq':
    case 'scenario':
      if (a.answer >= a.options.length) fail('answer index out of range');
      break;
    case 'strategy':
      if (a.best.some((b) => b >= a.options.length)) fail('best index out of range');
      break;
    case 'spotmistake':
      if (a.mistake >= a.lines.length) fail('mistake index out of range');
      break;
    case 'casestudy':
      a.questions.forEach((q, i) => q.answer >= q.options.length && fail(`question ${i} answer out of range`));
      break;
    case 'match': {
      const terms = new Set(a.pairs.map((p) => p.term));
      const defs = new Set(a.pairs.map((p) => p.definition));
      if (terms.size !== a.pairs.length || defs.size !== a.pairs.length) fail('duplicate match terms/definitions');
      break;
    }
    case 'order':
      if (new Set(a.steps).size !== a.steps.length) fail('duplicate steps');
      break;
    case 'numeric':
      if (!Number.isFinite(a.answer)) fail('answer must be finite');
      break;
  }
}

function formatZod(e: z.ZodError): string {
  return e.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
}

export function defineCourse(draft: CourseDraft): Course {
  const modules = (draft.modules ?? []).map((m) => ({
    ...m,
    lessons: m.lessons.map((l, li) => ({
      ...l,
      checkpoint: li === m.lessons.length - 1,
      activities: l.activities.map((a, ai) => ({ ...a, id: a.id ?? `${l.id}.${ai + 1}` })),
    })),
  }));
  const parsed = Course.safeParse({ ...draft, modules });
  if (!parsed.success) throw new ContentError(`Course ${draft.id}: ${formatZod(parsed.error)}`);
  const course = parsed.data;
  for (const m of course.modules)
    for (const l of m.lessons) l.activities.forEach((a) => semanticCheck(a, `${course.id}/${l.id}/${a.id}`));
  if (course.status === 'playable' && course.modules.length === 0)
    throw new ContentError(`Course ${course.id} is playable but has no modules`);
  return course;
}

export function defineCategories(input: z.input<typeof Category>[]) {
  const parsed = z.array(Category).safeParse(input);
  if (!parsed.success) throw new ContentError(`Categories: ${formatZod(parsed.error)}`);
  return parsed.data;
}

export function defineGlossary(input: GlossaryTermInput[]) {
  const parsed = z.array(GlossaryTerm).safeParse(input);
  if (!parsed.success) throw new ContentError(`Glossary: ${formatZod(parsed.error)}`);
  return parsed.data;
}
