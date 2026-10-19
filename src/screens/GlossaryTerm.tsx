import { Link, useParams } from 'react-router';
import { BookA, BookOpen, Lightbulb } from 'lucide-react';
import { glossaryById, lessonIndex } from '@/content';
import { GLOSSARY_CATEGORY_LABEL } from '@/content/glossary';
import { Card, EmptyState, LinkButton, PageHeader, Pill, SectionTitle } from '@/components/ui';

export default function GlossaryTerm() {
  const { termId = '' } = useParams();
  const t = glossaryById.get(termId);
  if (!t)
    return (
      <div>
        <PageHeader title="Term not found" back="/glossary" />
        <EmptyState icon={<BookA />} title="We couldn’t find that term" action={<LinkButton to="/glossary">Open glossary</LinkButton>} />
      </div>
    );
  const lessons = [...lessonIndex.values()].filter((r) => r.lesson.terms.includes(t.id));
  return (
    <div>
      <PageHeader title={t.term} back="/glossary" />
      <div className="mb-4 flex flex-wrap gap-1.5">
        <Pill tone="violet">{GLOSSARY_CATEGORY_LABEL[t.category]}</Pill>
        <Pill>{t.difficulty}</Pill>
        {t.aliases.map((a) => (
          <Pill key={a}>aka {a}</Pill>
        ))}
      </div>
      <Card>
        <p className="text-xs font-bold uppercase tracking-wider text-muted">Definition</p>
        <p className="mt-1 text-[17px] leading-relaxed">{t.definition}</p>
      </Card>
      <Card className="mt-3">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber">
          <Lightbulb size={14} /> Example
        </p>
        <p className="mt-1 text-[15px] leading-relaxed">{t.example}</p>
      </Card>
      {t.related.length > 0 && (
        <>
          <SectionTitle>Related terms</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {t.related.map((r) => {
              const rt = glossaryById.get(r);
              return rt ? (
                <Link key={r} to={`/glossary/${r}`} className="surface inline-flex min-h-[44px] items-center rounded-2xl px-3.5 text-sm font-semibold">
                  {rt.term}
                </Link>
              ) : null;
            })}
          </div>
        </>
      )}
      {lessons.length > 0 && (
        <>
          <SectionTitle>Learn it in</SectionTitle>
          <ul className="space-y-2">
            {lessons.map((r) => (
              <li key={r.lesson.id}>
                <Link to={`/course/${r.course.id}?lesson=${r.lesson.id}`} className="surface flex min-h-[56px] items-center gap-3 rounded-2xl px-4">
                  <BookOpen size={18} className="text-violet" />
                  <span>
                    <span className="block font-semibold">{r.lesson.title}</span>
                    <span className="text-xs text-muted">{r.course.title}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
