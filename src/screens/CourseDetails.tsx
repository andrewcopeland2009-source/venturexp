import { useEffect } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { AlertTriangle, CalendarClock, Clock, Compass, ExternalLink, Flag, Map as MapIcon, Play, Target } from 'lucide-react';
import { categoryById, courseById, courseLessons } from '@/content';
import { useCourseSummaries, useLessonStates } from '@/hooks/courses';
import { Card, EmptyState, LinkButton, PageHeader, Pill, ProgressBar, SectionTitle, Spinner, cx } from '@/components/ui';
import { NODE_STYLE, NodeIcon } from '@/components/widgets';
import { Icon } from '@/components/Icon';

export default function CourseDetails() {
  const { courseId = '' } = useParams();
  const [params] = useSearchParams();
  const focusLesson = params.get('lesson');
  const course = courseById.get(courseId);
  const summaries = useCourseSummaries();
  const states = useLessonStates(course);

  useEffect(() => {
    if (focusLesson) setTimeout(() => document.getElementById(`lesson-${focusLesson}`)?.scrollIntoView({ block: 'center' }), 100);
  }, [focusLesson, states]);

  if (!course)
    return (
      <div>
        <PageHeader title="Course not found" back="/learn" />
        <EmptyState icon={<Compass />} title="We couldn’t find that course" action={<LinkButton to="/learn">Browse courses</LinkButton>} />
      </div>
    );
  if (!summaries) return <Spinner />;

  const cat = categoryById.get(course.categoryId);
  const s = summaries.get(course.id);
  const soon = course.status === 'coming-soon';
  const lessons = courseLessons(course);
  const verifyCount = lessons.filter((l) => l.verify).length;

  return (
    <div>
      <PageHeader title={course.title} back={cat ? `/learn/${cat.id}` : '/learn'} subtitle={cat?.title} />

      <Card className="hero-gradient">
        <div className="flex items-start gap-3">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-violet-soft text-violet">
            <Icon name={course.icon} size={28} />
          </div>
          <p className="text-[15px] leading-relaxed">{course.description}</p>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {soon ? <Pill tone="amber">Coming soon · outline only</Pill> : <Pill tone="violet">Playable</Pill>}
          <Pill>{course.difficulty}</Pill>
          <Pill>
            <Clock size={12} /> ~{course.estimatedMinutes} min
          </Pill>
          {!soon && <Pill>{lessons.length} lessons</Pill>}
        </div>
        {!soon && s && (
          <div className="mt-4">
            <ProgressBar value={s.total ? s.completed / s.total : 0} tone="green" label="Course progress" />
            <p className="mt-1 text-xs text-muted">
              {s.completed}/{s.total} lessons completed{s.mastered ? ` · ${s.mastered} mastered` : ''}
            </p>
            <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
              {s.nextLessonId ? (
                <LinkButton to={`/lesson/${s.nextLessonId}`} block>
                  <Play size={18} className="fill-current" /> {s.started ? 'Continue' : 'Start course'}
                </LinkButton>
              ) : (
                <LinkButton to={`/course/${course.id}/path`} block variant="success">
                  Course complete — review lessons
                </LinkButton>
              )}
              <LinkButton to={`/course/${course.id}/path`} variant="secondary">
                <MapIcon size={18} /> Path
              </LinkButton>
            </div>
          </div>
        )}
      </Card>

      {soon && (
        <Card className="mt-4 border-amber/40">
          <p className="flex items-center gap-2 font-semibold text-amber">
            <CalendarClock size={18} /> Coming soon
          </p>
          <p className="mt-1 text-sm text-muted">
            This is a course outline. Its lessons haven’t been written yet, so there’s nothing to complete — nothing here counts toward progress.
          </p>
        </Card>
      )}

      {course.prerequisites.length > 0 && (
        <>
          <SectionTitle>Recommended first</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {course.prerequisites.map((p) => {
              const pc = courseById.get(p);
              const done = summaries.get(p)?.done;
              return pc ? (
                <Link key={p} to={`/course/${p}`} className="surface inline-flex min-h-[44px] items-center gap-2 rounded-2xl px-3 text-sm font-semibold">
                  <Flag size={16} className={done ? 'text-green' : 'text-muted'} /> {pc.title}
                  {done && <span className="text-green">✓</span>}
                </Link>
              ) : null;
            })}
          </div>
          <p className="mt-2 text-xs text-muted">Prerequisites are suggestions — you can start any playable course.</p>
        </>
      )}

      <SectionTitle>What you’ll learn</SectionTitle>
      <Card>
        <ul className="space-y-2">
          {course.objectives.map((o) => (
            <li key={o} className="flex items-start gap-2 text-[15px]">
              <Target size={18} className="mt-0.5 shrink-0 text-green" /> {o}
            </li>
          ))}
        </ul>
      </Card>

      <SectionTitle>{soon ? 'Planned outline' : 'Modules'}</SectionTitle>
      <div className="space-y-3">
        {soon
          ? course.outline.map((m, mi) => (
              <Card key={m.title}>
                <p className="text-xs font-bold uppercase tracking-wider text-muted">Module {mi + 1}</p>
                <p className="font-bold">{m.title}</p>
                <ul className="mt-2 space-y-1.5">
                  {m.lessons.map((l) => (
                    <li key={l} className="flex items-center gap-2 text-sm text-muted">
                      <span className="h-1.5 w-1.5 rounded-full bg-faint" /> {l} <span className="text-xs text-faint">· not yet available</span>
                    </li>
                  ))}
                </ul>
              </Card>
            ))
          : course.modules.map((m, mi) => (
              <Card key={m.id}>
                <p className="text-xs font-bold uppercase tracking-wider text-muted">Module {mi + 1}</p>
                <p className="font-bold">{m.title}</p>
                <p className="text-sm text-muted">{m.summary}</p>
                <ul className="mt-3 space-y-1.5">
                  {m.lessons.map((l) => {
                    const st = states?.get(l.id) ?? 'locked';
                    const style = NODE_STYLE[st];
                    const inner = (
                      <>
                        <span className={cx('grid h-9 w-9 shrink-0 place-items-center rounded-full', style.bg)}>
                          <NodeIcon state={st} size={16} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{l.title}</span>
                          <span className="text-xs text-muted">
                            {l.checkpoint ? 'Checkpoint · ' : ''}
                            {l.minutes} min · {style.label}
                          </span>
                        </span>
                      </>
                    );
                    return (
                      <li key={l.id} id={`lesson-${l.id}`} className={cx('rounded-2xl', focusLesson === l.id && 'ring-2 ring-violet')}>
                        {st === 'locked' ? (
                          <div className="flex min-h-[52px] items-center gap-3 px-1 opacity-70" aria-disabled>
                            {inner}
                          </div>
                        ) : (
                          <Link to={`/lesson/${l.id}`} className="flex min-h-[52px] items-center gap-3 rounded-2xl px-1 hover:bg-elevated">
                            {inner}
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </Card>
            ))}
      </div>

      <div className="mt-6 space-y-1 text-xs text-faint">
        <p>Content last reviewed: {course.lastReviewed}</p>
        {verifyCount > 0 && (
          <p className="flex items-start gap-1.5">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {verifyCount} lesson{verifyCount === 1 ? '' : 's'} mention rates, rules or platform policies that change — those lessons link to official sources to verify.
          </p>
        )}
        {lessons.some((l) => l.references.length) && (
          <p className="flex items-center gap-1.5">
            <ExternalLink size={14} /> Official references are listed inside the relevant lessons.
          </p>
        )}
      </div>
    </div>
  );
}
