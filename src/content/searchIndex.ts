import { prepare, search, type SearchDoc } from '@/domain/search';
import { categories, courses, glossary } from './index';
import { GLOSSARY_CATEGORY_LABEL } from './glossary';

export const searchDocs: SearchDoc[] = [
  ...glossary.map<SearchDoc>((t) => ({
    kind: 'term',
    id: t.id,
    title: t.term,
    subtitle: t.definition,
    body: `${t.example} ${GLOSSARY_CATEGORY_LABEL[t.category] ?? t.category}`,
    aliases: t.aliases,
    category: t.category,
    difficulty: t.difficulty,
    href: `/glossary/${t.id}`,
  })),
  ...courses.map<SearchDoc>((c) => ({
    kind: 'course',
    id: c.id,
    title: c.title,
    subtitle: c.description,
    body: [...c.keywords, ...c.objectives, ...c.modules.map((m) => m.title), ...c.outline.flatMap((o) => [o.title, ...o.lessons])].join(' '),
    aliases: [],
    category: c.categoryId,
    difficulty: c.difficulty,
    href: `/course/${c.id}`,
  })),
  ...courses.flatMap((c) =>
    c.modules.flatMap((m) =>
      m.lessons.map<SearchDoc>((l) => ({
        kind: 'lesson',
        id: l.id,
        title: l.title,
        subtitle: `${c.title} · ${m.title}`,
        body: `${l.objective} ${l.terms.join(' ')} ${l.activities.map((a) => a.concept.replace(/-/g, ' ')).join(' ')}`,
        aliases: [],
        category: c.categoryId,
        difficulty: c.difficulty,
        href: `/course/${c.id}?lesson=${l.id}`,
      })),
    ),
  ),
  ...categories.map<SearchDoc>((c) => ({
    kind: 'category',
    id: c.id,
    title: c.title,
    subtitle: c.description,
    body: c.topics.join(' '),
    aliases: [],
    category: c.id,
    href: `/learn/${c.id}`,
  })),
];

const prepared = prepare(searchDocs);

export function searchAll(query: string, limit?: number) {
  return search(prepared, query, limit);
}

const termsOnly = prepare(searchDocs.filter((d) => d.kind === 'term'));
export function searchTerms(query: string, limit?: number) {
  return search(termsOnly, query, limit);
}
