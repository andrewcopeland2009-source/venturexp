import { z } from 'zod';

/**
 * Curriculum content model. Everything a learner sees in a lesson is plain, schema-validated data.
 * Grading lives in ./grading.ts and rendering lives in src/components/activities — never mixed.
 */

export const CURRICULUM_VERSION = 1;

export const Difficulty = z.enum(['beginner', 'intermediate', 'advanced']);
export type Difficulty = z.infer<typeof Difficulty>;

const text = z.string().min(1);

/** Answer option with feedback specific to *that* answer. */
export const Option = z.object({ text, feedback: text });
export type Option = z.infer<typeof Option>;

const base = {
  id: z.string().min(1),
  /** Concept tag used for weak-area tracking and mastery. */
  concept: z.string().min(1),
  /** Explanation shown after Check, regardless of result. */
  explanation: text,
};

export const McqActivity = z.object({
  ...base,
  type: z.literal('mcq'),
  prompt: text,
  options: z.array(Option).min(2).max(6),
  answer: z.number().int().nonnegative(),
});

export const TrueFalseActivity = z.object({
  ...base,
  type: z.literal('truefalse'),
  statement: text,
  answer: z.boolean(),
});

export const MatchActivity = z.object({
  ...base,
  type: z.literal('match'),
  prompt: text,
  pairs: z.array(z.object({ term: text, definition: text })).min(3).max(6),
});

export const FillBlankActivity = z.object({
  ...base,
  type: z.literal('fillblank'),
  /** Sentence containing exactly one `___` placeholder. */
  sentence: text.refine((s) => s.split('___').length === 2, 'sentence needs exactly one ___'),
  accept: z.array(text).min(1),
  hint: z.string().optional(),
});

export const OrderActivity = z.object({
  ...base,
  type: z.literal('order'),
  prompt: text,
  /** Steps in the correct order; the UI shuffles them. */
  steps: z.array(text).min(3).max(7),
});

export const ScenarioActivity = z.object({
  ...base,
  type: z.literal('scenario'),
  scenario: text,
  prompt: text,
  options: z.array(Option).min(2).max(5),
  answer: z.number().int().nonnegative(),
});

export const FlashcardActivity = z.object({
  ...base,
  type: z.literal('flashcard'),
  front: text,
  back: text,
});

export const NumericActivity = z.object({
  ...base,
  type: z.literal('numeric'),
  prompt: text,
  answer: z.number(),
  /** Absolute tolerance, in the answer's unit. */
  tolerance: z.number().nonnegative().default(0),
  unit: z.enum(['currency', 'percent', 'number', 'lb', 'kg', 'days', 'units']).default('number'),
  currency: z.string().default('USD'),
  /** Worked solution shown after checking. */
  working: text,
});

export const SpotMistakeActivity = z.object({
  ...base,
  type: z.literal('spotmistake'),
  prompt: text,
  lines: z.array(text).min(3).max(7),
  mistake: z.number().int().nonnegative(),
  /** Why the mistaken line is wrong and what it should say. */
  correction: text,
});

export const StrategyActivity = z.object({
  ...base,
  type: z.literal('strategy'),
  prompt: text,
  options: z
    .array(z.object({ text, pros: text, cons: text, feedback: text }))
    .min(2)
    .max(5),
  /** Indices of acceptable strategies (there can be more than one sound choice). */
  best: z.array(z.number().int().nonnegative()).min(1),
});

export const RecallActivity = z.object({
  ...base,
  type: z.literal('recall'),
  /** Definition or description; learner types the term. */
  clue: text,
  accept: z.array(text).min(1),
  hint: z.string().optional(),
});

export const CaseQuestion = z.object({
  prompt: text,
  options: z.array(Option).min(2).max(5),
  answer: z.number().int().nonnegative(),
});

export const CaseStudyActivity = z.object({
  ...base,
  type: z.literal('casestudy'),
  title: text,
  case: text,
  questions: z.array(CaseQuestion).min(2).max(5),
});

