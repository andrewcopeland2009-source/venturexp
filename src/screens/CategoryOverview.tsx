import { useParams } from 'react-router';
import { Compass } from 'lucide-react';
import { categoryById, coursesInCategory, glossary } from '@/content';
import { useCourseSummaries } from '@/hooks/courses';
import { CourseCard } from '@/components/widgets';
import { Card, EmptyState, LinkButton, PageHeader, Pill, SectionTitle, Spinner } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { GLOSSARY_CATEGORY_LABEL } from '@/content/glossary';

export default function CategoryOverview() {
  const { categoryId = '' } = useParams();
  const cat = categoryById.get(categoryId);
  const summaries = useCourseSummaries();
  if (!cat)
    return (
      <div>
        <PageHeader title="Subject not found" back="/learn" />
        <EmptyState icon={<Compass />} title="We couldn’t find that subject" action={<LinkButton to="/learn">Browse subjects</LinkButton>} />
      </div>
    );
  if (!summaries) return <Spinner />;
  const list = coursesInCategory(cat.id).sort((a, b) => (a.status === b.status ? 0 : a.status === 'playable' ? -1 : 1));
  const terms = glossary.filter((t) => t.category === cat.id).length;

  return (
    <div>
      <PageHeader title={cat.title} subtitle={cat.description} back="/learn" />
      <Card className="hero-gradient">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-soft text-violet">
            <Icon name={cat.icon} size={24} />
          </div>
          <div>
            <p className="font-bold">What you’ll cover</p>
            <p className="text-sm text-muted">
              {list.length} course{list.length === 1 ? '' : 's'}
              {terms ? ` · ${terms} glossary terms` : ''}
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {cat.topics.map((t) => (
            <Pill key={t}>{t}</Pill>
          ))}
        </div>
      </Card>
      <SectionTitle>Courses</SectionTitle>
      <div className="space-y-3">
        {list.map((c) => (
          <CourseCard key={c.id} course={c} summary={summaries.get(c.id)} />
        ))}
      </div>
      {terms > 0 && (
        <LinkButton to={`/glossary?category=${cat.id}`} variant="secondary" block className="mt-4">
          Browse {GLOSSARY_CATEGORY_LABEL[cat.id] ?? cat.title} terms
        </LinkButton>
      )}
    </div>
  );
}
