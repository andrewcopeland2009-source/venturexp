import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { BookA, ChevronRight, Search as SearchIcon, X } from 'lucide-react';
import { glossary } from '@/content';
import { GLOSSARY_CATEGORY_LABEL } from '@/content/glossary';
import { searchTerms } from '@/content/searchIndex';
import { lessonIndex } from '@/content';
import { useProgressMap } from '@/hooks/data';
import { EmptyState, PageHeader, Pill, Spinner, cx } from '@/components/ui';

type Learned = 'all' | 'learned' | 'new';

/** Map term id → lesson ids that introduce it. */
const termLessons = new Map<string, string[]>();
for (const [id, ref] of lessonIndex) for (const t of ref.lesson.terms) termLessons.set(t, [...(termLessons.get(t) ?? []), id]);

export default function Glossary() {
  const [params, setParams] = useSearchParams();
  const progress = useProgressMap();
  const [q, setQ] = useState(params.get('q') ?? '');
  const category = params.get('category') ?? 'all';
  const [difficulty, setDifficulty] = useState('all');
  const [learned, setLearned] = useState<Learned>('all');

  const setCategory = (c: string) => {
    const p = new URLSearchParams(params);
    if (c === 'all') p.delete('category');
    else p.set('category', c);
    setParams(p, { replace: true });
  };

  const list = useMemo(() => {
    const base = q.trim() ? searchTerms(q, 200).map((h) => glossary.find((t) => t.id === h.doc.id)!) : [...glossary].sort((a, b) => a.term.localeCompare(b.term));
    return base.filter((t) => {
      if (category !== 'all' && t.category !== category) return false;
      if (difficulty !== 'all' && t.difficulty !== difficulty) return false;
      if (learned !== 'all' && progress) {
        const isLearned = (termLessons.get(t.id) ?? []).some((l) => progress.get(l)?.status === 'completed');
        if (learned === 'learned' ? !isLearned : isLearned) return false;
      }
      return true;
    });
  }, [q, category, difficulty, learned, progress]);

  if (!progress) return <Spinner />;

  const chip = (on: boolean, onClick: () => void, label: string) => (
    <button key={label} aria-pressed={on} onClick={onClick} className={cx('min-h-[40px] shrink-0 rounded-full border px-3.5 text-sm font-semibold', on ? 'border-violet bg-violet-soft text-violet' : 'border-line-strong text-muted')}>
      {label}
    </button>
  );

  return (
    <div>
      <PageHeader title="Business Glossary" subtitle={`${glossary.length} terms in plain language. Works offline.`} back="/practice" />
      <label className="relative block">
        <span className="sr-only">Search the glossary</span>
        <SearchIcon size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-faint" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search terms — try “MOQ”"
          className="min-h-[52px] w-full rounded-2xl border-2 border-line-strong bg-card pl-12 pr-12 outline-none focus:border-violet"
        />
        {q && (
          <button onClick={() => setQ('')} aria-label="Clear search" className="absolute right-1.5 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center text-muted">
            <X size={18} />
          </button>
        )}
      </label>
      <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Category">
        {chip(category === 'all', () => setCategory('all'), 'All categories')}
        {Object.entries(GLOSSARY_CATEGORY_LABEL).map(([id, label]) => chip(category === id, () => setCategory(id), label))}
      </div>
      <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Difficulty and status">
        {['all', 'beginner', 'intermediate', 'advanced'].map((d) => chip(difficulty === d, () => setDifficulty(d), d === 'all' ? 'Any level' : d[0].toUpperCase() + d.slice(1)))}
        <span className="mx-1 w-px shrink-0 bg-line-strong" />
        {chip(learned === 'learned', () => setLearned(learned === 'learned' ? 'all' : 'learned'), 'Learned')}
        {chip(learned === 'new', () => setLearned(learned === 'new' ? 'all' : 'new'), 'Not learned yet')}
      </div>

      <p className="mb-2 mt-4 text-sm text-muted" aria-live="polite">
        {list.length} term{list.length === 1 ? '' : 's'}
      </p>
      {list.length ? (
        <ul className="surface divide-y divide-line overflow-hidden rounded-[var(--radius-card)]">
          {list.map((t) => (
            <li key={t.id}>
              <Link to={`/glossary/${t.id}`} className="flex min-h-[64px] items-center gap-3 px-4 py-3 hover:bg-elevated">
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{t.term}</p>
                  <p className="line-clamp-1 text-sm text-muted">{t.definition}</p>
                </div>
                <Pill className="hidden sm:inline-flex">{GLOSSARY_CATEGORY_LABEL[t.category]}</Pill>
                <ChevronRight size={18} className="shrink-0 text-faint" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={<BookA />} title="No matching terms">
          Try a shorter search or clear a filter.
        </EmptyState>
      )}
    </div>
  );
}