export const Activity = z.discriminatedUnion('type', [
  McqActivity,
  TrueFalseActivity,
  MatchActivity,
  FillBlankActivity,
  OrderActivity,
  ScenarioActivity,
  FlashcardActivity,
  NumericActivity,
  SpotMistakeActivity,
  StrategyActivity,
  RecallActivity,
  CaseStudyActivity,
]);
export type Activity = z.infer<typeof Activity>;
export type ActivityType = Activity['type'];
export type ActivityOf<T extends ActivityType> = Extract<Activity, { type: T }>;

export const ACTIVITY_TYPES: ActivityType[] = [
  'mcq',
  'truefalse',
  'match',
  'fillblank',
  'order',
  'scenario',
  'flashcard',
  'numeric',
  'spotmistake',
  'strategy',
  'recall',
  'casestudy',
];

export const ACTIVITY_LABEL: Record<ActivityType, string> = {
  mcq: 'Multiple choice',
  truefalse: 'True or false',
  match: 'Match the pairs',
  fillblank: 'Fill in the blank',
  order: 'Put in order',
  scenario: 'Scenario',
  flashcard: 'Flashcard',
  numeric: 'Calculate',
  spotmistake: 'Spot the mistake',
  strategy: 'Pick a strategy',
  recall: 'Vocabulary recall',
  casestudy: 'Case study',
};

export const Reference = z.object({ label: text, url: z.string().url() });

export const Lesson = z.object({
  id: z.string().min(1),
  title: text,
  objective: text,
  minutes: z.number().int().min(2).max(10),
  /** Short plain-language explanation, one paragraph per entry. */
  explanation: z.array(text).min(1),
  example: text,
  /** Glossary term ids introduced in this lesson (become flashcards after completion). */
  terms: z.array(z.string()).default([]),
  activities: z.array(Activity).min(1),
  /** Lesson content version; bump when content changes meaningfully. Progress is keyed by id so it survives. */
  version: z.number().int().positive().default(1),
  checkpoint: z.boolean().default(false),
  /** Facts that depend on platform policy or rates and should be verified with official sources. */
  verify: z.string().optional(),
  references: z.array(Reference).default([]),
});
export type Lesson = z.infer<typeof Lesson>;
export type LessonInput = z.input<typeof Lesson>;

export const Module = z.object({
  id: z.string().min(1),
  title: text,
  summary: text,
  lessons: z.array(Lesson),
});
export type Module = z.infer<typeof Module>;

/** Outline-only lesson (Coming soon courses). */
export const OutlineModule = z.object({ title: text, lessons: z.array(text).min(1) });
export type OutlineModule = z.infer<typeof OutlineModule>;

export const CourseStatus = z.enum(['playable', 'coming-soon']);

export const Course = z.object({
  id: z.string().min(1),
  categoryId: z.string().min(1),
  title: text,
  description: text,
  difficulty: Difficulty,
  icon: z.string().min(1),
  status: CourseStatus,
  estimatedMinutes: z.number().int().positive(),
  prerequisites: z.array(z.string()).default([]),
  objectives: z.array(text).min(1),
  keywords: z.array(z.string()).default([]),
  modules: z.array(Module).default([]),
  outline: z.array(OutlineModule).default([]),
  lastReviewed: z.string().regex(/^\d{4}-\d{2}$/),
});
export type Course = z.infer<typeof Course>;
export type CourseInput = z.input<typeof Course>;

export const Category = z.object({
  id: z.string().min(1),
  title: text,
  description: text,
  icon: z.string().min(1),
  color: z.enum(['violet', 'blue', 'green', 'amber', 'pink', 'teal']),
  topics: z.array(text).min(1),
});
export type Category = z.infer<typeof Category>;

export const GlossaryTerm = z.object({
  id: z.string().min(1),
  term: text,
  aliases: z.array(z.string()).default([]),
  definition: text,
  example: text,
  related: z.array(z.string()).default([]),
  category: z.string().min(1),
  difficulty: Difficulty,
});
export type GlossaryTerm = z.infer<typeof GlossaryTerm>;
export type GlossaryTermInput = z.input<typeof GlossaryTerm>;

/** Activity types with an objectively gradable answer (used by Quick Quiz etc.). */
export function isGradedActivity(a: Activity): boolean {
  return a.type !== 'flashcard';
}
