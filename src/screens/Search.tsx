import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { BookA, BookOpen, GraduationCap, LayoutGrid, Search as SearchIcon, X } from 'lucide-react';
import { searchAll } from '@/content/searchIndex';
import { lessonIndex } from '@/content';
import type { SearchDoc } from '@/domain/search';
import { useCourseSummaries } from '@/hooks/courses';
import { useProgressMap } from '@/hooks/data';
import { EmptyState, PageHeader, cx } from '@/components/ui';

const KIND: Record<SearchDoc['kind'], { label: string; icon: typeof BookA }> = {
  term: { label: 'Term', icon: BookA },
  course: { label: 'Course', icon: GraduationCap },
  lesson: { label: 'Lesson', icon: BookOpen },
  category: { label: 'Subject', icon: LayoutGrid },
};

type Filter = 'all' | SearchDoc['kind'] | 'in-progress' | 'completed';

export default function Search() {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const summaries = useCourseSummaries();
  const progress = useProgressMap();

  const hits = useMemo(() => {
    const all = searchAll(q, 100);
    return all.filter(({ doc }) => {
      if (filter === 'all') return true;
      if (filter === 'in-progress' || filter === 'completed') {
        if (doc.kind === 'course') {
          const s = summaries?.get(doc.id);
          return filter === 'completed' ? !!s?.done : !!s?.started && !s.done;
        }
        if (doc.kind === 'lesson') {
          const p = progress?.get(doc.id);
          return filter === 'completed' ? p?.status === 'completed' : p?.status === 'in_progress';
        }
        return false;
      }
      return doc.kind === filter;
    });
  }, [q, filter, summaries, progress]);

  return (
    <div>
      <PageHeader title="Search" subtitle="Terms, courses, lessons and topics — all offline." back />
      <label className="relative block">
        <span className="sr-only">Search everything</span>
        <SearchIcon size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-faint" />
        <input
          autoFocus
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Try “MOQ”, “Incoterms” or “margin”"
          className="min-h-[52px] w-full rounded-2xl border-2 border-line-strong bg-card pl-12 pr-12 outline-none focus:border-violet"
        />
        {q && (
          <button onClick={() => setQ('')} aria-label="Clear search" className="absolute right-1.5 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center text-muted">
            <X size={18} />
          </button>
        )}
      </label>
      <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Filter results">
        {(
          [
            ['all', 'All'],
            ['term', 'Terms'],
            ['course', 'Courses'],
            ['lesson', 'Lessons'],
            ['category', 'Subjects'],
            ['in-progress', 'In progress'],
            ['completed', 'Completed'],
          ] as [Filter, string][]
        ).map(([v, l]) => (
          <button key={v} aria-pressed={filter === v} onClick={() => setFilter(v)} className={cx('min-h-[40px] shrink-0 rounded-full border px-3.5 text-sm font-semibold', filter === v ? 'border-violet bg-violet-soft text-violet' : 'border-line-strong text-muted')}>
            {l}
          </button>
        ))}
      </div>

      <div className="mt-4" aria-live="polite">
        {!q.trim() ? (
          <EmptyState icon={<SearchIcon />} title="Search VentureXP">
            Find glossary terms, course names, lesson titles and topic keywords.
          </EmptyState>
        ) : hits.length ? (
          <ul className="space-y-2">
            {hits.map(({ doc }) => {
              const K = KIND[doc.kind];
              const extra = doc.kind === 'lesson' ? lessonIndex.get(doc.id)?.course.title : undefined;
              return (
                <li key={`${doc.kind}-${doc.id}`}>
                  <Link to={doc.href} className="surface flex min-h-[64px] items-center gap-3 rounded-2xl px-4 py-3">
                    <K.icon size={20} className="shrink-0 text-violet" />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold">{doc.title}</p>
                      <p className="line-clamp-1 text-sm text-muted">{doc.kind === 'lesson' ? extra : doc.subtitle}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-elevated px-2 py-0.5 text-[11px] font-semibold text-muted">{K.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState icon={<SearchIcon />} title="No results">
            Nothing matches “{q}”. Try a shorter word or a different spelling.
          </EmptyState>
        )}
      </div>
    </div>
  );
}
