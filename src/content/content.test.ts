import { describe, expect, it } from 'vitest';
import { ACTIVITY_TYPES, Course } from '@/domain/content';
import { courses, playableCourses, glossary, glossaryById, courseLessons, categories } from '@/content';
import { searchAll, searchTerms } from './searchIndex';

describe('curriculum', () => {
  it('every course re-validates against the schema', () => {
    for (const c of courses) expect(() => Course.parse(c)).not.toThrow();
  });

  it('every category has at least one course record', () => {
    for (const cat of categories) expect(courses.some((c) => c.categoryId === cat.id)).toBe(true);
  });

  it('playable courses have 3 modules × 5 lessons with ≥4 activities each', () => {
    for (const c of playableCourses) {
      expect(c.modules, c.id).toHaveLength(3);
      for (const m of c.modules) {
        expect(m.lessons, m.id).toHaveLength(5);
        expect(m.lessons[4].checkpoint).toBe(true);
        for (const l of m.lessons) expect(l.activities.length, l.id).toBeGreaterThanOrEqual(4);
      }
    }
  });

  it('coming-soon courses have outlines but no playable lessons', () => {
    for (const c of courses.filter((x) => x.status === 'coming-soon')) {
      expect(c.modules).toHaveLength(0);
      expect(c.outline.length).toBeGreaterThan(0);
    }
  });

  it('Shipping Terminology demonstrates every activity type', () => {
    const ship = playableCourses.find((c) => c.id === 'shipping-terminology')!;
    const types = new Set(courseLessons(ship).flatMap((l) => l.activities.map((a) => a.type)));
    for (const t of ACTIVITY_TYPES) expect(types.has(t), t).toBe(true);
  });

  it('lesson terms reference real glossary entries, and prerequisites are real courses', () => {
    const ids = new Set(courses.map((c) => c.id));
    for (const c of courses) {
      for (const p of c.prerequisites) expect(ids.has(p), `${c.id} prereq ${p}`).toBe(true);
      for (const l of courseLessons(c)) for (const t of l.terms) expect(glossaryById.has(t), `${l.id} term ${t}`).toBe(true);
    }
  });

  it('ids are unique', () => {
    const lessonIds = playableCourses.flatMap((c) => courseLessons(c).map((l) => l.id));
    expect(new Set(lessonIds).size).toBe(lessonIds.length);
  });
});

describe('glossary', () => {
  it('has at least 100 terms with complete entries and valid related links', () => {
    expect(glossary.length).toBeGreaterThanOrEqual(100);
    for (const t of glossary) {
      expect(t.definition.length).toBeGreaterThan(10);
      expect(t.example.length).toBeGreaterThan(10);
      for (const r of t.related) expect(glossaryById.has(r), `${t.id} → ${r}`).toBe(true);
    }
  });

  it('includes the required terms', () => {
    const req = ['moq', 'sku', 'cogs', 'aov', 'cac', 'ltv', 'ctr', 'cpm', 'cpc', 'roas', '3pl', 'fob', 'ddp', 'lead-time', 'gross-margin', 'net-margin', 'markup', 'conversion-rate', 'chargeback', 'fulfillment', 'dimensional-weight', 'inventory-turnover', 'breakeven', 'cash-flow'];
    for (const r of req) expect(glossaryById.has(r), r).toBe(true);
  });
});

describe('search', () => {
  it('finds MOQ by abbreviation and by full phrase', () => {
    expect(searchTerms('MOQ')[0].doc.id).toBe('moq');
    expect(searchTerms('minimum order')[0].doc.id).toBe('moq');
    expect(searchTerms('moq')[0].doc.id).toBe('moq');
  });
  it('finds aliases like dim weight', () => {
    expect(searchTerms('dim weight')[0].doc.id).toBe('dimensional-weight');
  });
  it('finds courses, lessons and topic keywords', () => {
    const kinds = (q: string) => searchAll(q).map((h) => `${h.doc.kind}:${h.doc.id}`);
    expect(kinds('shipping terminology')[0]).toBe('course:shipping-terminology');
    expect(kinds('Incoterms')).toContain('lesson:ship-2-4');
    expect(kinds('reorder')).toContain('lesson:ship-3-2');
  });
  it('returns nothing for empty or nonsense queries', () => {
    expect(searchAll('')).toEqual([]);
    expect(searchAll('zzqxj')).toEqual([]);
  });
});
