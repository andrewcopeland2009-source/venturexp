import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { motion } from 'motion/react';
import { Compass, Flag } from 'lucide-react';
import { courseById, courseLessons, lessonIndex } from '@/content';
import { useLessonStates } from '@/hooks/courses';
import { useProgressMap } from '@/hooks/data';
import type { NodeState } from '@/domain/unlocks';
import { Button, Dialog, EmptyState, LinkButton, PageHeader, Pill, Spinner, cx } from '@/components/ui';
import { NODE_STYLE, NodeIcon } from '@/components/widgets';

const OFFSETS = [0, 40, 60, 40, 0, -40, -60, -40];

export default function LearningPath() {
  const { courseId = '' } = useParams();
  const navigate = useNavigate();
  const course = courseById.get(courseId);
  const states = useLessonStates(course);
  const progress = useProgressMap();
  const [selected, setSelected] = useState<string | null>(null);

  // Scroll to the current lesson on open.
  useEffect(() => {
    if (!states) return;
    const current = [...states].find(([, s]) => s === 'available' || s === 'in_progress')?.[0];
    if (current) setTimeout(() => document.getElementById(`node-${current}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 150);
  }, [states]);

  if (!course || course.status !== 'playable')
    return (
      <div>
        <PageHeader title="No path yet" back={course ? `/course/${course.id}` : '/learn'} />
        <EmptyState icon={<Compass />} title={course ? 'This course is coming soon' : 'Course not found'} action={<LinkButton to="/learn">Browse playable courses</LinkButton>}>
          Only playable courses have a learning path.
        </EmptyState>
      </div>
    );
  if (!states || !progress) return <Spinner />;

  const sel = selected ? lessonIndex.get(selected) : undefined;
  const selState = selected ? states.get(selected) : undefined;
  const lessons = courseLessons(course);
  const prevTitle = sel && sel.globalIndex > 0 ? lessons[sel.globalIndex - 1].title : null;
  const p = selected ? progress.get(selected) : undefined;

  let n = 0;
  return (
    <div>
      <PageHeader title={course.title} subtitle="Your learning path" back={`/course/${course.id}`} />
      <div className="mb-4 flex flex-wrap gap-2 text-xs" aria-label="Legend">
        {(['available', 'in_progress', 'completed', 'mastered', 'locked'] as NodeState[]).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5 text-muted">
            <span className={cx('grid h-5 w-5 place-items-center rounded-full', NODE_STYLE[s].bg)}>
              <NodeIcon state={s} size={11} />
            </span>
            {NODE_STYLE[s].label === 'Start' ? 'Available' : NODE_STYLE[s].label}
          </span>
        ))}
      </div>

      {course.modules.map((m, mi) => (
        <section key={m.id} aria-labelledby={`mod-${m.id}`} className="mb-6">
          <div className="surface sticky top-[env(safe-area-inset-top)] z-10 mb-4 rounded-2xl px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wider text-violet">Module {mi + 1}</p>
            <h2 id={`mod-${m.id}`} className="font-bold">
              {m.title}
            </h2>
          </div>
          <ol className="relative flex flex-col items-center gap-5 py-2">
            {m.lessons.map((l, li) => {
              const st = states.get(l.id) ?? 'locked';
              const off = OFFSETS[n++ % OFFSETS.length];
              const isCurrent = st === 'available' || st === 'in_progress';
              return (
                <li key={l.id} id={`node-${l.id}`} className="flex flex-col items-center" style={{ transform: `translateX(${off}px)` }}>
                  {li > 0 && <span aria-hidden className="mb-1 h-4 w-1 rounded-full bg-line-strong" />}
                  <motion.button
                    whileTap={{ scale: 0.94 }}
                    onClick={() => setSelected(l.id)}
                    aria-label={`${l.title} — ${NODE_STYLE[st].label}${l.checkpoint ? ', checkpoint' : ''}`}
                    className={cx(
                      'relative grid place-items-center rounded-full border-4 shadow-lg',
                      l.checkpoint ? 'h-[76px] w-[76px]' : 'h-[68px] w-[68px]',
                      NODE_STYLE[st].ring,
                      NODE_STYLE[st].bg,
                    )}
                  >
                    {isCurrent && <span aria-hidden className="absolute inset-[-8px] animate-ping rounded-full border-2 border-violet/40" />}
                    {l.checkpoint && st !== 'completed' && st !== 'mastered' ? <Flag size={26} /> : <NodeIcon state={st} size={26} />}
                  </motion.button>
                  <span className={cx('mt-2 max-w-[130px] text-center text-[13px] font-semibold leading-tight', st === 'locked' ? 'text-faint' : 'text-ink')}>{l.title}</span>
                  {isCurrent && <span className="mt-1 rounded-full bg-violet px-2 py-0.5 text-[11px] font-bold text-white">{st === 'in_progress' ? 'Resume' : 'Up next'}</span>}
                </li>
              );
            })}
          </ol>
        </section>
      ))}

      <Dialog
        open={!!sel}
        onClose={() => setSelected(null)}
        title={sel?.lesson.title ?? ''}
        actions={
          <>
            <Button variant="ghost" onClick={() => setSelected(null)}>
              Close
            </Button>
            {selState && selState !== 'locked' && (
              <Button onClick={() => navigate(`/lesson/${selected}`)}>{selState === 'completed' || selState === 'mastered' ? 'Practice again' : selState === 'in_progress' ? 'Resume lesson' : 'Start lesson'}</Button>
            )}
          </>
        }
      >
        {sel && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              <Pill tone={selState === 'locked' ? 'neutral' : selState === 'mastered' ? 'amber' : selState === 'completed' ? 'green' : 'violet'}>{selState ? NODE_STYLE[selState].label : ''}</Pill>
              <Pill>{sel.lesson.minutes} min</Pill>
              <Pill>{sel.lesson.activities.length} activities</Pill>
              {sel.lesson.checkpoint && <Pill tone="blue">Checkpoint · 70% to pass</Pill>}
            </div>
            <p className="text-ink">{sel.lesson.objective}</p>
            {selState === 'locked' && prevTitle && <p className="text-sm">🔒 Complete “{prevTitle}” to unlock this lesson.</p>}
            {p && p.status === 'completed' && <p className="text-sm">Best score: {Math.round(p.bestScore * 100)}% · completed {p.completions}×</p>}
          </div>
        )}
      </Dialog>
    </div>
  );
}
