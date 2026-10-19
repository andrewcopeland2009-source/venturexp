import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { BookText, Search as SearchIcon, X } from 'lucide-react';
import { categories, courses, lessonIndex } from '@/content';
import { searchAll } from '@/content/searchIndex';
import { useCourseSummaries } from '@/hooks/courses';
import { CourseCard } from '@/components/widgets';
import { EmptyState, PageHeader, SectionTitle, Spinner, cx } from '@/components/ui';
import { Icon } from '@/components/Icon';

type Status = 'all' | 'playable' | 'in-progress' | 'completed' | 'coming-soon';
type Diff = 'all' | 'beginner' | 'intermediate' | 'advanced';

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      aria-pressed={on}
      onClick={onClick}
      className={cx('min-h-[40px] shrink-0 rounded-full border px-3.5 text-sm font-semibold', on ? 'border-violet bg-violet-soft text-violet' : 'border-line-strong text-muted hover:text-ink')}
    >
      {children}
    </button>
  );
}

export default function Catalog() {
  const summaries = useCourseSummaries();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string>('all');
  const [status, setStatus] = useState<Status>('all');
  const [diff, setDiff] = useState<Diff>('all');

  const hits = useMemo(() => (q.trim() ? searchAll(q, 80) : null), [q]);

  const list = useMemo(() => {
    const matchIds = hits ? new Set(hits.filter((h) => h.doc.kind === 'course' || h.doc.kind === 'lesson').map((h) => (h.doc.kind === 'lesson' ? lessonIndex.get(h.doc.id)?.course.id : h.doc.id))) : null;
    return courses.filter((c) => {
      if (matchIds && !matchIds.has(c.id)) return false;
      if (cat !== 'all' && c.categoryId !== cat) return false;
      if (diff !== 'all' && c.difficulty !== diff) return false;
      const s = summaries?.get(c.id);
      if (status === 'playable' && c.status !== 'playable') return false;
      if (status === 'coming-soon' && c.status !== 'coming-soon') return false;
      if (status === 'in-progress' && !(s?.started && !s.done)) return false;
      if (status === 'completed' && !s?.done) return false;
      return true;
    });
  }, [hits, cat, diff, status, summaries]);

  const lessonHits = hits?.filter((h) => h.doc.kind === 'lesson').slice(0, 6) ?? [];

  if (!summaries) return <Spinner />;

  return (
    <div>
      <PageHeader title="Learn" subtitle="Courses across 12 business subjects. Playable courses are marked; others are outlines coming soon." />

      <label className="relative block">
        <span className="sr-only">Search courses and lessons</span>
        <SearchIcon size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-faint" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search courses, lessons, topics…"
          className="min-h-[52px] w-full rounded-2xl border-2 border-line-strong bg-card pl-12 pr-12 outline-none focus:border-violet"
        />
        {q && (
          <button onClick={() => setQ('')} aria-label="Clear search" className="absolute right-1.5 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center text-muted">
            <X size={18} />
          </button>
        )}
      </label>

      <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Status filter">
        {(
          [
            ['all', 'All'],
            ['playable', 'Playable'],
            ['in-progress', 'In progress'],
            ['completed', 'Completed'],
            ['coming-soon', 'Coming soon'],
          ] as [Status, string][]
        ).map(([v, l]) => (
          <Chip key={v} on={status === v} onClick={() => setStatus(v)}>
            {l}
          </Chip>
        ))}
      </div>
      <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Difficulty filter">
        {(['all', 'beginner', 'intermediate', 'advanced'] as Diff[]).map((d) => (
          <Chip key={d} on={diff === d} onClick={() => setDiff(d)}>
            {d === 'all' ? 'Any level' : d[0].toUpperCase() + d.slice(1)}
          </Chip>
        ))}
      </div>
      <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Category filter">
        <Chip on={cat === 'all'} onClick={() => setCat('all')}>
          All subjects
        </Chip>
        {categories.map((c) => (
          <Chip key={c.id} on={cat === c.id} onClick={() => setCat(c.id)}>
            {c.title}
          </Chip>
        ))}
      </div>

      {lessonHits.length > 0 && (
        <>
          <SectionTitle>Matching lessons</SectionTitle>
          <ul className="space-y-2">
            {lessonHits.map((h) => (
              <li key={h.doc.id}>
                <Link to={h.doc.href} className="surface flex min-h-[56px] items-center gap-3 rounded-2xl px-4 py-2">
                  <BookText size={18} className="shrink-0 text-violet" />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{h.doc.title}</span>
                    <span className="block truncate text-xs text-muted">{h.doc.subtitle}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      {!q && cat === 'all' && status === 'all' && diff === 'all' && (
        <>
          <SectionTitle>Subjects</SectionTitle>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {categories.map((c) => {
              const count = courses.filter((x) => x.categoryId === c.id);
              const playable = count.filter((x) => x.status === 'playable').length;
              return (
                <Link key={c.id} to={`/learn/${c.id}`} className="surface flex min-h-[92px] flex-col justify-between rounded-2xl p-3">
                  <Icon name={c.icon} size={22} className="text-violet" />
                  <span>
                    <span className="block text-sm font-bold leading-tight">{c.title}</span>
                    <span className="text-xs text-muted">
                      {count.length} course{count.length === 1 ? '' : 's'}
                      {playable ? ` · ${playable} playable` : ''}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </>
      )}

      <SectionTitle>{q || cat !== 'all' || status !== 'all' || diff !== 'all' ? `${list.length} course${list.length === 1 ? '' : 's'}` : 'All courses'}</SectionTitle>
      {list.length ? (
        <div className="space-y-3">
          {[...list]
            .sort((a, b) => (a.status === b.status ? 0 : a.status === 'playable' ? -1 : 1))
            .map((c) => (
              <CourseCard key={c.id} course={c} summary={summaries.get(c.id)} />
            ))}
        </div>
      ) : (
        <EmptyState icon={<SearchIcon />} title="No courses match">
          Try a different search or clear a filter.
        </EmptyState>
      )}
    </div>
  );
}
